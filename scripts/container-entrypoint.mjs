import { existsSync, accessSync, constants } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';
import { validateProductionConfig } from './lib/production-config.mjs';
import { RUNTIME_PROMPT_FILES } from './lib/runtime-prompts.mjs';

try {
  validateProductionConfig(process.env);
  const database = path.resolve(process.env.HOLIDAY_SPEND_DB_PATH);
  if (!existsSync(database)) throw new Error('Persistent database is missing. Restore the verified snapshot before starting; do not seed over existing data.');
  accessSync(database, constants.R_OK | constants.W_OK);
  accessSync(path.dirname(database), constants.R_OK | constants.W_OK);
  const db = new Database(database, { readonly: true, fileMustExist: true });
  try {
    if (db.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('Database quick check failed.');
    if (!db.prepare('SELECT count(*) AS count FROM cities').get().count) throw new Error('City library is empty.');
  } finally { db.close(); }
  for (const file of RUNTIME_PROMPT_FILES) {
    if (!existsSync(path.resolve('docs/prompts', file))) throw new Error(`Runtime prompt missing: ${file}`);
  }
} catch (error) {
  console.error('[startup] ' + error.message);
  process.exit(1);
}
const child = spawn(process.execPath, ['server.js'], { stdio: 'inherit', env: process.env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error('[startup] ' + error.message); process.exit(1); });
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
