import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  requireCurrentUserId: vi.fn(async () => 'validation-user'),
}));

type DbModule = typeof import('@/db');
type CityRouteModule = typeof import('@/app/api/cities/[id]/route');
type TagRouteModule = typeof import('@/app/api/tags/[id]/route');

let dbModule: DbModule;
let cityRoute: CityRouteModule;
let tagRoute: TagRouteModule;
let tempDir: string;
const originalCwd = process.cwd();

function put(handler: (r: Request, c: { params: { id: string } }) => Promise<Response>, id: string, body: unknown) {
  return handler(
    new Request(`http://localhost/api/x/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: { id } }
  );
}

describe.sequential('write route input validation', () => {
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-write-validation-'));
    process.chdir(tempDir);
    vi.resetModules();

    dbModule = await import('@/db');
    dbModule.sqlite.exec([
      'CREATE TABLE IF NOT EXISTS countries (id TEXT PRIMARY KEY, name TEXT NOT NULL, currency_code TEXT NOT NULL, region TEXT);',
      // The route selects every column, so the fixture mirrors the real table.
      'CREATE TABLE IF NOT EXISTS cities (',
      '  id TEXT PRIMARY KEY, country_id TEXT NOT NULL REFERENCES countries(id), name TEXT NOT NULL,',
      '  accom_hostel REAL, accom_1star REAL, accom_2star REAL, accom_3star REAL, accom_4star REAL,',
      '  food_street REAL, food_budget REAL, food_mid REAL, food_high REAL,',
      '  drink_local_beer REAL, drink_import_beer REAL, drink_wine_glass REAL, drink_cocktail REAL,',
      '  drink_coffee REAL, drinks_light REAL, drinks_moderate REAL, drinks_heavy REAL,',
      '  activities_free REAL DEFAULT 0, activities_budget REAL, activities_mid REAL, activities_high REAL,',
      '  transport_local REAL, estimation_source TEXT, estimated_at TEXT, estimation_id INTEGER,',
      '  notes TEXT, accom_private_room REAL, drinks_none REAL',
      ');',
      'CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT, user_id TEXT);',
    ].join('\n'));

    cityRoute = await import('@/app/api/cities/[id]/route');
    tagRoute = await import('@/app/api/tags/[id]/route');
  });

  beforeEach(() => {
    dbModule.sqlite.exec('DELETE FROM cities; DELETE FROM countries; DELETE FROM tags;');
    dbModule.sqlite.prepare("INSERT INTO countries (id, name, currency_code) VALUES ('portugal','Portugal','EUR')").run();
    dbModule.sqlite
      .prepare(
        `INSERT INTO cities (id, country_id, name, accom_3star, food_mid, estimation_source, estimation_id)
         VALUES ('lisbon','portugal','Lisbon',139.5,132.06,'base_csv_apr_2026',NULL)`
      )
      .run();
    dbModule.sqlite.prepare("INSERT INTO tags (id, name, color, user_id) VALUES (1,'Splurge','#ef4444','validation-user')").run();
  });

  afterAll(() => {
    dbModule?.sqlite.close();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function city() {
    return dbModule.sqlite
      .prepare('SELECT id, accom_3star, estimation_source, estimation_id, name FROM cities WHERE id = ?')
      .get('lisbon') as { id: string; accom_3star: number; estimation_source: string; estimation_id: number | null; name: string };
  }

  it('accepts a legitimate cost edit', async () => {
    const response = await put(cityRoute.PUT, 'lisbon', { accom3star: 141.5 });
    expect(response.status).toBe(200);
    expect(city().accom_3star).toBe(141.5);
  });

  it('refuses a body that would forge estimate provenance', async () => {
    // A modelled value must never be able to claim it was an observed source price. The handler
    // previously wrote the raw body, so this request would have succeeded.
    const response = await put(cityRoute.PUT, 'lisbon', {
      accom3star: 50,
      estimationSource: 'observed_source_price',
      estimationId: 999,
    });

    expect(response.status).toBe(400);
    const row = city();
    expect(row.estimation_source).toBe('base_csv_apr_2026');
    expect(row.estimation_id).toBeNull();
    expect(row.accom_3star).toBe(139.5);
  });

  it('refuses a body that would rewrite the city identity', async () => {
    const response = await put(cityRoute.PUT, 'lisbon', { id: 'hijacked', name: 'Nope' });
    expect(response.status).toBe(400);
    expect(city().id).toBe('lisbon');
    expect(city().name).toBe('Lisbon');
  });

  it('refuses an update carrying no editable field', async () => {
    const response = await put(cityRoute.PUT, 'lisbon', {});
    expect(response.status).toBe(400);
  });

  it('refuses a tag body that would move the row to another user', async () => {
    const response = await put(tagRoute.PUT, '1', { name: 'Renamed', userId: 'someone-else' });
    expect(response.status).toBe(400);

    const row = dbModule.sqlite.prepare('SELECT name, user_id FROM tags WHERE id = 1').get() as {
      name: string;
      user_id: string;
    };
    expect(row.name).toBe('Splurge');
    expect(row.user_id).toBe('validation-user');
  });

  it('still accepts a legitimate tag rename', async () => {
    const response = await put(tagRoute.PUT, '1', { name: 'Renamed' });
    expect(response.status).toBe(200);
    expect((dbModule.sqlite.prepare('SELECT name FROM tags WHERE id = 1').get() as { name: string }).name).toBe('Renamed');
  });
});
