import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

async function main() {
const count = Number(process.argv[2] || 1000000);
if (!Number.isSafeInteger(count) || count < 1 || count > 2000000) throw new Error('Use 1–2,000,000 fixture events.');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-analytics-benchmark-'));
process.env.HOLIDAY_SPEND_DB_PATH = path.join(directory, 'travel.db');
process.env.HOLIDAY_SPEND_ANALYTICS_DB_PATH = path.join(directory, 'analytics.db');
process.env.HOLIDAY_SPEND_ANALYTICS_ENV = 'test';
const { getAnalyticsStore, insertAnalyticsEvent } = await import('../src/lib/analytics/storage');
const { buildAnalyticsReport, parseReportQuery } = await import('../src/lib/analytics/reports');
const { sqlite, db } = await import('../src/db');
const { analyticsTestDatabase } = await import('../src/lib/analytics/test-fixture');
const { withPlanRevision } = await import('../src/lib/analytics/history');
const store = getAnalyticsStore();
try {
  const start = performance.now();
  for (let batch = 0; batch < count; batch += 1000) {
  store.transaction(() => {
    for (let i = batch; i < Math.min(batch + 1000, count); i++) {
      const time = new Date(Date.UTC(2026, 8, 1) + (i % (30 * 86400)) * 1000).toISOString();
      insertAnalyticsEvent(store, { id: 'fixture-' + i, name: i % 5 ? 'page_viewed' : 'request_completed', version: 1, occurredAt: time, receivedAt: time,
        source: i % 5 ? 'browser' : 'server', purpose: i % 5 ? 'behavior' : 'diagnostic', environment: 'test', release: 'fixture',
        accountId: (i % 1000).toString(16).padStart(64, '0'), administrator: false, sessionId: 'session-' + (i % 10000), pageViewId: null,
        operationId: null, requestId: null, route: '/plan', device: 'desktop', properties: i % 5 ? {} : { method: 'GET', status: 200, durationMs: 10, resource: 'itinerary', outcome: 'success' },
      });
    }
  })();
  if ((batch + 1000) % 100000 === 0) console.log('Fixture events committed: ' + Math.min(batch + 1000, count));
  }
  const ingestionMs = performance.now() - start;
  const timings: Record<string, number> = {};
  for (const view of ['overview', 'journeys', 'funnels', 'llm', 'health']) {
    const at = performance.now();
    await buildAnalyticsReport(parseReportQuery(new URLSearchParams({ view, from: '2026-09-01', to: '2026-09-30', environment: 'test' })));
    timings[view] = Math.round(performance.now() - at);
  }
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
  const output = { fixtureEvents: count, ingestionMs: Math.round(ingestionMs), queryMs: timings, mutationAddedP95Ms: addedP95Ms, browserSourceGzipBytes: browserBytes,
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
  fs.rmSync(directory, { recursive: true, force: true });
}
}
main().catch(error => { console.error(error); process.exitCode = 1; });
