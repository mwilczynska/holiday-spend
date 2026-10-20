import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dateOrderInsertionIndex } from '@/lib/itinerary-leg-placement';

vi.mock('@/lib/auth', () => ({
  requireCurrentUserId: vi.fn(async () => 'place-user'),
}));

const leg = (startDate: string | null, endDate: string | null, nights: number, sortOrder: number) => ({
  startDate, endDate, nights, sortOrder,
});

describe('dateOrderInsertionIndex', () => {
  const legs = [
    leg('2026-03-01', '2026-03-05', 4, 1),
    leg('2026-03-05', '2026-03-10', 5, 2),
    leg('2026-03-10', '2026-03-12', 2, 3),
  ];

  it('returns 0 for an empty list', () => {
    expect(dateOrderInsertionIndex([], '2026-03-01')).toBe(0);
  });

  it('places a date before the first leg first', () => {
    expect(dateOrderInsertionIndex(legs, '2026-02-01')).toBe(0);
  });

  it('places a date in the middle between its neighbours', () => {
    expect(dateOrderInsertionIndex(legs, '2026-03-07')).toBe(2);
  });

  it('places a same-day start after the existing leg', () => {
    expect(dateOrderInsertionIndex(legs, '2026-03-01')).toBe(1);
    expect(dateOrderInsertionIndex(legs, '2026-03-05')).toBe(2);
  });

  it('appends after the last leg', () => {
    expect(dateOrderInsertionIndex(legs, '2026-04-01')).toBe(3);
  });

  it('appends when there is no start date', () => {
    expect(dateOrderInsertionIndex(legs, null)).toBe(3);
    expect(dateOrderInsertionIndex(legs, undefined)).toBe(3);
  });

  it('uses dates derived from neighbours for legs without dates', () => {
    const derived = [
      leg('2026-03-01', null, 4, 1),
      leg(null, null, 5, 2), // derived 2026-03-05 to 2026-03-10
      leg(null, null, 2, 3), // derived 2026-03-10 to 2026-03-12
    ];
    expect(dateOrderInsertionIndex(derived, '2026-03-07')).toBe(2);
    expect(dateOrderInsertionIndex(derived, '2026-03-10')).toBe(3);
    expect(dateOrderInsertionIndex(derived, '2026-03-02')).toBe(1);
  });

  it('treats legs with no derivable dates as not later than the new date', () => {
    const undated = [leg(null, null, 3, 1), leg(null, null, 3, 2)];
    expect(dateOrderInsertionIndex(undated, '2026-03-01')).toBe(2);
  });
});

type DbModule = typeof import('@/db');
type LegsRoute = typeof import('@/app/api/itinerary/legs/route');
type LegRoute = typeof import('@/app/api/itinerary/legs/[id]/route');

let dbModule: DbModule;
let legsRoute: LegsRoute;
let legRoute: LegRoute;
let tempDir: string;
const originalCwd = process.cwd();

