import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./storage', async importOriginal => {
  const actual = await importOriginal<typeof import('./storage')>();
  const { default: Database } = await import('better-sqlite3');
  const store = new Database(':memory:'); actual.initializeAnalyticsStore(store);
  return { ...actual, getAnalyticsStore: () => store };
});
vi.mock('./service', () => ({ collectorHealth: () => ({ pending: 0 }) }));
import { buildAnalyticsReport, parseReportQuery } from './reports';
import { getAnalyticsStore, insertAnalyticsEvent } from './storage';
import type { AnalyticsEvent, EventName } from './catalogue';
const read: import('./reader').AnalyticsReader = async (sql, bindings, mode = 'all') => {
  const statement = getAnalyticsStore().prepare(sql);
  return mode === 'get' ? statement.get(bindings ?? {}) : statement.all(bindings ?? {});
};
const account = 'a'.repeat(64);
function event(name: EventName, date: string, properties: unknown, administrator = false) {
  const value: AnalyticsEvent = { id: crypto.randomUUID(), name, version: 1, occurredAt: date, receivedAt: date, source: 'server', purpose: 'behavior', environment: 'test', release: 'fixture', accountId: account, administrator, sessionId: 'session', pageViewId: null, operationId: 'operation', requestId: null, route: '/plan', device: 'desktop', properties };
  insertAnalyticsEvent(getAnalyticsStore(), value);
}
beforeEach(() => getAnalyticsStore().exec('DELETE FROM events'));
afterAll(() => getAnalyticsStore().close());
describe('analytics reporting semantics', () => {
  it('counts ordered planning funnel stages once and excludes admins by default', async () => {
    event('page_viewed', '2026-09-01T10:00:00.000Z', {});
    event('mutation_committed', '2026-09-01T10:01:00.000Z', { action: 'leg_created' });
    event('mutation_committed', '2026-09-01T10:02:00.000Z', { action: 'plan_saved' });
    event('mutation_committed', '2026-09-01T10:03:00.000Z', { action: 'plan_saved' });
    const report = await buildAnalyticsReport(parseReportQuery(new URLSearchParams({ view: 'funnels', from: '2026-09-01', to: '2026-09-02', environment: 'test', account })), read);
    expect('funnels' in report && report.funnels?.find(f => f.name === 'Planning')?.steps.map(s => s.users)).toEqual([1, 1, 1]);
    event('page_viewed', '2026-09-01T11:00:00.000Z', {}, true);
    const overview = await buildAnalyticsReport(parseReportQuery(new URLSearchParams({ from: '2026-09-01', to: '2026-09-02', environment: 'test' })), read);
    expect('totals' in overview && overview.totals).toMatchObject({ events: 4 });
  });
  it('counts mature retention beyond the cohort date window and rejects unbounded ranges', async () => {
    event('mutation_committed', '2026-08-01T10:00:00.000Z', { action: 'leg_created' });
    event('page_viewed', '2026-08-08T10:00:00.000Z', {});
    const report = await buildAnalyticsReport(parseReportQuery(new URLSearchParams({ view: 'funnels', from: '2026-08-01', to: '2026-08-01', environment: 'test', account })), read);
    expect('retention' in report && report.retention?.find(r => r.day === 7)).toMatchObject({ eligible: 1, returned: 1 });
    expect(() => parseReportQuery(new URLSearchParams({ from: '2020-01-01', to: '2026-01-01' }))).toThrow();
  });
  it('keeps activated accounts with no return in retention denominators', async () => {
    event('mutation_committed', '2026-08-01T10:00:00.000Z', { action: 'leg_created' });
    const report = await buildAnalyticsReport(parseReportQuery(new URLSearchParams({ view: 'funnels', from: '2026-08-01', to: '2026-08-01', environment: 'test', account })), read);
    expect('retention' in report && report.retention?.find(r => r.day === 7)).toMatchObject({ eligible: 1, returned: 0 });
  });
});
