import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Partial: `handleError` does an `instanceof AuthRequiredError` check, so the real class has to
// survive the mock or every error path throws on the missing export instead of being handled.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireCurrentUserId: vi.fn(async () => 'snapshot-user'),
}));

vi.mock('@/lib/resolve-missing-cities', () => ({
  resolveMissingCities: vi.fn(async () => ({
    createdCountries: [],
    createdCities: [],
    generatedCities: [],
    knownCountryIds: new Set(['portugal']),
  })),
}));

// `getIntercityTransportTotal` is called for each leg inside the import transaction, which makes
// it the cleanest place to inject a failure partway through the rebuild — the exact moment the
// old code had already deleted everything and had nothing to roll back to.
let failTransportTotalOnCall = 0;
let transportTotalCalls = 0;
vi.mock('@/lib/intercity-transport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/intercity-transport')>();
  return {
    ...actual,
    getIntercityTransportTotal: (transports: never) => {
      transportTotalCalls += 1;
      if (failTransportTotalOnCall === transportTotalCalls) {
        throw new Error('injected failure partway through the snapshot rebuild');
      }
      return actual.getIntercityTransportTotal(transports);
    },
  };
});

type DbModule = typeof import('@/db');
type SnapshotRoute = typeof import('@/app/api/itinerary/snapshot/route');

let dbModule: DbModule;
let route: SnapshotRoute;
let tempDir: string;
const originalCwd = process.cwd();

function snapshotBody() {
  return {
    snapshot: {
      version: 1,
      groupSize: 3,
      legs: [
        {
          cityId: 'lisbon',
          nights: 4,
          accomTier: '3star',
          foodTier: 'mid',
          drinksTier: 'moderate',
          activitiesTier: 'mid',
          intercityTransports: [{ mode: 'train', cost: 60, sortOrder: 0 }],
          status: 'planned',
        },
        {
          cityId: 'porto',
          nights: 3,
          accomTier: '2star',
          foodTier: 'budget',
          drinksTier: 'light',
          activitiesTier: 'budget',
          intercityTransports: [{ mode: 'bus', cost: 25, sortOrder: 0 }],
          status: 'planned',
        },
      ],
      fixedCosts: [{ description: 'Imported insurance', amountAud: 400, isPaid: 0 }],
    },
    missingCityStrategy: 'placeholder',
    missingCityResolutions: [],
  };
}

