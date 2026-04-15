import Database from 'better-sqlite3';
import fs from 'fs';
import Papa from 'papaparse';
import path from 'path';
import { getCountryCurrencyCode, normalizeRegionLabel, slugifyId } from '../lib/country-metadata';

type LegacyCountry = {
  id: string;
  name: string;
  currencyCode: string;
  region?: string;
};

type LegacyCity = {
  id: string;
  countryId: string;
  name: string;
};

type LegacySeedData = {
  countries: LegacyCountry[];
  cities: LegacyCity[];
};

type CityCostCsvRow = {
  city: string;
  country: string;
  region: string;
  accom_shared_hostel_dorm: string;
  accom_hostel_private_room: string;
  accom_1_star: string;
  accom_2_star: string;
  accom_3_star: string;
  accom_4_star: string;
  food_street_food: string;
  food_budget: string;
  food_mid_range: string;
  food_high_end: string;
  drinks_light: string;
  drinks_moderate: string;
  drinks_heavy: string;
  activities_free: string;
  activities_budget: string;
  activities_mid_range: string;
  activities_high_end: string;
};

type ParsedCountry = {
  id: string;
  name: string;
  currencyCode: string;
  region: string | null;
};

type ParsedCity = {
  id: string;
  countryId: string;
  name: string;
  accomHostel: number | null;
  accomPrivateRoom: number | null;
  accom1star: number | null;
  accom2star: number | null;
  accom3star: number | null;
  accom4star: number | null;
  foodStreet: number | null;
  foodBudget: number | null;
  foodMid: number | null;
  foodHigh: number | null;
  drinksNone: number | null;
  drinksLight: number | null;
  drinksModerate: number | null;
  drinksHeavy: number | null;
  activitiesFree: number | null;
  activitiesBudget: number | null;
  activitiesMid: number | null;
  activitiesHigh: number | null;
  estimationSource: string;
  notes: string;
};

const dbPath = path.join(process.cwd(), 'data', 'travel.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

sqlite.exec(`
CREATE TABLE IF NOT EXISTS countries (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  region        TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user (
  id            TEXT PRIMARY KEY,
  name          TEXT,
  email         TEXT UNIQUE,
  emailVerified INTEGER,
  image         TEXT
);

CREATE TABLE IF NOT EXISTS account (
  userId            TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  type              TEXT NOT NULL,
  provider          TEXT NOT NULL,
  providerAccountId TEXT NOT NULL,
  refresh_token     TEXT,
  access_token      TEXT,
  expires_at        INTEGER,
  token_type        TEXT,
  scope             TEXT,
  id_token          TEXT,
  session_state     TEXT,
  PRIMARY KEY (provider, providerAccountId)
);

CREATE TABLE IF NOT EXISTS session (
  sessionToken TEXT PRIMARY KEY,
  userId       TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expires      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verificationToken (
  identifier TEXT NOT NULL,
  token      TEXT NOT NULL,
  expires    INTEGER NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id            TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  planner_group_size INTEGER NOT NULL DEFAULT 2,
  created_at         TEXT DEFAULT (datetime('now')),
  updated_at         TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cities (
  id              TEXT PRIMARY KEY,
  country_id      TEXT NOT NULL REFERENCES countries(id),
  name            TEXT NOT NULL,
  accom_hostel    REAL,
  accom_private_room REAL,
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
  drinks_none     REAL,
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
  user_id         TEXT REFERENCES user(id) ON DELETE CASCADE,
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
  sort_order      INTEGER,
  notes           TEXT,
  status          TEXT DEFAULT 'planned'
);

CREATE TABLE IF NOT EXISTS itinerary_leg_transports (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  leg_id          INTEGER NOT NULL REFERENCES itinerary_legs(id) ON DELETE CASCADE,
  mode            TEXT,
  note            TEXT,
  cost            REAL NOT NULL DEFAULT 0,
  sort_order      INTEGER
);

CREATE TABLE IF NOT EXISTS expenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT REFERENCES user(id) ON DELETE CASCADE,
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
  user_id         TEXT REFERENCES user(id) ON DELETE CASCADE,
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
  user_id         TEXT REFERENCES user(id) ON DELETE CASCADE,
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
  prompt_version  TEXT,
  data_json       TEXT NOT NULL,
  anchors_json    TEXT,
  metadata_json   TEXT,
  reasoning       TEXT,
  confidence      TEXT,
  numbeo_items    TEXT,
  xotelo_data     TEXT,
  is_active       INTEGER DEFAULT 1
);
`);

const cityColumns = sqlite.prepare("PRAGMA table_info(cities)").all() as Array<{ name: string }>;
const hasDrinksNoneColumn = cityColumns.some((column) => column.name === 'drinks_none');

if (!hasDrinksNoneColumn) {
  sqlite.exec('ALTER TABLE cities ADD COLUMN drinks_none REAL');
}

sqlite.exec(`
  UPDATE cities
  SET drinks_none = ROUND(drink_coffee * 2, 2)
  WHERE drinks_none IS NULL
    AND drink_coffee IS NOT NULL
`);

sqlite.prepare(`
  INSERT INTO app_settings (key, value)
  VALUES ('planner_group_size', '2')
  ON CONFLICT(key) DO NOTHING
`).run();

function findFile(candidates: string[]): string {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`Expected file was not found. Tried: ${candidates.join(', ')}`);
}

