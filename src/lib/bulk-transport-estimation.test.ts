import { describe, expect, it } from 'vitest';
import { BULK_TRANSPORT_CONCURRENCY, runWithConcurrency } from '@/lib/bulk-transport-estimation';

describe('bulk transport estimation concurrency', () => {
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
