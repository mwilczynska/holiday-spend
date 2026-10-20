import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { sqlite } from '@/db';
import { analyticsContext } from './context';
import { BEHAVIOR_EVENTS, parseProperties, type AnalyticsEvent, type EventName, type EventProperties } from './catalogue';
import { getAnalyticsStore, insertAnalyticsEvent } from './storage';

export function accountAnalyticsId(userId: string) {
  return createHash('sha256').update('holiday-spend:analytics:' + userId).digest('hex');
}
export function analyticsEnabled(userId: string) {
  return (sqlite.prepare('SELECT enabled FROM analytics_preferences WHERE user_id = ?').get(userId) as { enabled: number } | undefined)?.enabled !== 0;
}
export function makeEvent<N extends EventName>(name: N, properties: EventProperties<N>, overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  const ctx = analyticsContext.getStore();
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), version: 1, name, occurredAt: now, receivedAt: now,
    source: 'server', purpose: BEHAVIOR_EVENTS.has(name) ? 'behavior' : name === 'admin_accessed' ? 'audit' : 'diagnostic',
    environment: process.env.HOLIDAY_SPEND_ANALYTICS_ENV || process.env.NODE_ENV || 'development',
    release: process.env.HOLIDAY_SPEND_RELEASE || 'local',
    accountId: ctx?.userId ? accountAnalyticsId(ctx.userId) : null, administrator: ctx?.administrator ?? false,
    sessionId: ctx?.sessionId ?? null, pageViewId: ctx?.pageViewId ?? null,
    operationId: ctx?.operationId ?? null, requestId: ctx?.requestId ?? null,
    route: ctx?.route ?? 'job', device: ctx?.device ?? 'unknown',
    ...overrides, properties: parseProperties(name, properties),
  };
}
export function enqueueEvent(event: AnalyticsEvent, userId = analyticsContext.getStore()?.userId) {
  if (event.purpose === 'behavior' && userId && !analyticsEnabled(userId)) return;
  sqlite.prepare('INSERT OR IGNORE INTO analytics_outbox(id,created_at,user_id,purpose,payload_json) VALUES (?,?,?,?,?)')
    .run(event.id, event.receivedAt, userId ?? null, event.purpose, JSON.stringify(event));
}
export function recordEvent<N extends EventName>(name: N, properties: EventProperties<N>, overrides?: Partial<AnalyticsEvent>) {
  try { enqueueEvent(makeEvent(name, properties, overrides)); }
  catch { console.warn(JSON.stringify({ component: 'analytics', code: 'event_enqueue_failed' })); }
}
const runtime = globalThis as typeof globalThis & { holidayAnalyticsWorker?: ReturnType<typeof setInterval> };
let lastError: string | null = null;
export function flushAnalytics() {
  try {
    const database = getAnalyticsStore();
    // Erasure markers are durable in travel.db, so a failure between the two databases is retried.
    const erasures = sqlite.prepare('SELECT user_id,before_at FROM analytics_erasure').all() as Array<{ user_id: string; before_at: string }>;
    let erased = false;
    database.transaction(() => {
      for (const erasure of erasures) {
        const account = accountAnalyticsId(erasure.user_id);
        erased = Boolean(database.prepare('DELETE FROM events WHERE account_id=? AND received_at<=?').run(account, erasure.before_at).changes) || erased;
        database.prepare('DELETE FROM llm_attempts WHERE account_id=? AND started_at<=?').run(account, erasure.before_at);
        database.prepare('DELETE FROM session_accounts WHERE account_id=?').run(account);
      }
      if (erased) database.exec(`DELETE FROM daily_counts; INSERT INTO daily_counts SELECT substr(received_at,1,10),name,environment,administrator,count(*) FROM events GROUP BY substr(received_at,1,10),name,environment,administrator`);
    })();
    const rows = sqlite.prepare('SELECT * FROM analytics_outbox ORDER BY created_at LIMIT 250').all() as Array<{ id: string; user_id: string | null; purpose: string; payload_json: string; created_at: string }>;
    database.transaction(() => {
      for (const row of rows) {
        const erased = row.user_id ? sqlite.prepare('SELECT before_at FROM analytics_erasure WHERE user_id=?').get(row.user_id) as { before_at: string } | undefined : undefined;
        if (erased && row.created_at <= erased.before_at) continue;
        if (row.purpose === 'behavior' && row.user_id && !analyticsEnabled(row.user_id)) continue;
        const event = JSON.parse(row.payload_json) as AnalyticsEvent;
        if (erased && event.occurredAt <= erased.before_at) continue;
        if (event.source === 'browser' && event.sessionId && event.accountId) {
          const binding = database.prepare('SELECT account_id FROM session_accounts WHERE session_id=?').get(event.sessionId) as { account_id: string } | undefined;
          if (!binding) {
            database.prepare('INSERT INTO session_accounts VALUES (?,?)').run(event.sessionId, event.accountId);
            database.prepare(`UPDATE events SET account_id=?,administrator=?,payload_json=json_set(payload_json,'$.accountId',?,'$.administrator',json(?)) WHERE session_id=? AND account_id IS NULL`)
              .run(event.accountId, Number(event.administrator), event.accountId, JSON.stringify(event.administrator), event.sessionId);
          }
        }
        if (insertAnalyticsEvent(database, event)) {
          database.prepare(`INSERT INTO daily_counts(day,name,environment,administrator,event_count) VALUES (?,?,?,?,1)
            ON CONFLICT(day,name,environment,administrator) DO UPDATE SET event_count=event_count+1`)
            .run(event.receivedAt.slice(0, 10), event.name, event.environment, Number(event.administrator));
        }
      }
      database.prepare(`INSERT OR REPLACE INTO collector_state(key,value) VALUES ('last_flush',?)`).run(new Date().toISOString());
    })();
    sqlite.transaction(() => {
      const remove = sqlite.prepare('DELETE FROM analytics_outbox WHERE id=?');
      for (const row of rows) remove.run(row.id);
    })();
    lastError = null;
  } catch { lastError = 'Analytics delivery failed'; console.warn(JSON.stringify({ component: 'analytics', code: 'delivery_failed' })); }
}
export function ensureAnalyticsWorker() {
  if (runtime.holidayAnalyticsWorker || process.env.NEXT_PHASE === 'phase-production-build' || process.env.VITEST) return;
  runtime.holidayAnalyticsWorker = setInterval(flushAnalytics, 5000);
  runtime.holidayAnalyticsWorker.unref();
  process.once('SIGTERM', flushAnalytics);
  flushAnalytics();
}
export function collectorHealth() {
  const outbox = sqlite.prepare('SELECT count(*) AS pending, min(created_at) AS oldest FROM analytics_outbox').get() as { pending: number; oldest: string | null };
  const store = getAnalyticsStore();
  let diskUsedPercent: number | null = null;
  try { const disk = fs.statfsSync(path.dirname(process.env.HOLIDAY_SPEND_DB_PATH || path.join(process.cwd(), 'data', 'travel.db'))); diskUsedPercent = disk.blocks ? Math.round((1 - disk.bavail / disk.blocks) * 100) : null; } catch { /* Unsupported filesystem. */ }
  return { ...outbox, bytes: (store.pragma('page_count', { simple: true }) as number) * (store.pragma('page_size', { simple: true }) as number), lastError,
    lastFlush: (store.prepare("SELECT value FROM collector_state WHERE key='last_flush'").get() as { value: string } | undefined)?.value ?? null,
    deliveryDelayed: Boolean(outbox.oldest && Date.now() - Date.parse(outbox.oldest) > 300_000), diskUsedPercent,
    diskAlert: diskUsedPercent == null ? 'unavailable' : diskUsedPercent >= 90 ? 'critical' : diskUsedPercent >= 80 ? 'warning' : 'ok',
  };
}
