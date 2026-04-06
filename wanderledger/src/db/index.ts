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

const cityColumns = sqlite.prepare("PRAGMA table_info(cities)").all() as Array<{ name: string }>;
const hasPrivateRoomColumn = cityColumns.some((column) => column.name === 'accom_private_room');

if (hasCitiesTable && !hasPrivateRoomColumn) {
  sqlite.exec('ALTER TABLE cities ADD COLUMN accom_private_room REAL');
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
