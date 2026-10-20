import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';

const database = new Database(workerData.databasePath, { readonly: true, fileMustExist: true });
database.pragma('query_only = ON');
database.pragma('busy_timeout = 1000');
database.pragma('cache_size = -8192');
database.pragma('mmap_size = 134217728');
parentPort.on('message', ({ id, sql, bindings, mode }) => {
  try {
    const statement = database.prepare(sql);
    const result = mode === 'get' ? statement.get(bindings ?? {}) : statement.all(bindings ?? {});
    parentPort.postMessage({ id, result });
  } catch { parentPort.postMessage({ id, error: 'Analytics report query failed. Retry.' }); }
});