function post(body: unknown) {
  return route.POST(
    new Request('http://localhost/api/itinerary/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

const CREATE_TABLES = [
  'CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, email TEXT);',
  'CREATE TABLE IF NOT EXISTS countries (id TEXT PRIMARY KEY, name TEXT NOT NULL, currency_code TEXT NOT NULL, region TEXT);',
  'CREATE TABLE IF NOT EXISTS cities (id TEXT PRIMARY KEY, country_id TEXT NOT NULL REFERENCES countries(id), name TEXT NOT NULL);',
  'CREATE TABLE IF NOT EXISTS itinerary_legs (',
  '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
  '  city_id TEXT NOT NULL REFERENCES cities(id),',
  '  start_date TEXT, end_date TEXT, nights INTEGER NOT NULL,',
  "  accom_tier TEXT DEFAULT '2star', food_tier TEXT DEFAULT 'mid',",
  "  drinks_tier TEXT DEFAULT 'moderate', activities_tier TEXT DEFAULT 'mid',",
  '  accom_override REAL, food_override REAL, drinks_override REAL,',
  '  activities_override REAL, transport_override REAL,',
  '  intercity_transport_cost REAL DEFAULT 0, intercity_transport_note TEXT,',
  '  split_pct REAL DEFAULT 50, sort_order INTEGER, notes TEXT,',
  "  status TEXT DEFAULT 'planned', user_id TEXT",
  ');',
  'CREATE TABLE IF NOT EXISTS itinerary_leg_transports (',
  '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
  '  leg_id INTEGER NOT NULL REFERENCES itinerary_legs(id) ON DELETE CASCADE,',
  '  mode TEXT, note TEXT, cost REAL NOT NULL DEFAULT 0, sort_order INTEGER',
  ');',
  'CREATE TABLE IF NOT EXISTS fixed_costs (',
  '  id INTEGER PRIMARY KEY AUTOINCREMENT, description TEXT NOT NULL, amount_aud REAL NOT NULL,',
  '  category TEXT, country_id TEXT, date TEXT, is_paid INTEGER DEFAULT 0, notes TEXT, user_id TEXT',
  ');',
  'CREATE TABLE IF NOT EXISTS expenses (',
  '  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, amount REAL NOT NULL,',
  '  currency TEXT NOT NULL, amount_aud REAL, category TEXT NOT NULL, subcategory TEXT,',
  '  description TEXT, merchant TEXT, leg_id INTEGER REFERENCES itinerary_legs(id),',
  "  source TEXT DEFAULT 'manual', wise_txn_id TEXT UNIQUE, logged_by TEXT,",
  '  is_excluded INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT,',
  '  user_id TEXT, is_deleted INTEGER NOT NULL DEFAULT 0',
  ');',
  'CREATE TABLE IF NOT EXISTS user_preferences (',
  '  user_id TEXT PRIMARY KEY, planner_group_size INTEGER NOT NULL DEFAULT 2,',
  '  created_at TEXT, updated_at TEXT',
  ');',
].join('\n');

const CLEAR_TABLES = [
  'DELETE FROM expenses;',
  'DELETE FROM itinerary_leg_transports;',
  'DELETE FROM itinerary_legs;',
  'DELETE FROM fixed_costs;',
  'DELETE FROM cities;',
  'DELETE FROM countries;',
  'DELETE FROM user_preferences;',
  'DELETE FROM user;',
].join('\n');

const SEED = [
  "INSERT INTO user (id, email) VALUES ('snapshot-user', 'snapshot@example.com');",
  "INSERT INTO countries (id, name, currency_code) VALUES ('portugal', 'Portugal', 'EUR');",
  "INSERT INTO cities (id, country_id, name) VALUES ('lisbon', 'portugal', 'Lisbon'), ('porto', 'portugal', 'Porto');",
  'INSERT INTO itinerary_legs (id, city_id, nights, sort_order, user_id) VALUES',
  "  (901, 'lisbon', 7, 1, 'snapshot-user'), (902, 'porto', 5, 2, 'snapshot-user');",
  "INSERT INTO fixed_costs (id, description, amount_aud, user_id) VALUES (801, 'Existing visa', 250, 'snapshot-user');",
  'INSERT INTO expenses (id, date, amount, currency, amount_aud, category, leg_id, user_id)',
  "  VALUES (701, '2026-04-02', 40, 'EUR', 66, 'food', 901, 'snapshot-user');",
  "INSERT INTO user_preferences (user_id, planner_group_size) VALUES ('snapshot-user', 2);",
].join('\n');

describe.sequential('snapshot import atomicity', () => {
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-snapshot-atomicity-'));
    process.chdir(tempDir);
    vi.resetModules();

    dbModule = await import('@/db');
    dbModule.sqlite.exec(CREATE_TABLES);
    route = await import('@/app/api/itinerary/snapshot/route');
  });

  beforeEach(() => {
    failTransportTotalOnCall = 0;
    transportTotalCalls = 0;
    dbModule.sqlite.exec(CLEAR_TABLES);
    dbModule.sqlite.exec(SEED);
  });

  afterAll(() => {
    dbModule?.sqlite.close();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const legs = () =>
    dbModule.sqlite
      .prepare('SELECT id, city_id, nights FROM itinerary_legs ORDER BY id')
      .all() as Array<{ id: number; city_id: string; nights: number }>;
  const costs = () =>
    dbModule.sqlite
      .prepare('SELECT id, description FROM fixed_costs ORDER BY id')
      .all() as Array<{ id: number; description: string }>;
  const expenseLegId = () =>
    (dbModule.sqlite.prepare('SELECT leg_id FROM expenses WHERE id = 701').get() as {
      leg_id: number | null;
    }).leg_id;
  const groupSize = () =>
    (dbModule.sqlite
      .prepare('SELECT planner_group_size AS g FROM user_preferences WHERE user_id = ?')
      .get('snapshot-user') as { g: number }).g;

  it('imports a snapshot, replacing the itinerary and fixed costs', async () => {
    const response = await post(snapshotBody());
    expect(response.status).toBe(200);

    expect(legs().map((leg) => leg.city_id)).toEqual(['lisbon', 'porto']);
    expect(legs().map((leg) => leg.nights)).toEqual([4, 3]);
    expect(costs().map((cost) => cost.description)).toEqual(['Imported insurance']);
    expect(groupSize()).toBe(3);
    // The replaced leg is gone, so the expense is retained but unassigned rather than deleted.
    expect(expenseLegId()).toBeNull();
  });

  it('leaves the previous itinerary untouched when the rebuild fails partway', async () => {
    // Fail on the second leg: the deletes have run and the first leg is already inserted.
    failTransportTotalOnCall = 2;

    const response = await post(snapshotBody());
    expect(response.status).toBeGreaterThanOrEqual(400);

    expect(legs().map((leg) => leg.id)).toEqual([901, 902]);
    expect(legs().map((leg) => leg.nights)).toEqual([7, 5]);
    expect(costs().map((cost) => cost.description)).toEqual(['Existing visa']);
  });

  it('keeps expenses attached to their legs when the rebuild fails', async () => {
    // The detach ran first and used to be committed on its own, orphaning every expense from the
    // leg it belonged to — the linkage the planned-versus-actual dashboard depends on.
    failTransportTotalOnCall = 1;

    const response = await post(snapshotBody());
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(expenseLegId()).toBe(901);
  });

  it('does not change the traveller count when the import is rejected', async () => {
    failTransportTotalOnCall = 2;

    await post(snapshotBody());

    expect(groupSize()).toBe(2);
  });
});
