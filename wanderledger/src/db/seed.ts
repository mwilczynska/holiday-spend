import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'data', 'travel.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create tables
sqlite.exec(`
CREATE TABLE IF NOT EXISTS countries (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  region        TEXT
);

CREATE TABLE IF NOT EXISTS cities (
  id              TEXT PRIMARY KEY,
  country_id      TEXT NOT NULL REFERENCES countries(id),
  name            TEXT NOT NULL,
  accom_hostel    REAL,
  accom_1star     REAL,
  accom_2star     REAL,
  accom_3star     REAL,
  accom_4star     REAL,
  food_street     REAL,
  food_budget     REAL,
  food_mid        REAL,
  food_high       REAL,
  drink_local_beer   REAL,
  drink_import_beer  REAL,
  drink_wine_glass   REAL,
  drink_cocktail     REAL,
  drink_coffee       REAL,
  drinks_light    REAL,
  drinks_moderate REAL,
  drinks_heavy    REAL,
  activities_free     REAL DEFAULT 0,
  activities_budget   REAL,
  activities_mid      REAL,
  activities_high     REAL,
  transport_local REAL,
  estimation_source TEXT,
  estimated_at      TEXT,
  estimation_id     INTEGER,
  notes             TEXT
);

CREATE TABLE IF NOT EXISTS itinerary_legs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id         TEXT NOT NULL REFERENCES cities(id),
  start_date      TEXT,
  end_date        TEXT,
  nights          INTEGER NOT NULL,
  accom_tier      TEXT DEFAULT '2star',
  food_tier       TEXT DEFAULT 'mid',
  drinks_tier     TEXT DEFAULT 'moderate',
  activities_tier TEXT DEFAULT 'mid',
  accom_override      REAL,
  food_override       REAL,
  drinks_override     REAL,
  activities_override REAL,
  transport_override  REAL,
  intercity_transport_cost REAL DEFAULT 0,
  intercity_transport_note TEXT,
  split_pct           REAL DEFAULT 50,
  sort_order      INTEGER,
  notes           TEXT,
  status          TEXT DEFAULT 'planned'
);

CREATE TABLE IF NOT EXISTS expenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL,
  amount          REAL NOT NULL,
  currency        TEXT NOT NULL,
  amount_aud      REAL,
  category        TEXT NOT NULL,
  subcategory     TEXT,
  description     TEXT,
  merchant        TEXT,
  leg_id          INTEGER REFERENCES itinerary_legs(id),
  source          TEXT DEFAULT 'manual',
  wise_txn_id     TEXT UNIQUE,
  logged_by       TEXT,
  is_excluded     INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL UNIQUE,
  color           TEXT
);

CREATE TABLE IF NOT EXISTS expense_tags (
  expense_id      INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (expense_id, tag_id)
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  date            TEXT NOT NULL,
  from_currency   TEXT NOT NULL,
  to_currency     TEXT DEFAULT 'AUD',
  rate            REAL NOT NULL,
  PRIMARY KEY (date, from_currency, to_currency)
);

CREATE TABLE IF NOT EXISTS fixed_costs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  description     TEXT NOT NULL,
  amount_aud      REAL NOT NULL,
  category        TEXT,
  country_id      TEXT REFERENCES countries(id),
  date            TEXT,
  is_paid         INTEGER DEFAULT 0,
  notes           TEXT
);

CREATE TABLE IF NOT EXISTS city_estimates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id         TEXT NOT NULL REFERENCES cities(id),
  estimated_at    TEXT NOT NULL,
  source          TEXT NOT NULL,
  llm_provider    TEXT,
  llm_model       TEXT,
  data_json       TEXT NOT NULL,
  reasoning       TEXT,
  confidence      TEXT,
  numbeo_items    TEXT,
  xotelo_data     TEXT,
  is_active       INTEGER DEFAULT 1
);
`);

// Load seed data
const seedPath = path.join(process.cwd(), 'seed-data', 'cities.json');
const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

const insertCountry = sqlite.prepare(
  'INSERT OR IGNORE INTO countries (id, name, currency_code, region) VALUES (?, ?, ?, ?)'
);

const insertCity = sqlite.prepare(`
  INSERT OR IGNORE INTO cities (
    id, country_id, name,
    accom_hostel, accom_1star, accom_2star, accom_3star, accom_4star,
    food_street, food_budget, food_mid, food_high,
    drink_local_beer, drink_import_beer, drink_wine_glass, drink_cocktail, drink_coffee,
    drinks_light, drinks_moderate, drinks_heavy,
    activities_free, activities_budget, activities_mid, activities_high,
    transport_local, estimation_source, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedAll = sqlite.transaction(() => {
  for (const country of seedData.countries) {
    insertCountry.run(country.id, country.name, country.currencyCode, country.region);
  }
  for (const city of seedData.cities) {
    insertCity.run(
      city.id, city.countryId, city.name,
      city.accomHostel, city.accom1star, city.accom2star, city.accom3star, city.accom4star,
      city.foodStreet, city.foodBudget, city.foodMid, city.foodHigh,
      city.drinkLocalBeer, city.drinkImportBeer, city.drinkWineGlass, city.drinkCocktail, city.drinkCoffee,
      city.drinksLight, city.drinksModerate, city.drinksHeavy,
      city.activitiesFree, city.activitiesBudget, city.activitiesMid, city.activitiesHigh,
      city.transportLocal, city.estimationSource, city.notes
    );
  }
});

seedAll();
console.log(`Seeded ${seedData.countries.length} countries and ${seedData.cities.length} cities.`);
sqlite.close();
