import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeAnalyticsStore, insertAnalyticsEvent } from './storage';
import type { AnalyticsEvent } from './catalogue';
const databases: Database.Database[] = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });
function fixture() { const database = new Database(':memory:'); databases.push(database); initializeAnalyticsStore(database); return database; }
function value(id: string): AnalyticsEvent {
  return { id, name: 'page_viewed', version: 1, occurredAt: '2026-09-01T10:00:00.000Z', receivedAt: '2026-09-01T10:00:00.000Z', source: 'browser', purpose: 'behavior', environment: 'test', release: 'fixture', accountId: null, administrator: false, sessionId: 'session', pageViewId: null, operationId: null, requestId: null, route: '/plan', device: 'desktop', properties: {} };
}
describe('exact overview summaries', () => {
  it('deduplicates delivery, moves anonymous activity to an account and removes erased contributions', () => {
    const database = fixture();
    insertAnalyticsEvent(database, value('one')); insertAnalyticsEvent(database, value('one')); insertAnalyticsEvent(database, value('two'));
    expect(database.prepare('SELECT account_id,administrator,event_count FROM event_rollups').all()).toEqual([{ account_id: '', administrator: 0, event_count: 2 }]);
    database.prepare("UPDATE events SET account_id='owner',administrator=1 WHERE id='one'").run();
    expect(database.prepare('SELECT account_id,event_count FROM event_rollups ORDER BY account_id').all()).toEqual([{ account_id: '', event_count: 1 }, { account_id: 'owner', event_count: 1 }]);
    database.prepare("DELETE FROM events WHERE account_id='owner'").run();
    expect(database.prepare('SELECT account_id,event_count FROM event_rollups').all()).toEqual([{ account_id: '', event_count: 1 }]);
    database.exec('DELETE FROM events'); expect(database.prepare('SELECT * FROM event_rollups').all()).toEqual([]);
    expect(database.prepare('SELECT * FROM event_sessions').all()).toEqual([]);
  });
  it('backfills existing events once without changing raw records', () => {
    const database = fixture();
    insertAnalyticsEvent(database, value('one')); insertAnalyticsEvent(database, value('two'));
    database.exec("DROP TRIGGER overview_insert; DROP TRIGGER overview_update; DROP TRIGGER overview_delete; DELETE FROM event_rollups; DELETE FROM collector_state WHERE key='overview_rollup_version'");
    const before = database.prepare('SELECT * FROM events').all();
    initializeAnalyticsStore(database); initializeAnalyticsStore(database);
    expect(database.prepare('SELECT event_count FROM event_rollups').all()).toEqual([{ event_count: 2 }]);
    expect(database.prepare('SELECT * FROM events').all()).toEqual(before);
  });
  it('rolls summary changes back together with event changes', () => {
    const database = fixture(); insertAnalyticsEvent(database, value('one'));
    expect(() => database.transaction(() => { database.exec('DELETE FROM events'); insertAnalyticsEvent(database, value('two')); throw new Error('rollback'); })()).toThrow('rollback');
    expect(database.prepare('SELECT id FROM events').all()).toEqual([{ id: 'one' }]);
    expect(database.prepare('SELECT event_count FROM event_rollups').all()).toEqual([{ event_count: 1 }]);
  });
});
