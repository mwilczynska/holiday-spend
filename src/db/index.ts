import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import { derivePrivateRoomRate } from '../lib/accommodation';
import { findLegForExpenseDate } from '../lib/expense-leg-assignment';
import { getIntercityTransportTotal } from '../lib/intercity-transport';
import { deriveLegDates } from '../lib/itinerary-leg-dates';

const dbPath = path.join(process.cwd(), 'data', 'travel.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const tableNames = sqlite
  .prepare("SELECT name FROM sqlite_master WHERE type='table'")
  .all() as Array<{ name: string }>;
const hasCitiesTable = tableNames.some((table) => table.name === 'cities');
const hasExpensesTable = tableNames.some((table) => table.name === 'expenses');
const hasItineraryLegsTable = tableNames.some((table) => table.name === 'itinerary_legs');
const hasItineraryLegTransportsTable = tableNames.some((table) => table.name === 'itinerary_leg_transports');
const hasCityEstimatesTable = tableNames.some((table) => table.name === 'city_estimates');
const hasCityPriceInputsTable = tableNames.some((table) => table.name === 'city_price_inputs');
const hasAppSettingsTable = tableNames.some((table) => table.name === 'app_settings');
const hasSavedPlansTable = tableNames.some((table) => table.name === 'saved_plans');
const hasUserPreferencesTable = tableNames.some((table) => table.name === 'user_preferences');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    emailVerified INTEGER,
    image TEXT
  )
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS account (
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    providerAccountId TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    PRIMARY KEY (provider, providerAccountId)
  )
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS session (
    sessionToken TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    expires INTEGER NOT NULL
  )
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS verificationToken (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires INTEGER NOT NULL,
    PRIMARY KEY (identifier, token)
  )
`);

const cityColumns = sqlite.prepare("PRAGMA table_info(cities)").all() as Array<{ name: string }>;
const hasPrivateRoomColumn = cityColumns.some((column) => column.name === 'accom_private_room');
const hasDrinksNoneColumn = cityColumns.some((column) => column.name === 'drinks_none');

if (hasCitiesTable && !hasPrivateRoomColumn) {
  sqlite.exec('ALTER TABLE cities ADD COLUMN accom_private_room REAL');
}

if (hasCitiesTable && !hasDrinksNoneColumn) {
  sqlite.exec('ALTER TABLE cities ADD COLUMN drinks_none REAL');
}

if (!hasCityPriceInputsTable) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS city_price_inputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city_id TEXT NOT NULL REFERENCES cities(id),
      captured_at TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_detail TEXT,
      confidence TEXT,
      accom_hostel REAL,
      accom_private_room REAL,
      accom_1star REAL,
      accom_2star REAL,
      accom_3star REAL,
      accom_4star REAL,
      street_meal REAL,
      cheap_restaurant_meal REAL,
      mid_restaurant_meal REAL,
      coffee REAL,
      local_beer REAL,
      import_beer REAL,
      wine_glass REAL,
      cocktail REAL,
      public_transit_ride REAL,
      taxi_short REAL,
      activity_budget REAL,
      activity_mid REAL,
      activity_high REAL,
      notes TEXT,
      is_active INTEGER DEFAULT 1
    )
  `);
}

if (!hasAppSettingsTable) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

if (!hasUserPreferencesTable) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
      planner_group_size INTEGER NOT NULL DEFAULT 2,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

if (!hasSavedPlansTable) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS saved_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      group_size INTEGER NOT NULL DEFAULT 2,
      leg_count INTEGER NOT NULL DEFAULT 0,
      total_nights INTEGER NOT NULL DEFAULT 0,
      total_budget REAL NOT NULL DEFAULT 0,
      fixed_cost_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

