import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { AnalyticsEvent } from './catalogue';
export function initializeAnalyticsStore(database: Database.Database) {
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 1000');
  database.pragma('cache_size = -16384');
  database.pragma('mmap_size = 134217728');
  database.exec(`
    CREATE TABLE IF NOT EXISTS events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      occurred_at TEXT NOT NULL, received_at TEXT NOT NULL, purpose TEXT NOT NULL,
      account_id TEXT, session_id TEXT, operation_id TEXT, request_id TEXT,
      environment TEXT NOT NULL, release TEXT NOT NULL, administrator INTEGER NOT NULL,
      route TEXT NOT NULL, device TEXT NOT NULL, payload_json TEXT NOT NULL,
      status INTEGER, duration_ms REAL, stage_value TEXT, control_id TEXT, metric_name TEXT, metric_value REAL
    );
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
    CREATE INDEX IF NOT EXISTS session_accounts_account ON session_accounts(account_id);
    CREATE TABLE IF NOT EXISTS export_jobs (
      id TEXT PRIMARY KEY, requested_by TEXT NOT NULL, state TEXT NOT NULL, query_json TEXT NOT NULL,
      cursor INTEGER NOT NULL DEFAULT 0, maximum INTEGER NOT NULL, created_at TEXT NOT NULL, error_code TEXT
    );
    CREATE TABLE IF NOT EXISTS export_chunks (
      job_id TEXT NOT NULL, part INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(job_id,part)
    );
    CREATE INDEX IF NOT EXISTS export_jobs_state ON export_jobs(state,created_at);
    CREATE INDEX IF NOT EXISTS llm_status_time ON llm_attempts(status,started_at);
  `);
  const columns = new Set((database.pragma('table_info(events)') as Array<{ name: string }>).map(column => column.name));
  let upgraded = false;
  for (const [name, type] of Object.entries({ status: 'INTEGER', duration_ms: 'REAL', stage_value: 'TEXT', control_id: 'TEXT', metric_name: 'TEXT', metric_value: 'REAL' })) {
    if (!columns.has(name)) { database.exec(`ALTER TABLE events ADD COLUMN ${name} ${type}`); upgraded = true; }
  }
  if (upgraded) database.exec(`UPDATE events SET status=json_extract(payload_json,'$.properties.status'),duration_ms=json_extract(payload_json,'$.properties.durationMs'),stage_value=coalesce(json_extract(payload_json,'$.properties.action'),json_extract(payload_json,'$.properties.step'),json_extract(payload_json,'$.properties.resource')),control_id=json_extract(payload_json,'$.properties.control'),metric_name=json_extract(payload_json,'$.properties.metric'),metric_value=json_extract(payload_json,'$.properties.value')`);
  database.exec(`
    CREATE INDEX IF NOT EXISTS events_overview ON events(environment,administrator,received_at,name,purpose,route,account_id,session_id,status);
    CREATE INDEX IF NOT EXISTS events_timeline_all ON events(environment,sequence);
    CREATE INDEX IF NOT EXISTS events_funnel ON events(environment,name,route,stage_value,coalesce(account_id,session_id),sequence,received_at,administrator,status);
    CREATE INDEX IF NOT EXISTS events_health ON events(environment,administrator,name,received_at,route,status,duration_ms);
    CREATE INDEX IF NOT EXISTS events_anonymous_session ON events(session_id) WHERE account_id IS NULL;
    DROP INDEX IF EXISTS events_time;
    DROP INDEX IF EXISTS events_name_time;
    DROP INDEX IF EXISTS events_identity_time;
    DROP INDEX IF EXISTS events_timeline;
    DROP INDEX IF EXISTS events_account_sequence;
    DROP INDEX IF EXISTS events_controls;
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
const insertStatements = new WeakMap<Database.Database, Database.Statement>();
export function insertAnalyticsEvent(database: Database.Database, event: AnalyticsEvent) {
  let statement = insertStatements.get(database);
  if (!statement) {
    statement = database.prepare(`INSERT OR IGNORE INTO events
      (id,name,occurred_at,received_at,purpose,account_id,session_id,operation_id,request_id,environment,release,administrator,route,device,payload_json,status,duration_ms,stage_value,control_id,metric_name,metric_value)
      VALUES (@id,@name,@occurredAt,@receivedAt,@purpose,@accountId,@sessionId,@operationId,@requestId,@environment,@release,@administrator,@route,@device,@payload,@status,@duration,@stage,@control,@metric,@metricValue)`);
    insertStatements.set(database, statement);
  }
  const p = event.properties as Record<string, unknown>;
  return statement.run({ ...event, administrator: Number(event.administrator), payload: JSON.stringify(event),
    status: typeof p.status === 'number' ? p.status : null, duration: typeof p.durationMs === 'number' ? p.durationMs : null,
    stage: typeof p.action === 'string' ? p.action : typeof p.step === 'string' ? p.step : typeof p.resource === 'string' ? p.resource : null,
    control: typeof p.control === 'string' ? p.control : null, metric: typeof p.metric === 'string' ? p.metric : null, metricValue: typeof p.value === 'number' ? p.value : null,
  }).changes;
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
