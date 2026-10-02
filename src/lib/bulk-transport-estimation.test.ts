import { describe, expect, it } from 'vitest';
import { BULK_TRANSPORT_CONCURRENCY, runWithConcurrency } from '@/lib/bulk-transport-estimation';

describe('bulk transport estimation concurrency', () => {
  it('stops a ten-leg queue and retains completed results', async () => {
    const controller = new AbortController();
    const started: number[] = [];
    const settled: number[] = [];
    await runWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 4, async (leg) => {
      started.push(leg);
      if (leg === 0) return leg;
      await new Promise<void>((resolve) => controller.signal.addEventListener('abort', () => resolve(), { once: true }));
      return leg;
    }, (result) => {
      settled.push(result);
      if (result === 0) controller.abort();
    }, controller.signal);
    expect(started).toEqual([0, 1, 2, 3]);
    expect(settled).toEqual([0, 1, 2, 3]);
  });

  it('never starts an already cancelled batch', async () => {
    const controller = new AbortController();
    controller.abort();
    const started: number[] = [];
    await runWithConcurrency([1, 2], 4, async (leg) => { started.push(leg); return leg; }, undefined, controller.signal);
    expect(started).toEqual([]);
  });
  it('uses provider-aware limits while preserving the selected-leg order', async () => {
    expect(BULK_TRANSPORT_CONCURRENCY).toEqual({ anthropic: 2, openai: 4, gemini: 2 });

    let active = 0;
    let maximumActive = 0;
    const results = await runWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, value === 1 ? 15 : 2));
      active -= 1;
      return value * 10;
    });

    expect(maximumActive).toBe(2);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it('reports each result as soon as its worker settles', async () => {
    const settled: number[] = [];

    await runWithConcurrency(
      [1, 2],
      2,
      async (value) => {
        await new Promise((resolve) => setTimeout(resolve, value === 1 ? 12 : 1));
        return value;
      },
      (value) => {
        settled.push(value);
      },
    );

    expect(settled).toEqual([2, 1]);
  });
});
