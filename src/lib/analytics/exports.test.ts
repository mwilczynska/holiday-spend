import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./storage', async importOriginal => {
  const actual = await importOriginal<typeof import('./storage')>();
  const { default: Database } = await import('better-sqlite3');
  const store = new Database(':memory:'); actual.initializeAnalyticsStore(store);
  return { ...actual, getAnalyticsStore: () => store };
});
vi.mock('./service', () => ({ collectorHealth: () => ({ pending: 0 }) }));
import { getAnalyticsStore, insertAnalyticsEvent } from './storage';
import { requestAnalyticsExport, processAnalyticsExports, analyticsExportResponse } from './exports';
import { parseReportQuery } from './reports';
const read: import('./reader').AnalyticsReader = async (sql, bindings, mode = 'all') => {
  const statement = getAnalyticsStore().prepare(sql);
  return mode === 'get' ? statement.get(bindings ?? {}) : statement.all(bindings ?? {});
};
beforeEach(() => getAnalyticsStore().exec('DELETE FROM export_chunks; DELETE FROM export_jobs; DELETE FROM events;'));
afterAll(() => getAnalyticsStore().close());
function insert(n: number) {
  getAnalyticsStore().transaction(() => {
  for (let i = 0; i < n; i++) insertAnalyticsEvent(getAnalyticsStore(), { id: crypto.randomUUID(), name: 'page_viewed', version: 1, occurredAt: '2026-10-01T00:00:00.000Z', receivedAt: '2026-10-01T00:00:00.000Z', source: 'browser', purpose: 'behavior', environment: 'test', release: 'fixture', accountId: null, administrator: false, sessionId: null, pageViewId: null, operationId: null, requestId: null, route: '/plan', device: 'desktop', properties: {} });
  })();
}
describe('background event exports', () => {
  it('resumes bounded chunks and limits download to the requesting administrator', async () => {
    insert(5000);
    const job = requestAnalyticsExport(parseReportQuery(new URLSearchParams({ view: 'journeys', from: '2026-10-01', to: '2026-10-02', environment: 'test' })), 'owner');
    await processAnalyticsExports(read);
    expect((await analyticsExportResponse(job.id, 'owner', false).json()).data.state).toBe('running');
    insert(1); // A later event is outside the export's fixed upper sequence.
    await processAnalyticsExports(read); await processAnalyticsExports(read);
    expect(analyticsExportResponse(job.id, 'other-admin', true).status).toBe(404);
    const response = analyticsExportResponse(job.id, 'owner', true);
    expect(response.status).toBe(200);
    expect((await response.text()).trim().split('\n')).toHaveLength(5000);
  });
  it('does not recreate chunks after an export is erased during a query', async () => {
    insert(1);
    const job = requestAnalyticsExport(parseReportQuery(new URLSearchParams({ from: '2026-10-01', to: '2026-10-02', environment: 'test' })), 'owner');
    await processAnalyticsExports(async (...args) => {
      const rows = await read(...args);
      getAnalyticsStore().exec('DELETE FROM export_jobs; DELETE FROM export_chunks;');
      return rows;
    });
    expect(analyticsExportResponse(job.id, 'owner', true).status).toBe(404);
    expect(getAnalyticsStore().prepare('SELECT count(*) AS n FROM export_chunks').get()).toEqual({ n: 0 });
  });
});
