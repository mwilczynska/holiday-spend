import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { checkDatabase, createDataSnapshot, databaseSummary, restoreDataSnapshot, verifyDataSnapshot } from './lib/data-snapshot.mjs';

async function main() {
  const args = process.argv.slice(2);
  const option = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  const source = option('--source'), destination = option('--destination');
  if (!source || !destination) throw new Error('Supply --source with a verified full snapshot and --destination with a new private rehearsal directory.');
  const original = verifyDataSnapshot(path.resolve(source));
  assert.equal(original.mode, 'full', 'Use a full production-data snapshot, not a catalogue.');
  const root = path.resolve(destination);
  if (fs.existsSync(root)) throw new Error('Rehearsal destination already exists. Choose a new directory.');
  fs.mkdirSync(root, { mode: 0o700 });
  const runtimeDirectory = path.join(root, 'runtime');
  restoreDataSnapshot(path.resolve(source), runtimeDirectory);
  process.env.HOLIDAY_SPEND_DB_PATH = path.join(runtimeDirectory, 'travel.db');
  process.env.HOLIDAY_SPEND_ANALYTICS_DB_PATH = path.join(runtimeDirectory, 'analytics.db');
  process.env.HOLIDAY_SPEND_ANALYTICS_ENV = 'test';
  const { sqlite } = await import('../src/db');
  const { startAnalytics } = await import('../src/lib/analytics/startup');
  const { getAnalyticsStore, insertAnalyticsEvent } = await import('../src/lib/analytics/storage');
  try {
    startAnalytics();
    const revisions = (sqlite.prepare('SELECT count(*) AS n FROM plan_revisions').get() as { n: number }).n;
    startAnalytics();
    assert.equal((sqlite.prepare('SELECT count(*) AS n FROM plan_revisions').get() as { n: number }).n, revisions, 'Startup must not duplicate history baselines.');
    checkDatabase(sqlite);
    const upgraded = databaseSummary(sqlite);
    for (const [name, state] of Object.entries(original.tables)) {
      if (!name.startsWith('analytics_') && name !== 'plan_revisions') assert.deepEqual(upgraded[name], state, 'Migration changed pre-existing business data in ' + name);
    }
    const now = new Date().toISOString();
    const rehearsalEvent = { id: crypto.randomUUID(), name: 'page_viewed', version: 1, occurredAt: now, receivedAt: now,
      source: 'browser', purpose: 'behavior', environment: 'test', release: 'upgrade-rehearsal', accountId: null,
      administrator: true, sessionId: crypto.randomUUID(), pageViewId: null, operationId: null, requestId: null,
      route: '/plan', device: 'desktop', properties: {} } as const;
    insertAnalyticsEvent(getAnalyticsStore(), rehearsalEvent);
    assert.ok((getAnalyticsStore().prepare('SELECT count(*) AS n FROM event_rollups').get() as { n: number }).n);
    assert.ok((getAnalyticsStore().prepare('SELECT count(*) AS n FROM event_sessions').get() as { n: number }).n);
    const backup = path.join(root, 'upgraded-backup');
    const manifest = await createDataSnapshot({ source: process.env.HOLIDAY_SPEND_DB_PATH, analyticsSource: process.env.HOLIDAY_SPEND_ANALYTICS_DB_PATH, destination: backup, mode: 'full' });
    assert.ok(Object.hasOwn(manifest.files, 'analytics.db'), 'Full backup must include the separate analytics store.');
    verifyDataSnapshot(backup);
    const restored = path.join(root, 'restored');
    restoreDataSnapshot(backup, restored); verifyDataSnapshot(restored);
    for (const name of ['travel.db', 'analytics.db']) {
      const saved = new Database(path.join(backup, name), { readonly: true, fileMustExist: true });
      const recovered = new Database(path.join(restored, name), { readonly: true, fileMustExist: true });
      try { assert.deepEqual(databaseSummary(recovered), databaseSummary(saved), 'Restored data differs in ' + name); }
      finally { saved.close(); recovered.close(); }
    }
    assert.deepEqual(verifyDataSnapshot(path.resolve(source)), original, 'Source snapshot must remain unchanged.');
    const result = { sourceSnapshotCreatedAt: original.createdAt, cities: upgraded.cities.count,
      users: upgraded.user.count, legs: upgraded.itinerary_legs.count, savedPlans: upgraded.saved_plans.count,
      historyBaselines: revisions, existingBusinessTablesUnchanged: true, startupIdempotent: true,
      analyticsBackedUpAndRestored: true, sourceUnchanged: true };
    fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    const runtime = globalThis as typeof globalThis & { holidayAnalyticsWorker?: ReturnType<typeof setInterval> };
    if (runtime.holidayAnalyticsWorker) { clearInterval(runtime.holidayAnalyticsWorker); runtime.holidayAnalyticsWorker = undefined; }
    const { closeAnalyticsReader } = await import('../src/lib/analytics/reader');
    await closeAnalyticsReader(); getAnalyticsStore().close(); sqlite.close();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Upgrade rehearsal failed.'); process.exitCode = 1; });
