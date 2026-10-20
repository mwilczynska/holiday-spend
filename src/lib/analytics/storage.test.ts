import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { browserBatchSchema, type AnalyticsEvent } from './catalogue';
import { initializeAnalyticsStore, insertAnalyticsEvent } from './storage';
const event: AnalyticsEvent = { id: crypto.randomUUID(), name: 'page_viewed', version: 1, occurredAt: new Date().toISOString(), receivedAt: new Date().toISOString(), source: 'browser', purpose: 'behavior', environment: 'test', release: 'fixture', accountId: null, administrator: false, sessionId: crypto.randomUUID(), pageViewId: crypto.randomUUID(), operationId: null, requestId: null, route: '/plan', device: 'desktop', properties: {} };
describe('analytics collection contract', () => {
  it('deduplicates replayed event IDs without losing the first observation', () => {
    const database = new Database(':memory:'); initializeAnalyticsStore(database);
    expect(insertAnalyticsEvent(database, event)).toBe(1);
    expect(insertAnalyticsEvent(database, { ...event, route: '/settings' })).toBe(0);
    expect(database.prepare('SELECT route FROM events').get()).toEqual({ route: '/plan' }); database.close();
  });
  it('rejects server event forgery, personal properties and oversized batches', () => {
    const browser = { id: event.id, name: 'page_viewed', version: 1, occurredAt: event.occurredAt, sessionId: event.sessionId, pageViewId: event.pageViewId, route: '/plan', properties: {} };
    expect(browserBatchSchema.safeParse({ events: [browser] }).success).toBe(true);
    for (const invalid of [{ ...browser, accountId: 'owner' }, { ...browser, properties: { email: 'private@example.test' } }, { ...browser, name: 'mutation_committed' }, { ...browser, route: '/reset-password?token=secret' }]) expect(browserBatchSchema.safeParse({ events: [invalid] }).success).toBe(false);
    expect(browserBatchSchema.safeParse({ events: Array(51).fill(browser) }).success).toBe(false);
  });
});
