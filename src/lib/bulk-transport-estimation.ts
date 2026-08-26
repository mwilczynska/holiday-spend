import type { CityGenerationProvider } from '@/lib/city-generation-config';

/**
 * Keep the bulk estimate fan-out below the provider's likely request-rate ceiling while
 * still allowing independent city legs to make progress at the same time.
 */
export const BULK_TRANSPORT_CONCURRENCY: Record<CityGenerationProvider, number> = {
  anthropic: 2,
  openai: 4,
  gemini: 2,
};

export async function runWithConcurrency<T, TResult>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<TResult>,
  onResult?: (result: TResult, index: number) => void | Promise<void>,
): Promise<TResult[]> {
  if (items.length === 0) return [];

  const workerCount = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length));
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) return;

      const result = await worker(items[index], index);
      results[index] = result;
      await onResult?.(result, index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}