function parseMoney(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function loadLegacySeedData(): LegacySeedData {
  const legacySeedPath = path.join(process.cwd(), 'seed-data', 'cities.json');
  return JSON.parse(fs.readFileSync(legacySeedPath, 'utf-8')) as LegacySeedData;
}

function loadCsvRows(): CityCostCsvRow[] {
  const csvPath = findFile([
    path.join(process.cwd(), 'city_costs_app_aud.csv'),
    path.join(process.cwd(), '..', 'city_costs_app_aud.csv'),
  ]);

  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const parsed = Papa.parse<CityCostCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(`Failed to parse city_costs_app_aud.csv: ${parsed.errors[0]?.message || 'unknown error'}`);
  }

  return parsed.data;
}

function buildDataset(legacySeedData: LegacySeedData, csvRows: CityCostCsvRow[]) {
  const legacyCountriesByName = new Map(legacySeedData.countries.map((country) => [country.name, country]));
  const legacyCountryNamesById = new Map(legacySeedData.countries.map((country) => [country.id, country.name]));
  const legacyCitiesByKey = new Map(
    legacySeedData.cities.map((city) => [`${legacyCountryNamesById.get(city.countryId)}::${city.name}`, city])
  );

  const countriesByName = new Map<string, ParsedCountry>();
  for (const row of csvRows) {
    if (countriesByName.has(row.country)) continue;

    const legacyCountry = legacyCountriesByName.get(row.country);
    countriesByName.set(row.country, {
      id: legacyCountry?.id ?? slugifyId(row.country),
      name: row.country,
      currencyCode: legacyCountry?.currencyCode ?? getCountryCurrencyCode(row.country),
      region: legacyCountry?.region ?? normalizeRegionLabel(row.region),
    });
  }

  const usedCityIds = new Set<string>();
  const cities: ParsedCity[] = [];

  for (const row of csvRows) {
    const cityKey = `${row.country}::${row.city}`;
    const legacyCity = legacyCitiesByKey.get(cityKey);
    const country = countriesByName.get(row.country);
    if (!country) {
      throw new Error(`Unable to resolve country metadata for ${row.country}`);
    }

    let cityId = legacyCity?.id ?? slugifyId(row.city);
    if (!legacyCity) {
      if (usedCityIds.has(cityId)) {
        cityId = `${cityId}-${country.id}`;
      }
      let collisionCounter = 2;
      while (usedCityIds.has(cityId)) {
        cityId = `${slugifyId(row.city)}-${country.id}-${collisionCounter}`;
        collisionCounter += 1;
      }
    }

    usedCityIds.add(cityId);

    cities.push({
      id: cityId,
      countryId: country.id,
      name: row.city,
      accomHostel: parseMoney(row.accom_shared_hostel_dorm),
      accomPrivateRoom: parseMoney(row.accom_hostel_private_room),
      accom1star: parseMoney(row.accom_1_star),
      accom2star: parseMoney(row.accom_2_star),
      accom3star: parseMoney(row.accom_3_star),
      accom4star: parseMoney(row.accom_4_star),
      foodStreet: parseMoney(row.food_street_food),
      foodBudget: parseMoney(row.food_budget),
      foodMid: parseMoney(row.food_mid_range),
      foodHigh: parseMoney(row.food_high_end),
      drinksNone: null,
      drinksLight: parseMoney(row.drinks_light),
      drinksModerate: parseMoney(row.drinks_moderate),
      drinksHeavy: parseMoney(row.drinks_heavy),
      activitiesFree: parseMoney(row.activities_free),
      activitiesBudget: parseMoney(row.activities_budget),
      activitiesMid: parseMoney(row.activities_mid_range),
      activitiesHigh: parseMoney(row.activities_high_end),
      estimationSource: 'base_csv_apr_2026',
      notes: 'Imported from city_costs_app_aud.csv. Transport is manual-only at plan level.',
    });
  }

  return {
    countries: Array.from(countriesByName.values()).sort((a, b) => a.name.localeCompare(b.name)),
    cities,
  };
}

