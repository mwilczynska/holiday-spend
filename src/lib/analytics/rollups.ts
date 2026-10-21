import type Database from 'better-sqlite3';

// Operation-specific reports use raw events. All other overview filters are represented here.
const dimensions = ['environment', 'administrator', 'day', 'route', 'purpose', 'name', 'stage_value', 'account_id', 'release', 'device', 'control_id', 'failed'] as const;
const sessionDimensions = ['environment', 'administrator', 'day', 'route', 'account_id', 'session_id', 'release', 'device'] as const;
const key = dimensions.join(',');
const sessionKey = sessionDimensions.join(',');
function values(prefix: string, columns: readonly string[] = dimensions) {
  const field = (name: string) => prefix ? prefix + '.' + name : name;
  return columns.map(name => name === 'day' ? `substr(${field('received_at')},1,10)`
    : ['account_id', 'session_id', 'control_id', 'stage_value'].includes(name) ? `coalesce(${field(name)},'')`
    : name === 'failed' ? `CASE WHEN ${field('name')}='request_completed' AND ${field('status')}>=400 THEN 1 ELSE 0 END` : field(name));
}
const insert = (prefix: string) => `INSERT INTO event_rollups(${key},event_count) VALUES (${values(prefix).join(',')},1)
  ON CONFLICT(${key}) DO UPDATE SET event_count=event_count+1;
  INSERT INTO event_sessions(${sessionKey},event_count) SELECT ${values(prefix, sessionDimensions).join(',')},1
    WHERE ${prefix}.purpose='behavior' AND ${prefix}.session_id IS NOT NULL
    ON CONFLICT(${sessionKey}) DO UPDATE SET event_count=event_count+1;`;
const remove = (prefix: string) => {
  const match = dimensions.map((name, i) => `${name}=${values(prefix)[i]}`).join(' AND ');
  const sessionMatch = sessionDimensions.map((name, i) => `${name}=${values(prefix, sessionDimensions)[i]}`).join(' AND ') + ` AND ${prefix}.purpose='behavior' AND ${prefix}.session_id IS NOT NULL`;
  return `UPDATE event_rollups SET event_count=event_count-1 WHERE ${match}; DELETE FROM event_rollups WHERE ${match} AND event_count=0;
    UPDATE event_sessions SET event_count=event_count-1 WHERE ${sessionMatch}; DELETE FROM event_sessions WHERE ${sessionMatch} AND event_count=0;`;
};
export function rebuildAnalyticsRollups(database: Database.Database) {
  database.exec(`DELETE FROM event_rollups; INSERT INTO event_rollups(${key},event_count)
    SELECT ${values('').join(',')},count(*) FROM events GROUP BY ${dimensions.map((_, i) => i + 1).join(',')};
    DELETE FROM event_sessions; INSERT INTO event_sessions(${sessionKey},event_count)
    SELECT ${values('', sessionDimensions).join(',')},count(*) FROM events WHERE purpose='behavior' AND session_id IS NOT NULL
    GROUP BY ${sessionDimensions.map((_, i) => i + 1).join(',')}`);
}
export function initializeAnalyticsRollups(database: Database.Database) {
  database.transaction(() => {
    const version = database.prepare("SELECT value FROM collector_state WHERE key='overview_rollup_version'").get() as { value: string } | undefined;
    if (version?.value !== '3') database.exec('DROP TRIGGER IF EXISTS overview_insert; DROP TRIGGER IF EXISTS overview_delete; DROP TRIGGER IF EXISTS overview_update; DROP TABLE IF EXISTS event_rollups; DROP TABLE IF EXISTS event_sessions;');
    database.exec(`CREATE TABLE IF NOT EXISTS event_rollups (
      environment TEXT NOT NULL,administrator INTEGER NOT NULL,day TEXT NOT NULL,route TEXT NOT NULL,
      purpose TEXT NOT NULL,name TEXT NOT NULL,stage_value TEXT NOT NULL,account_id TEXT NOT NULL,
      release TEXT NOT NULL,device TEXT NOT NULL,control_id TEXT NOT NULL,failed INTEGER NOT NULL,
      event_count INTEGER NOT NULL CHECK(event_count>=0),PRIMARY KEY(${key})
    ) WITHOUT ROWID;`);
    database.exec(`CREATE TABLE IF NOT EXISTS event_sessions (
      environment TEXT NOT NULL,administrator INTEGER NOT NULL,day TEXT NOT NULL,route TEXT NOT NULL,
      account_id TEXT NOT NULL,session_id TEXT NOT NULL,release TEXT NOT NULL,device TEXT NOT NULL,
      event_count INTEGER NOT NULL CHECK(event_count>=0),PRIMARY KEY(${sessionKey})
    ) WITHOUT ROWID;`);
    database.exec("CREATE INDEX IF NOT EXISTS event_rollups_account_day ON event_rollups(account_id,day) WHERE purpose='behavior' AND account_id!=''");
    if (version?.value !== '3') {
      rebuildAnalyticsRollups(database);
      database.prepare("INSERT OR REPLACE INTO collector_state VALUES ('overview_rollup_version','3')").run();
    }
    // Triggers keep delivery deduplication, anonymous-account association and erasure atomic.
    database.exec(`CREATE TRIGGER IF NOT EXISTS overview_insert AFTER INSERT ON events BEGIN ${insert('NEW')} END;
      CREATE TRIGGER IF NOT EXISTS overview_delete AFTER DELETE ON events BEGIN ${remove('OLD')} END;
      CREATE TRIGGER IF NOT EXISTS overview_update AFTER UPDATE ON events BEGIN ${remove('OLD')} ${insert('NEW')} END;`);
  })();
}
