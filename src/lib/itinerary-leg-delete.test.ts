import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  requireCurrentUserId: vi.fn(async () => 'delete-test-user'),
}));

type DbModule = typeof import('@/db');
type DeleteRouteModule = typeof import('@/app/api/itinerary/legs/[id]/route');

let dbModule: DbModule;
let deleteRouteModule: DeleteRouteModule;
let tempDir: string;
const originalCwd = process.cwd();

describe.sequential('itinerary leg deletion', () => {
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-itinerary-delete-'));
    process.chdir(tempDir);
    vi.resetModules();

    dbModule = await import('@/db');
    dbModule.sqlite.exec([
      'CREATE TABLE IF NOT EXISTS countries (',
      '  id TEXT PRIMARY KEY,',
      '  name TEXT NOT NULL,',
      '  currency_code TEXT NOT NULL,',
      '  region TEXT',
      ');',
      'CREATE TABLE IF NOT EXISTS cities (',
      '  id TEXT PRIMARY KEY,',
      '  country_id TEXT NOT NULL REFERENCES countries(id),',
      '  name TEXT NOT NULL',
      ');',
      'CREATE TABLE IF NOT EXISTS itinerary_legs (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  user_id TEXT REFERENCES user(id) ON DELETE CASCADE,',
      '  city_id TEXT NOT NULL REFERENCES cities(id),',
      '  start_date TEXT,',
      '  end_date TEXT,',
      '  nights INTEGER NOT NULL,',
      '  accom_tier TEXT,',
      '  food_tier TEXT,',
      '  drinks_tier TEXT,',
      '  activities_tier TEXT,',
      '  accom_override REAL,',
      '  food_override REAL,',
      '  drinks_override REAL,',
      '  activities_override REAL,',
      '  transport_override REAL,',
      '  intercity_transport_cost REAL DEFAULT 0,',
      '  intercity_transport_note TEXT,',
      '  sort_order INTEGER,',
      '  notes TEXT,',
      '  status TEXT',
      ');',
      'CREATE TABLE IF NOT EXISTS itinerary_leg_transports (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  leg_id INTEGER NOT NULL REFERENCES itinerary_legs(id) ON DELETE CASCADE,',
      '  mode TEXT,',
      '  note TEXT,',
      '  cost REAL NOT NULL DEFAULT 0,',
      '  sort_order INTEGER',
      ');',
      'CREATE TABLE IF NOT EXISTS expenses (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  user_id TEXT REFERENCES user(id) ON DELETE CASCADE,',
      '  date TEXT NOT NULL,',
      '  amount REAL NOT NULL,',
      '  currency TEXT NOT NULL,',
      '  amount_aud REAL,',
      '  category TEXT NOT NULL,',
      '  subcategory TEXT,',
      '  description TEXT,',
      '  merchant TEXT,',
      '  leg_id INTEGER REFERENCES itinerary_legs(id),',
      '  source TEXT,',
      '  wise_txn_id TEXT UNIQUE,',
      '  logged_by TEXT,',
      '  is_excluded INTEGER DEFAULT 0,',
      '  is_deleted INTEGER DEFAULT 0,',
      '  created_at TEXT,',
      '  updated_at TEXT',
      ');',
    ].join('\n'));

    deleteRouteModule = await import('@/app/api/itinerary/legs/[id]/route');
  });

  beforeEach(() => {
    dbModule.sqlite.exec([
      'DELETE FROM expenses;',
      'DELETE FROM itinerary_leg_transports;',
      'DELETE FROM itinerary_legs;',
      'DELETE FROM cities;',
      'DELETE FROM countries;',
      "DELETE FROM user WHERE id = 'delete-test-user';",
    ].join('\n'));

    dbModule.sqlite.prepare('INSERT INTO "user" (id) VALUES (?)').run('delete-test-user');
    dbModule.sqlite
      .prepare('INSERT INTO countries (id, name, currency_code, region) VALUES (?, ?, ?, ?)')
      .run('delete-test-country', 'Delete Test Country', 'AUD', 'oceania');
    dbModule.sqlite
      .prepare('INSERT INTO cities (id, country_id, name) VALUES (?, ?, ?)')
      .run('delete-test-city', 'delete-test-country', 'Delete Test City');
  });

  afterAll(() => {
    dbModule?.sqlite.close();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('unassigns expenses before deleting a leg', async () => {
    const legResult = dbModule.sqlite
      .prepare('INSERT INTO itinerary_legs (user_id, city_id, nights, sort_order) VALUES (?, ?, ?, ?)')
      .run('delete-test-user', 'delete-test-city', 3, 1);
    const legId = Number(legResult.lastInsertRowid);

    dbModule.sqlite
      .prepare('INSERT INTO expenses (user_id, date, amount, currency, category, leg_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run('delete-test-user', '2026-07-12', 25, 'AUD', 'food', legId);

    const response = await deleteRouteModule.DELETE(
      new Request('http://localhost/api/itinerary/legs/' + legId, { method: 'DELETE' }),
      { params: { id: String(legId) } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { deleted: true } });
    expect(
      dbModule.sqlite.prepare('SELECT id FROM itinerary_legs WHERE id = ?').get(legId)
    ).toBeUndefined();
    expect(
      dbModule.sqlite.prepare('SELECT leg_id FROM expenses WHERE leg_id IS NULL').get()
    ).toEqual({ leg_id: null });
  });
});
