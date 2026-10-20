import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/db', async () => (await import('./test-fixture')).analyticsTestDatabase());
vi.mock('./storage', async importOriginal => {
  const actual = await importOriginal<typeof import('./storage')>();
  const { default: Database } = await import('better-sqlite3');
  const store = new Database(':memory:'); actual.initializeAnalyticsStore(store);
  return { ...actual, getAnalyticsStore: () => store };
});
import { sqlite } from '@/db';
import { accountAnalyticsId, enqueueEvent, flushAnalytics, makeEvent } from './service';
import { getAnalyticsStore, insertAnalyticsEvent } from './storage';
beforeEach(() => {
  sqlite.exec("DELETE FROM analytics_outbox; DELETE FROM analytics_preferences; DELETE FROM analytics_erasure; INSERT OR IGNORE INTO user(id) VALUES ('owner');");
  getAnalyticsStore().exec('DELETE FROM events; DELETE FROM daily_counts; DELETE FROM session_accounts;');
});
afterAll(() => { sqlite.close(); getAnalyticsStore().close(); });
const userEvent = () => makeEvent('page_viewed', {}, { accountId: accountAnalyticsId('owner'), source: 'browser', route: '/plan', sessionId: crypto.randomUUID() });
describe('durable analytics delivery', () => {
  it('safely replays a destination commit whose primary acknowledgement was lost', () => {
    const event = userEvent(); enqueueEvent(event, 'owner');
    insertAnalyticsEvent(getAnalyticsStore(), event);
    getAnalyticsStore().prepare('INSERT INTO daily_counts VALUES (?,?,?,?,1)').run(event.receivedAt.slice(0, 10), event.name, event.environment, 0);
    flushAnalytics();
    expect(sqlite.prepare('SELECT count(*) AS n FROM analytics_outbox').get()).toEqual({ n: 0 });
    expect(getAnalyticsStore().prepare('SELECT count(*) AS n FROM events').get()).toEqual({ n: 1 });
    expect(getAnalyticsStore().prepare('SELECT event_count FROM daily_counts').get()).toEqual({ event_count: 1 });
  });
  it('suppresses queued behavioral events after opt-out while keeping diagnostics', () => {
    enqueueEvent(userEvent(), 'owner');
    sqlite.prepare('INSERT INTO analytics_preferences VALUES (?,0,?)').run('owner', new Date().toISOString());
    enqueueEvent(makeEvent('request_completed', { method: 'PUT', status: 503, durationMs: 10, resource: 'settings.currency', outcome: 'failure' }), 'owner');
    flushAnalytics();
    expect(getAnalyticsStore().prepare('SELECT name FROM events').all()).toEqual([{ name: 'request_completed' }]);
  });
  it('retains the outbox through destination failure and delivers it after recovery', () => {
    enqueueEvent(userEvent(), 'owner');
    getAnalyticsStore().exec("CREATE TRIGGER reject_event BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    flushAnalytics();
    expect(sqlite.prepare('SELECT count(*) AS n FROM analytics_outbox').get()).toEqual({ n: 1 });
    getAnalyticsStore().exec('DROP TRIGGER reject_event'); flushAnalytics(); warning.mockRestore();
    expect(getAnalyticsStore().prepare('SELECT count(*) AS n FROM events').get()).toEqual({ n: 1 });
  });
  it('reapplies a durable erasure marker and prevents replay from restoring erased events', () => {
    const event = { ...userEvent(), occurredAt: '2026-01-01T00:00:00.000Z', receivedAt: '2026-01-01T00:00:00.000Z' };
    enqueueEvent(event, 'owner'); insertAnalyticsEvent(getAnalyticsStore(), event);
    sqlite.prepare('INSERT INTO analytics_erasure VALUES (?,?)').run('owner', '2026-02-01T00:00:00.000Z');
    flushAnalytics();
    expect(getAnalyticsStore().prepare('SELECT count(*) AS n FROM events').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM analytics_outbox').get()).toEqual({ n: 0 });
  });
});