if (!hasItineraryLegTransportsTable) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS itinerary_leg_transports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leg_id INTEGER NOT NULL REFERENCES itinerary_legs(id) ON DELETE CASCADE,
      mode TEXT,
      note TEXT,
      cost REAL NOT NULL DEFAULT 0,
      sort_order INTEGER
    )
  `);
}

if (hasItineraryLegsTable) {
  const itineraryLegColumns = sqlite.prepare("PRAGMA table_info(itinerary_legs)").all() as Array<{ name: string }>;
  const hasUserIdColumn = itineraryLegColumns.some((column) => column.name === 'user_id');
  if (!hasUserIdColumn) {
    sqlite.exec('ALTER TABLE itinerary_legs ADD COLUMN user_id TEXT REFERENCES user(id) ON DELETE CASCADE');
  }
}

if (hasExpensesTable) {
  const expenseColumns = sqlite.prepare("PRAGMA table_info(expenses)").all() as Array<{ name: string }>;
  const hasUserIdColumn = expenseColumns.some((column) => column.name === 'user_id');
  if (!hasUserIdColumn) {
    sqlite.exec('ALTER TABLE expenses ADD COLUMN user_id TEXT REFERENCES user(id) ON DELETE CASCADE');
  }
}

if (tableNames.some((table) => table.name === 'fixed_costs')) {
  const fixedCostColumns = sqlite.prepare("PRAGMA table_info(fixed_costs)").all() as Array<{ name: string }>;
  const hasUserIdColumn = fixedCostColumns.some((column) => column.name === 'user_id');
  if (!hasUserIdColumn) {
    sqlite.exec('ALTER TABLE fixed_costs ADD COLUMN user_id TEXT REFERENCES user(id) ON DELETE CASCADE');
  }
}

if (tableNames.some((table) => table.name === 'tags')) {
  const tagColumns = sqlite.prepare("PRAGMA table_info(tags)").all() as Array<{ name: string }>;
  const hasUserIdColumn = tagColumns.some((column) => column.name === 'user_id');
  if (!hasUserIdColumn) {
    sqlite.exec('ALTER TABLE tags ADD COLUMN user_id TEXT REFERENCES user(id) ON DELETE CASCADE');
  }
}

sqlite.prepare(`
  INSERT INTO app_settings (key, value)
  VALUES ('planner_group_size', '2')
  ON CONFLICT(key) DO NOTHING
`).run();

if (hasCityEstimatesTable) {
  const cityEstimateColumns = sqlite.prepare("PRAGMA table_info(city_estimates)").all() as Array<{ name: string }>;
  const cityEstimateColumnNames = new Set(cityEstimateColumns.map((column) => column.name));

  if (!cityEstimateColumnNames.has('prompt_version')) {
    sqlite.exec('ALTER TABLE city_estimates ADD COLUMN prompt_version TEXT');
  }
  if (!cityEstimateColumnNames.has('anchors_json')) {
    sqlite.exec('ALTER TABLE city_estimates ADD COLUMN anchors_json TEXT');
  }
  if (!cityEstimateColumnNames.has('metadata_json')) {
    sqlite.exec('ALTER TABLE city_estimates ADD COLUMN metadata_json TEXT');
  }
  if (!cityEstimateColumnNames.has('sources_json')) {
    sqlite.exec('ALTER TABLE city_estimates ADD COLUMN sources_json TEXT');
  }
  if (!cityEstimateColumnNames.has('input_snapshot_json')) {
    sqlite.exec('ALTER TABLE city_estimates ADD COLUMN input_snapshot_json TEXT');
  }
  if (!cityEstimateColumnNames.has('fallback_log_json')) {
    sqlite.exec('ALTER TABLE city_estimates ADD COLUMN fallback_log_json TEXT');
  }
}

if (hasItineraryLegsTable) {
  const legsWithLegacyTransport = sqlite.prepare(`
    SELECT id, intercity_transport_cost, intercity_transport_note
    FROM itinerary_legs
    WHERE COALESCE(intercity_transport_cost, 0) != 0
       OR (intercity_transport_note IS NOT NULL AND trim(intercity_transport_note) != '')
  `).all() as Array<{
    id: number;
    intercity_transport_cost: number | null;
    intercity_transport_note: string | null;
  }>;

  const countTransportRows = sqlite.prepare(`
    SELECT COUNT(*) as count
    FROM itinerary_leg_transports
    WHERE leg_id = ?
  `);

  const insertTransportRow = sqlite.prepare(`
    INSERT INTO itinerary_leg_transports (leg_id, mode, note, cost, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const updateLegacyTransportFields = sqlite.prepare(`
    UPDATE itinerary_legs
    SET intercity_transport_cost = ?, intercity_transport_note = ?
    WHERE id = ?
  `);

  for (const leg of legsWithLegacyTransport) {
    const existingCount = countTransportRows.get(leg.id) as { count: number };
    if (existingCount.count === 0) {
      insertTransportRow.run(
        leg.id,
        null,
        leg.intercity_transport_note,
        leg.intercity_transport_cost ?? 0,
        0
      );
    }

    const transportRows = sqlite.prepare(`
      SELECT cost, note
      FROM itinerary_leg_transports
      WHERE leg_id = ?
      ORDER BY sort_order, id
    `).all(leg.id) as Array<{ cost: number | null; note: string | null }>;

    updateLegacyTransportFields.run(
      getIntercityTransportTotal(transportRows),
      transportRows.find((row) => row.note?.trim())?.note ?? null,
      leg.id
    );
  }
}

