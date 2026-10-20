import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { AnalyticsEvent } from './catalogue';
export function initializeAnalyticsStore(database: Database.Database) {
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 1000');
  database.exec(`
    CREATE TABLE IF NOT EXISTS events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      occurred_at TEXT NOT NULL, received_at TEXT NOT NULL, purpose TEXT NOT NULL,
      account_id TEXT, session_id TEXT, operation_id TEXT, request_id TEXT,
      environment TEXT NOT NULL, release TEXT NOT NULL, administrator INTEGER NOT NULL,
      route TEXT NOT NULL, device TEXT NOT NULL, payload_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_time ON events(received_at, sequence);
    CREATE INDEX IF NOT EXISTS events_name_time ON events(name, received_at);
    CREATE INDEX IF NOT EXISTS events_account_time ON events(account_id, received_at);
    CREATE INDEX IF NOT EXISTS events_operation ON events(operation_id);
    CREATE TABLE IF NOT EXISTS llm_attempts (
      id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, request_id TEXT, account_id TEXT,
      environment TEXT NOT NULL, release TEXT NOT NULL, administrator INTEGER NOT NULL DEFAULT 0,
      feature TEXT NOT NULL, provider TEXT NOT NULL, model TEXT, effort TEXT, prompt_hash TEXT,
      started_at TEXT NOT NULL, ended_at TEXT, duration_ms REAL, status TEXT NOT NULL,
      http_status INTEGER, provider_request_id TEXT, input_tokens INTEGER, output_tokens INTEGER,
      cached_tokens INTEGER, reasoning_tokens INTEGER, search_required INTEGER, search_used INTEGER,
      search_count INTEGER, output_limit INTEGER, timeout_ms INTEGER, attempt_number INTEGER NOT NULL,
      completion_status TEXT, retry_reason TEXT, metadata_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS llm_time ON llm_attempts(started_at);
    CREATE INDEX IF NOT EXISTS llm_operation ON llm_attempts(operation_id);
    CREATE TABLE IF NOT EXISTS daily_counts (
      day TEXT NOT NULL, name TEXT NOT NULL, environment TEXT NOT NULL, administrator INTEGER NOT NULL,
      event_count INTEGER NOT NULL, PRIMARY KEY(day,name,environment,administrator)
    );
    CREATE TABLE IF NOT EXISTS collector_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS session_accounts (session_id TEXT PRIMARY KEY, account_id TEXT NOT NULL);
  `);
}
let store: Database.Database | undefined;
export function getAnalyticsStore() {
  if (!store) {
    const travelPath = process.env.HOLIDAY_SPEND_DB_PATH || path.join(process.cwd(), 'data', 'travel.db');
    const filename = process.env.HOLIDAY_SPEND_ANALYTICS_DB_PATH || path.join(path.dirname(travelPath), 'analytics.db');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    store = new Database(filename);
    initializeAnalyticsStore(store);
  }
  return store;
}
export function insertAnalyticsEvent(database: Database.Database, event: AnalyticsEvent) {
  return database.prepare(`INSERT OR IGNORE INTO events
    (id,name,occurred_at,received_at,purpose,account_id,session_id,operation_id,request_id,environment,release,administrator,route,device,payload_json)
    VALUES (@id,@name,@occurredAt,@receivedAt,@purpose,@accountId,@sessionId,@operationId,@requestId,@environment,@release,@administrator,@route,@device,@payload)`)
    .run({ ...event, administrator: Number(event.administrator), payload: JSON.stringify(event) }).changes;
}
export function initializeAnalyticsPrimary(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS analytics_preferences (
      user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE, enabled INTEGER NOT NULL DEFAULT 1, changed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analytics_outbox (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, user_id TEXT, purpose TEXT NOT NULL, payload_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS analytics_outbox_time ON analytics_outbox(created_at);
    CREATE TABLE IF NOT EXISTS plan_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL, operation_id TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL, summary_json TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS revisions_user_subject ON plan_revisions(user_id,subject_id,id);
    CREATE INDEX IF NOT EXISTS revisions_time ON plan_revisions(created_at,id);
    CREATE TABLE IF NOT EXISTS analytics_erasure (user_id TEXT PRIMARY KEY, before_at TEXT NOT NULL);
  `);
}
