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
function event(name: EventName, date: string, properties: unknown, administrator = false, overrides: Partial<AnalyticsEvent> = {}) {
  const value: AnalyticsEvent = { id: crypto.randomUUID(), name, version: 1, occurredAt: date, receivedAt: date, source: 'server', purpose: 'behavior', environment: 'test', release: 'fixture', accountId: account, administrator, sessionId: 'session', pageViewId: null, operationId: 'operation', requestId: null, route: '/plan', device: 'desktop', properties, ...overrides };
  insertAnalyticsEvent(getAnalyticsStore(), value);
}
beforeEach(() => getAnalyticsStore().exec('DELETE FROM events'));
afterAll(() => getAnalyticsStore().close());
describe('analytics reporting semantics', () => {
  it('preserves exact accounts, sessions, days and filters in summarized overview reads', async () => {
    const operation = crypto.randomUUID();
    event('page_viewed', '2026-09-01T10:00:00.000Z', {}, false, { operationId: operation });
    event('control_activated', '2026-09-01T10:01:00.000Z', { control: 'plan.add' }, false, { operationId: operation });
    event('page_viewed', '2026-09-01T11:00:00.000Z', {}, false, { accountId: null, sessionId: 'anonymous', route: '/track', device: 'mobile', release: 'older' });
    event('page_viewed', '2026-09-02T10:00:00.000Z', {}, false, { accountId: 'b'.repeat(64), sessionId: 'second', device: 'mobile' });
    event('request_completed', '2026-09-02T10:01:00.000Z', { status: 500 }, false, { accountId: 'b'.repeat(64), sessionId: 'second', device: 'mobile', purpose: 'diagnostic' });
    event('page_viewed', '2026-09-02T11:00:00.000Z', {}, true, { accountId: 'c'.repeat(64), sessionId: 'admin' });
    const query = (extra = {}) => parseReportQuery(new URLSearchParams({ from: '2026-09-01', to: '2026-09-02', environment: 'test', ...extra }));
    const report = await buildAnalyticsReport(query(), read);
    expect('totals' in report && report.totals).toEqual({ events: 5, activeAccounts: 2, sessions: 3, failedRequests: 1, requests: 1 });
    expect('daily' in report && report.daily).toEqual([{ day: '2026-09-01', events: 3, accounts: 1 }, { day: '2026-09-02', events: 2, accounts: 1 }]);
    for (const filters of [{ account }, { release: 'fixture', device: 'desktop' }, { operation }]) {
      const filtered = await buildAnalyticsReport(query(filters), read);
      expect('totals' in filtered && filtered.totals).toMatchObject({ events: 2, activeAccounts: 1, sessions: 1 });
    }
    const included = await buildAnalyticsReport(query({ includeAdmins: 'true' }), read);
    expect('totals' in included && included.totals).toMatchObject({ events: 6, activeAccounts: 3 });
    const expenses = await buildAnalyticsReport(query({ feature: 'expenses' }), read);
    expect('totals' in expenses && expenses.totals).toMatchObject({ events: 1, activeAccounts: 0 });
  });
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
  it('keeps operation-filtered retention on exact raw events', async () => {
    const operation = crypto.randomUUID();
    const other = crypto.randomUUID();
    event('mutation_committed', '2026-08-01T10:00:00.000Z', { action: 'leg_created' }, false, { operationId: operation });
    event('page_viewed', '2026-08-02T10:00:00.000Z', {}, false, { operationId: other });
    event('page_viewed', '2026-08-08T10:00:00.000Z', {}, false, { operationId: operation });
    const report = await buildAnalyticsReport(parseReportQuery(new URLSearchParams({ view: 'funnels', from: '2026-08-01', to: '2026-08-01', environment: 'test', operation })), read);
    expect('retention' in report && report.retention).toEqual([{ day: 1, eligible: 1, returned: 0 }, { day: 7, eligible: 1, returned: 1 }, { day: 30, eligible: 1, returned: 0 }]);
  });
  it('keeps activated accounts with no return in retention denominators', async () => {
    event('mutation_committed', '2026-08-01T10:00:00.000Z', { action: 'leg_created' });
    const report = await buildAnalyticsReport(parseReportQuery(new URLSearchParams({ view: 'funnels', from: '2026-08-01', to: '2026-08-01', environment: 'test', account })), read);
    expect('retention' in report && report.retention?.find(r => r.day === 7)).toMatchObject({ eligible: 1, returned: 0 });
  });
});
