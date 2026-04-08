import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import { derivePrivateRoomRate } from '../lib/accommodation';
import { findLegForExpenseDate } from '../lib/expense-leg-assignment';

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
const hasCityEstimatesTable = tableNames.some((table) => table.name === 'city_estimates');
const hasCityPriceInputsTable = tableNames.some((table) => table.name === 'city_price_inputs');

const cityColumns = sqlite.prepare("PRAGMA table_info(cities)").all() as Array<{ name: string }>;
const hasPrivateRoomColumn = cityColumns.some((column) => column.name === 'accom_private_room');

if (hasCitiesTable && !hasPrivateRoomColumn) {
  sqlite.exec('ALTER TABLE cities ADD COLUMN accom_private_room REAL');
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
}

if (hasExpensesTable && hasItineraryLegsTable) {
  const datedLegs = sqlite.prepare(`
    SELECT id, city_id as cityId, start_date as startDate, end_date as endDate, sort_order as sortOrder
    FROM itinerary_legs
    ORDER BY sort_order
  `).all() as Array<{
    id: number;
    cityId: string;
    startDate: string | null;
    endDate: string | null;
    sortOrder: number | null;
  }>;

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

  for (const expense of unassignedWiseExpenses) {
    const matchedLeg = findLegForExpenseDate(expense.date, datedLegs);
    if (matchedLeg) {
      updateExpenseLeg.run(matchedLeg.id, expense.id);
    }
  }
}

export const db = drizzle(sqlite, { schema });
export { schema };