if (hasCitiesTable) {
  const citiesNeedingPrivateRoom = sqlite.prepare(`
    SELECT id, accom_hostel, accom_1star, accom_private_room
    FROM cities
    WHERE accom_private_room IS NULL
  `).all() as Array<{
    id: string;
    accom_hostel: number | null;
    accom_1star: number | null;
    accom_private_room: number | null;
  }>;

  const updatePrivateRoomRate = sqlite.prepare(`
    UPDATE cities
    SET accom_private_room = ?
    WHERE id = ?
  `);

  for (const city of citiesNeedingPrivateRoom) {
    const privateRoomRate = derivePrivateRoomRate(city.accom_hostel, city.accom_1star);
    if (privateRoomRate != null) {
      updatePrivateRoomRate.run(privateRoomRate, city.id);
    }
  }

  sqlite.exec(`
    UPDATE cities
    SET drinks_none = ROUND(drink_coffee * 2, 2)
    WHERE drinks_none IS NULL
      AND drink_coffee IS NOT NULL
  `);
}

if (hasExpensesTable && hasItineraryLegsTable) {
  const datedLegs = sqlite.prepare(`
    SELECT id, city_id as cityId, start_date as startDate, end_date as endDate, nights, sort_order as sortOrder
    FROM itinerary_legs
    ORDER BY sort_order
  `).all() as Array<{
    id: number;
    cityId: string;
    startDate: string | null;
    endDate: string | null;
    nights: number;
    sortOrder: number | null;
  }>;
  const updateLegDates = sqlite.prepare(`
    UPDATE itinerary_legs
    SET start_date = COALESCE(start_date, ?),
        end_date = COALESCE(end_date, ?)
    WHERE id = ?
  `);

  const unassignedWiseExpenses = sqlite.prepare(`
    SELECT id, date
    FROM expenses
    WHERE leg_id IS NULL
      AND source = 'wise_csv'
      AND date IS NOT NULL
      AND date != ''
  `).all() as Array<{ id: number; date: string }>;

  const updateExpenseLeg = sqlite.prepare(`
    UPDATE expenses
    SET leg_id = ?
    WHERE id = ?
  `);
  const derivedLegs = deriveLegDates(datedLegs);

  for (let index = 0; index < datedLegs.length; index += 1) {
    const originalLeg = datedLegs[index];
    const derivedLeg = derivedLegs[index];
    const needsStartDate = !originalLeg.startDate && derivedLeg?.startDate;
    const needsEndDate = !originalLeg.endDate && derivedLeg?.endDate;

    if (needsStartDate || needsEndDate) {
      updateLegDates.run(
        derivedLeg?.startDate ?? null,
        derivedLeg?.endDate ?? null,
        originalLeg.id
      );
    }
  }

  for (const expense of unassignedWiseExpenses) {
    const matchedLeg = findLegForExpenseDate(expense.date, derivedLegs);
    if (matchedLeg) {
      updateExpenseLeg.run(matchedLeg.id, expense.id);
    }
  }
}

export const db = drizzle(sqlite, { schema });
export { schema };
