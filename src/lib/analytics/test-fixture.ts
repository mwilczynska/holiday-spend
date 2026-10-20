import Database from 'better-sqlite3';
import { is, SQL } from 'drizzle-orm';
import { SQLiteTable, SQLiteSyncDialect, getTableConfig } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { initializeAnalyticsPrimary } from './storage';
/** Complete isolated schema for history tests; never reads the owner's database. */
export function analyticsTestDatabase() {
  const sqlite = new Database(':memory:');
  const dialect = new SQLiteSyncDialect();
  for (const table of Object.values(schema)) {
    if (!is(table, SQLiteTable)) continue;
    const config = getTableConfig(table);
    const columns = config.columns.map(column => {
      let sql = '"' + column.name + '" ' + column.getSQLType();
      if (column.primary) sql += ' PRIMARY KEY';
      if (column.default !== undefined) sql += ' DEFAULT ' + (column.default instanceof SQL ? dialect.sqlToQuery(column.default).sql : typeof column.default === 'string' ? "'" + column.default.replaceAll("'", "''") + "'" : column.default);
      return sql;
    });
    for (const key of config.primaryKeys) columns.push('PRIMARY KEY (' + key.columns.map(c => '"' + c.name + '"').join(',') + ')');
    sqlite.exec(`CREATE TABLE "${config.name}" (${columns.join(',')})`);
  }
  initializeAnalyticsPrimary(sqlite);
  return { sqlite, db: drizzle(sqlite, { schema }), schema };
}
