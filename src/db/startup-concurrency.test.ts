import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';

it('serializes concurrent legacy schema upgrades and analytics backfills', { timeout: 30000 }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-startup-concurrency-'));
  const primaryPath = path.join(directory, 'travel.db');
  const analyticsPath = path.join(directory, 'analytics.db');
  const primary = new Database(primaryPath);
  primary.pragma('journal_mode = WAL');
  primary.exec('CREATE TABLE user_preferences(user_id TEXT PRIMARY KEY, planner_group_size INTEGER NOT NULL DEFAULT 2)');
  primary.close();
  const legacy = new Database(analyticsPath);
  legacy.pragma('journal_mode = WAL');
  legacy.exec(`
    CREATE TABLE events(sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,name TEXT NOT NULL,
      occurred_at TEXT NOT NULL,received_at TEXT NOT NULL,purpose TEXT NOT NULL,account_id TEXT,session_id TEXT,
      operation_id TEXT,request_id TEXT,environment TEXT NOT NULL,release TEXT NOT NULL,administrator INTEGER NOT NULL,
      route TEXT NOT NULL,device TEXT NOT NULL,payload_json TEXT NOT NULL);
    INSERT INTO events(id,name,occurred_at,received_at,purpose,session_id,environment,release,administrator,route,device,payload_json)
      VALUES ('legacy','page_viewed','2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z','behavior','session','test','fixture',0,'/plan','desktop','{"properties":{}}');
  `);
  legacy.close();
  const source = pathToFileURL(path.resolve('src/db/index.ts')).href;
  const storage = pathToFileURL(path.resolve('src/lib/analytics/storage.ts')).href;
  const program = `process.send('ready'); await new Promise(resolve => process.once('message',resolve));
    const primaryModule=await import(${JSON.stringify(source)}); const {sqlite}=primaryModule.default ?? primaryModule;
    const analyticsModule=await import(${JSON.stringify(storage)}); const {getAnalyticsStore}=analyticsModule.default ?? analyticsModule;
    getAnalyticsStore().close(); sqlite.close(); process.disconnect();`;
  const children = Array.from({ length: 6 }, () => {
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', program], {
      env: { ...process.env, HOLIDAY_SPEND_DB_PATH: primaryPath, HOLIDAY_SPEND_ANALYTICS_DB_PATH: analyticsPath },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let output = '';
    child.stderr?.on('data', chunk => { output += chunk; });
    const ready = new Promise<void>((resolve, reject) => { child.once('message', () => resolve()); child.once('error', reject); child.once('exit', code => { if (code) reject(new Error(output)); }); });
    const done = new Promise<void>((resolve, reject) => { child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(output || 'Startup failed: ' + code))); });
    // Observe early failures while waiting for the remaining workers at the barrier.
    void done.catch(() => {});
    return { child, ready, done };
  });
  try {
    await Promise.all(children.map(worker => worker.ready));
    for (const worker of children) worker.child.send('start');
    await Promise.all(children.map(worker => worker.done));
    const database = new Database(primaryPath);
    try { expect((database.pragma('table_info(user_preferences)') as Array<{ name: string }>).filter(column => column.name === 'display_currency')).toHaveLength(1); }
    finally { database.close(); }
    const analytics = new Database(analyticsPath);
    try {
      expect(analytics.prepare('SELECT id,event_identity FROM events').all()).toEqual([{ id: 'legacy', event_identity: 'session' }]);
      expect(analytics.prepare('SELECT event_count FROM event_rollups').all()).toEqual([{ event_count: 1 }]);
      expect(analytics.prepare('SELECT event_count FROM event_sessions').all()).toEqual([{ event_count: 1 }]);
    } finally { analytics.close(); }
  } finally {
    for (const worker of children) if (worker.child.exitCode === null) worker.child.kill();
    await Promise.allSettled(children.map(worker => worker.done));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