function insertLeg(userId: string, startDate: string | null, endDate: string | null, nights: number, sortOrder: number) {
  const result = dbModule.sqlite
    .prepare('INSERT INTO itinerary_legs (user_id, city_id, start_date, end_date, nights, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, 'place-city', startDate, endDate, nights, sortOrder);
  return Number(result.lastInsertRowid);
}

function orders(userId: string): Array<{ id: number; sort_order: number }> {
  return dbModule.sqlite
    .prepare('SELECT id, sort_order FROM itinerary_legs WHERE user_id = ? ORDER BY sort_order, id')
    .all(userId) as Array<{ id: number; sort_order: number }>;
}

function post(body: Record<string, unknown>) {
  return legsRoute.POST(new Request('http://localhost/api/itinerary/legs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function put(id: number, body: Record<string, unknown>) {
  return legRoute.PUT(
    new Request('http://localhost/api/itinerary/legs/' + id, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: String(id) }) }
  );
}

describe.sequential('itinerary leg placement routes', () => {
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-itinerary-place-'));
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
      "  miscellaneous_expenses TEXT NOT NULL DEFAULT '[]',",
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
    ].join('\n'));

    legsRoute = await import('@/app/api/itinerary/legs/route');
    legRoute = await import('@/app/api/itinerary/legs/[id]/route');
  });

  beforeEach(() => {
    dbModule.sqlite.exec([
      'DELETE FROM itinerary_leg_transports;',
      'DELETE FROM itinerary_legs;',
      'DELETE FROM cities;',
      'DELETE FROM countries;',
      "DELETE FROM user WHERE id IN ('place-user', 'other-user');",
    ].join('\n'));
    dbModule.sqlite.prepare('INSERT INTO "user" (id) VALUES (?)').run('place-user');
    dbModule.sqlite.prepare('INSERT INTO "user" (id) VALUES (?)').run('other-user');
    dbModule.sqlite
      .prepare('INSERT INTO countries (id, name, currency_code, region) VALUES (?, ?, ?, ?)')
      .run('place-country', 'Place Country', 'AUD', 'oceania');
    dbModule.sqlite
      .prepare('INSERT INTO cities (id, country_id, name) VALUES (?, ?, ?)')
      .run('place-city', 'place-country', 'Place City');
  });

  afterAll(() => {
    dbModule?.sqlite.close();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('inserts a dated leg between two legs and shifts later legs by one', async () => {
    const a = insertLeg('place-user', '2026-03-01', '2026-03-05', 4, 1);
    const b = insertLeg('place-user', '2026-03-05', '2026-03-10', 5, 2);
    const c = insertLeg('place-user', '2026-03-10', '2026-03-12', 2, 3);

    const response = await post({ cityId: 'place-city', startDate: '2026-03-07', endDate: '2026-03-08', nights: 1 });
    expect(response.status).toBe(201);
    const created = (await response.json()).data;

    expect(created.sortOrder).toBe(3);
    expect(orders('place-user')).toEqual([
      { id: a, sort_order: 1 },
      { id: b, sort_order: 2 },
      { id: created.id, sort_order: 3 },
      { id: c, sort_order: 4 },
    ]);
  });

  it('inserts before the first leg and renumbers densely from legacy gapped orders', async () => {
    const a = insertLeg('place-user', '2026-03-01', '2026-03-05', 4, 10);
    const b = insertLeg('place-user', '2026-03-05', '2026-03-10', 5, 20);

    const response = await post({ cityId: 'place-city', startDate: '2026-02-01', nights: 2 });
    expect(response.status).toBe(201);
    const created = (await response.json()).data;

    expect(orders('place-user')).toEqual([
      { id: created.id, sort_order: 1 },
      { id: a, sort_order: 2 },
      { id: b, sort_order: 3 },
    ]);
  });

  it('does not touch legs belonging to another user', async () => {
    insertLeg('place-user', '2026-03-01', '2026-03-05', 4, 1);
    insertLeg('place-user', '2026-03-10', '2026-03-12', 2, 2);
    const o1 = insertLeg('other-user', '2026-03-01', '2026-03-05', 4, 1);
    const o2 = insertLeg('other-user', '2026-03-10', '2026-03-12', 2, 5);

    const response = await post({ cityId: 'place-city', startDate: '2026-03-07', nights: 1 });
    expect(response.status).toBe(201);

    expect(orders('other-user')).toEqual([
      { id: o1, sort_order: 1 },
      { id: o2, sort_order: 5 },
    ]);
  });

  it('appends an undated leg', async () => {
    const a = insertLeg('place-user', '2026-03-01', '2026-03-05', 4, 1);
    const b = insertLeg('place-user', '2026-03-10', '2026-03-12', 2, 2);

    const response = await post({ cityId: 'place-city', nights: 3 });
    expect(response.status).toBe(201);
    const created = (await response.json()).data;

    expect(orders('place-user')).toEqual([
      { id: a, sort_order: 1 },
      { id: b, sort_order: 2 },
      { id: created.id, sort_order: 3 },
    ]);
  });

  it('appends a leg dated after every existing leg', async () => {
    const a = insertLeg('place-user', '2026-03-01', '2026-03-05', 4, 1);
    const response = await post({ cityId: 'place-city', startDate: '2026-06-01', nights: 3 });
    const created = (await response.json()).data;
    expect(orders('place-user')).toEqual([
      { id: a, sort_order: 1 },
      { id: created.id, sort_order: 2 },
    ]);
  });

  it('rejects a 0202 date with 400 and writes nothing', async () => {
    insertLeg('place-user', '2026-03-01', '2026-03-05', 4, 1);
    const response = await post({ cityId: 'place-city', startDate: '0202-03-01', nights: 2 });
    expect(response.status).toBe(400);
    expect(
      (dbModule.sqlite.prepare('SELECT COUNT(*) AS n FROM itinerary_legs').get() as { n: number }).n
    ).toBe(1);
  });

  it('PUT with an implausible startDate returns 400 and leaves the row unchanged', async () => {
    const id = insertLeg('place-user', '2026-03-01', '2026-03-05', 4, 1);
    const before = dbModule.sqlite.prepare('SELECT * FROM itinerary_legs WHERE id = ?').get(id);

    const response = await put(id, { startDate: '0202-03-01' });
    expect(response.status).toBe(400);
    expect(dbModule.sqlite.prepare('SELECT * FROM itinerary_legs WHERE id = ?').get(id)).toEqual(before);
  });

  it('PUT changing only nights works', async () => {
    const id = insertLeg('place-user', '2026-03-01', '2026-03-05', 4, 1);
    const response = await put(id, { nights: 6 });
    expect(response.status).toBe(200);
    const row = dbModule.sqlite.prepare('SELECT nights, start_date, end_date FROM itinerary_legs WHERE id = ?').get(id);
    expect(row).toEqual({ nights: 6, start_date: '2026-03-01', end_date: '2026-03-05' });
  });
});