const legacySeedData = loadLegacySeedData();
const csvRows = loadCsvRows();
const dataset = buildDataset(legacySeedData, csvRows);
const seededAt = new Date().toISOString();

const upsertCountry = sqlite.prepare(`
  INSERT INTO countries (id, name, currency_code, region)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    currency_code = excluded.currency_code,
    region = excluded.region
`);

const upsertCity = sqlite.prepare(`
  INSERT INTO cities (
    id, country_id, name,
    accom_hostel, accom_private_room, accom_1star, accom_2star, accom_3star, accom_4star,
    food_street, food_budget, food_mid, food_high,
    drink_local_beer, drink_import_beer, drink_wine_glass, drink_cocktail, drink_coffee,
    drinks_none, drinks_light, drinks_moderate, drinks_heavy,
    activities_free, activities_budget, activities_mid, activities_high,
    transport_local, estimation_source, estimated_at, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    country_id = excluded.country_id,
    name = excluded.name,
    accom_hostel = excluded.accom_hostel,
    accom_private_room = excluded.accom_private_room,
    accom_1star = excluded.accom_1star,
    accom_2star = excluded.accom_2star,
    accom_3star = excluded.accom_3star,
    accom_4star = excluded.accom_4star,
    food_street = excluded.food_street,
    food_budget = excluded.food_budget,
    food_mid = excluded.food_mid,
    food_high = excluded.food_high,
    drink_local_beer = excluded.drink_local_beer,
    drink_import_beer = excluded.drink_import_beer,
    drink_wine_glass = excluded.drink_wine_glass,
    drink_cocktail = excluded.drink_cocktail,
    drink_coffee = excluded.drink_coffee,
    drinks_none = excluded.drinks_none,
    drinks_light = excluded.drinks_light,
    drinks_moderate = excluded.drinks_moderate,
    drinks_heavy = excluded.drinks_heavy,
    activities_free = excluded.activities_free,
    activities_budget = excluded.activities_budget,
    activities_mid = excluded.activities_mid,
    activities_high = excluded.activities_high,
    transport_local = excluded.transport_local,
    estimation_source = excluded.estimation_source,
    estimated_at = excluded.estimated_at,
    notes = excluded.notes
`);

const seedAll = sqlite.transaction(() => {
  for (const country of dataset.countries) {
    upsertCountry.run(country.id, country.name, country.currencyCode, country.region);
  }

  for (const city of dataset.cities) {
    upsertCity.run(
      city.id,
      city.countryId,
      city.name,
      city.accomHostel,
      city.accomPrivateRoom,
      city.accom1star,
      city.accom2star,
      city.accom3star,
      city.accom4star,
      city.foodStreet,
      city.foodBudget,
      city.foodMid,
      city.foodHigh,
      null,
      null,
      null,
      null,
      null,
      city.drinksNone,
      city.drinksLight,
      city.drinksModerate,
      city.drinksHeavy,
      city.activitiesFree,
      city.activitiesBudget,
      city.activitiesMid,
      city.activitiesHigh,
      null,
      city.estimationSource,
      seededAt,
      city.notes
    );
  }
});

seedAll();
console.log(`Seeded ${dataset.countries.length} countries and ${dataset.cities.length} cities from city_costs_app_aud.csv.`);
sqlite.close();
