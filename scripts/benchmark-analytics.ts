import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

async function main() {
const count = Number(process.argv[2] || 1000000);
const fastFixture = process.argv.includes('--fast-fixture');
const profile = process.argv.includes('--profile');
const keepFixture = process.argv.includes('--keep-fixture');
const mixed = process.argv.includes('--mixed');
if (!Number.isSafeInteger(count) || count < 1 || count > 2000000) throw new Error('Use 1–2,000,000 fixture events.');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-analytics-benchmark-'));
process.env.HOLIDAY_SPEND_DB_PATH = path.join(directory, 'travel.db');
process.env.HOLIDAY_SPEND_ANALYTICS_DB_PATH = path.join(directory, 'analytics.db');
process.env.HOLIDAY_SPEND_ANALYTICS_ENV = 'test';
const { getAnalyticsStore, insertAnalyticsEvent } = await import('../src/lib/analytics/storage');
const { rebuildAnalyticsRollups } = await import('../src/lib/analytics/rollups');
const { buildAnalyticsReport, parseReportQuery } = await import('../src/lib/analytics/reports');
const { readAnalyticsQuery } = await import('../src/lib/analytics/reader');
const { sqlite, db } = await import('../src/db');
const { analyticsTestDatabase } = await import('../src/lib/analytics/test-fixture');
const { withPlanRevision } = await import('../src/lib/analytics/history');
const store = getAnalyticsStore();
try {
  const start = performance.now();
  if (fastFixture) store.pragma('temp_store = MEMORY');
  // Bulk preparation measures report reads, not production event-ingestion throughput.
  // Rebuild the exact production indexes after loading so repeated report work does not spend
  // minutes rewriting the same index pages while constructing a synthetic fixture.
  const indexes = store.prepare("SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name='events' AND sql IS NOT NULL").all() as Array<{ name: string; sql: string }>;
  const triggers = store.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND tbl_name='events' AND name LIKE 'overview_%'").all() as Array<{ name: string; sql: string }>;
  if (fastFixture) for (const index of indexes) {
    if (!/^events_[a-z0-9_]+$/.test(index.name)) throw new Error('Unexpected fixture index.');
    store.exec('DROP INDEX ' + index.name);
  }
  if (fastFixture) for (const trigger of triggers) store.exec('DROP TRIGGER ' + trigger.name);
  for (let batch = 0; batch < count; batch += 1000) {
  store.transaction(() => {
    for (let i = batch; i < Math.min(batch + 1000, count); i++) {
      const time = new Date(Date.UTC(2026, 8, 1) + (i % (30 * 86400)) * 1000).toISOString();
      const phase = Math.floor(i / 1000) % 100;
      const kind = mixed ? phase < 20 ? 'request_completed' : phase < 85 ? 'page_viewed' : phase < 95 ? 'control_activated' : phase < 97 ? 'workflow_step' : 'mutation_committed' : i % 5 ? 'page_viewed' : 'request_completed';
      const properties = kind === 'request_completed' ? { method: 'GET', status: mixed && phase === 0 ? 500 : 200, durationMs: 10, resource: 'itinerary', outcome: mixed && phase === 0 ? 'failure' : 'success' }
        : kind === 'control_activated' ? { control: 'fixture.add-leg', surface: 'desktop' }
        : kind === 'workflow_step' ? { workflow: 'city', step: 'generation_requested' }
        : kind === 'mutation_committed' ? { action: phase === 97 ? 'leg_created' : phase === 98 ? 'plan_saved' : 'expenses.post' } : {};
      insertAnalyticsEvent(store, { id: 'fixture-' + i, name: kind, version: 1, occurredAt: time, receivedAt: time,
        source: kind === 'page_viewed' || kind === 'control_activated' ? 'browser' : 'server', purpose: kind === 'request_completed' ? 'diagnostic' : 'behavior', environment: 'test', release: 'fixture',
        accountId: (i % 1000).toString(16).padStart(64, '0'), administrator: false, sessionId: 'session-' + (i % 10000), pageViewId: null,
        operationId: null, requestId: null, route: '/plan', device: 'desktop', properties,
      });
    }
  })();
  if ((batch + 1000) % 100000 === 0) console.log('Fixture events committed: ' + Math.min(batch + 1000, count));
  }
  if (fastFixture) for (const index of indexes) store.exec(index.sql);
  if (fastFixture) { rebuildAnalyticsRollups(store); for (const trigger of triggers) store.exec(trigger.sql); }
  if (fastFixture) store.pragma('temp_store = DEFAULT');
  const preparationMs = performance.now() - start;
  const queryProfiles: Array<{ view: string; query: string; ms: number; plan: string[] }> = [];
  const timings: Record<string, number> = {};
  for (const view of ['overview', 'journeys', 'funnels', 'llm', 'health']) {
    const at = performance.now();
    await buildAnalyticsReport(parseReportQuery(new URLSearchParams({ view, from: '2026-09-01', to: '2026-09-30', environment: 'test' })), async (sql, bindings, mode) => {
      const plan = profile ? store.prepare('EXPLAIN QUERY PLAN ' + sql).all(bindings ?? {}) as Array<{ detail: string }> : [];
      const queryStart = performance.now();
      const result = await readAnalyticsQuery(sql, bindings, mode);
      if (profile) queryProfiles.push({ view, query: sql.replace(/\s+/g, ' ').slice(0, 220), ms: Math.round(performance.now() - queryStart), plan: plan.map(row => row.detail) });
      return result;
    });
    timings[view] = Math.round(performance.now() - at);
  }
  const deliveryStart = performance.now();
  store.transaction(() => {
    for (let i = 0; i < 250; i++) insertAnalyticsEvent(store, { id: crypto.randomUUID(), name: 'page_viewed', version: 1,
      occurredAt: '2026-09-30T10:00:00.000Z', receivedAt: '2026-09-30T10:00:00.000Z', source: 'browser', purpose: 'behavior',
      environment: 'test', release: 'fixture', accountId: (i % 1000).toString(16).padStart(64, '0'), administrator: false,
      sessionId: 'delivery-' + i, pageViewId: null, operationId: null, requestId: null, route: '/plan', device: 'desktop', properties: {} });
  })();
  const eventDelivery250Ms = Math.round((performance.now() - deliveryStart) * 100) / 100;
  // Create the complete production schema in this throwaway database for a 66-leg mutation sample.
  const fixture = analyticsTestDatabase();
  const createStatements = fixture.sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ sql: string }>;
  for (const statement of createStatements) sqlite.exec(statement.sql.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS '));
  fixture.sqlite.close();
  sqlite.exec("INSERT INTO user(id) VALUES ('benchmark'); INSERT INTO countries(id,name,currency_code) VALUES ('country','Fixture','AUD'); INSERT INTO cities(id,country_id,name,accom_2star,food_mid,drinks_moderate,activities_mid) VALUES ('city','country','Fixture',100,40,20,10)");
  const insert = sqlite.prepare("INSERT INTO itinerary_legs(user_id,city_id,nights,accom_tier,food_tier,drinks_tier,activities_tier,sort_order) VALUES ('benchmark','city',3,'2star','mid','moderate','mid',?)");
  for (let i = 0; i < 66; i++) insert.run(i);
  const direct: number[] = [], historical: number[] = [];
  const update = sqlite.prepare("UPDATE itinerary_legs SET nights=? WHERE user_id='benchmark' AND sort_order=0");
  for (let i = 0; i < 100; i++) {
    let at = performance.now(); db.transaction(() => { update.run(3 + i % 2); }); direct.push(performance.now() - at);
    at = performance.now(); withPlanRevision('benchmark', 'leg_updated', () => update.run(3 + i % 2)); historical.push(performance.now() - at);
  }
  const p95 = (values: number[]) => values.sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
  const addedP95Ms = Math.round((p95(historical) - p95(direct)) * 100) / 100;
  const browserBytes = gzipSync(fs.readFileSync('src/lib/analytics/browser.ts')).byteLength;
  const output = { fixtureEvents: count, fixtureDataset: mixed ? 'product-journeys' : 'pages-and-requests', fixtureMethod: fastFixture ? 'bulk-load-then-production-indexes' : 'production-inserts', fixturePreparationMs: Math.round(preparationMs), ingestionMs: fastFixture ? null : Math.round(preparationMs), queryMs: timings, eventDelivery250Ms, mutationAddedP95Ms: addedP95Ms, browserSourceGzipBytes: browserBytes,
    ...(profile ? { queryProfiles } : {}), ...(keepFixture ? { fixtureDirectory: directory } : {}),
    note: 'Source gzip is a lower-bound proxy, not a measurement of the shipped client bundle. Local workstation results do not establish VPS performance.' };
  fs.mkdirSync('.local', { recursive: true }); fs.writeFileSync('.local/analytics-performance.json', JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
  if (Object.values(timings).some(ms => ms > 2000) || addedP95Ms > 20) process.exitCode = 1;
} finally {
  const { closeAnalyticsReader } = await import('../src/lib/analytics/reader');
  await closeAnalyticsReader();
  store.close(); sqlite.close();
  const safePrefix = path.resolve(os.tmpdir(), 'holiday-analytics-benchmark-');
  if (!path.resolve(directory).startsWith(safePrefix)) throw new Error('Unsafe benchmark cleanup path.');
  if (!keepFixture) fs.rmSync(directory, { recursive: true, force: true });
}
}
main().catch(error => { console.error(error); process.exitCode = 1; });
