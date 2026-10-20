import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { getAnalyticsStore } from './storage';

export type AnalyticsReader = (sql: string, bindings?: Record<string, string | number> | string, mode?: 'all' | 'get') => Promise<unknown>;
interface Pending { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
interface ReaderState { worker?: Worker; pending: Map<string, Pending> }
const runtime = globalThis as typeof globalThis & { holidayAnalyticsReader?: ReaderState };
function state(): ReaderState { return runtime.holidayAnalyticsReader ??= { pending: new Map() }; }
export const readAnalyticsQuery: AnalyticsReader = (sql, bindings, mode = 'all') => {
  const current = state();
  if (current.pending.size >= 16) return Promise.reject(new Error('Analytics reports are busy. Retry shortly.'));
  if (!current.worker) {
    const worker = new Worker(path.join(process.cwd(), 'scripts', 'lib', 'analytics-query-worker.mjs'), { workerData: { databasePath: getAnalyticsStore().name } });
    current.worker = worker; worker.unref();
    worker.on('message', (message: { id: string; result?: unknown; error?: string }) => {
      const pending = current.pending.get(message.id); if (!pending) return;
      clearTimeout(pending.timer); current.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error)); else pending.resolve(message.result);
    });
    const stop = () => {
      if (current.worker !== worker) return;
      current.worker = undefined;
      for (const pending of current.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Analytics reader stopped. Retry.')); }
      current.pending.clear();
    };
    worker.on('error', stop); worker.on('exit', stop);
  }
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('Analytics report timed out. Use a narrower date range and retry.')); void closeAnalyticsReader(); }, 15000);
    current.pending.set(id, { resolve, reject, timer });
    current.worker!.postMessage({ id, sql, bindings, mode });
  });
};
export async function closeAnalyticsReader() {
  const current = state(), worker = current.worker;
  current.worker = undefined;
  for (const pending of current.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Analytics reader closed. Retry.')); }
  current.pending.clear();
  if (worker) await worker.terminate();
}
