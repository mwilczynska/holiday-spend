import fs from 'fs';
import os from 'os';
import path from 'path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cities, countries } from '@/db/schema';

type DbModule = typeof import('@/db');
type CountriesRouteModule = typeof import('@/app/api/countries/route');
type CitiesRouteModule = typeof import('@/app/api/cities/route');

let dbModule: DbModule;
let countriesRouteModule: CountriesRouteModule;
let citiesRouteModule: CitiesRouteModule;
let tempDir: string;
const originalCwd = process.cwd();

async function postJson(
  handler: (request: Request) => Promise<Response>,
  body: Record<string, unknown>
) {
  const response = await handler(
    new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

  return {
    response,
    json: await response.json(),
  };
}

describe.sequential('country metadata routes', () => {
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wanderledger-country-routes-'));
    process.chdir(tempDir);
    vi.resetModules();

    dbModule = await import('@/db');
    dbModule.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS countries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        currency_code TEXT NOT NULL,
        region TEXT
      );
    `);
    dbModule.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS cities (
        id TEXT PRIMARY KEY,
        country_id TEXT NOT NULL REFERENCES countries(id),
        name TEXT NOT NULL,
        accom_hostel REAL,
        accom_private_room REAL,
        accom_1star REAL,
        accom_2star REAL,
        accom_3star REAL,
        accom_4star REAL,
        food_street REAL,
        food_budget REAL,
        food_mid REAL,
        food_high REAL,
        drink_local_beer REAL,
        drink_import_beer REAL,
        drink_wine_glass REAL,
        drink_cocktail REAL,
        drink_coffee REAL,
        drinks_none REAL,
        drinks_light REAL,
        drinks_moderate REAL,
        drinks_heavy REAL,
        activities_free REAL DEFAULT 0,
        activities_budget REAL,
        activities_mid REAL,
        activities_high REAL,
        transport_local REAL,
        estimation_source TEXT,
        estimated_at TEXT,
        estimation_id INTEGER,
        notes TEXT
      );
    `);
    countriesRouteModule = await import('@/app/api/countries/route');
    citiesRouteModule = await import('@/app/api/cities/route');
  });

  afterAll(() => {
    dbModule?.sqlite.close();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await dbModule.db.delete(cities);
    await dbModule.db.delete(countries);
  });

  it('POST /api/countries infers canonical metadata for a known country alias', async () => {
    const { response, json } = await postJson(countriesRouteModule.POST, {
      name: 'UK',
    });

    expect(response.status).toBe(201);
    expect(json.data).toEqual({
      id: 'united-kingdom',
      name: 'United Kingdom',
      currencyCode: 'GBP',
      region: 'europe',
    });

    const savedCountry = await dbModule.db
      .select()
      .from(countries)
      .where(eq(countries.id, 'united-kingdom'))
      .get();

    expect(savedCountry).toEqual({
      id: 'united-kingdom',
      name: 'United Kingdom',
      currencyCode: 'GBP',
      region: 'europe',
    });
  });

  it('POST /api/countries rejects canonical duplicates even when the stored row uses a legacy id', async () => {
    await dbModule.db.insert(countries).values({
      id: 'uae',
      name: 'United Arab Emirates',
      currencyCode: 'AED',
      region: 'middle_east',
    });

    const { response, json } = await postJson(countriesRouteModule.POST, {
      name: 'UAE',
    });

    expect(response.status).toBe(409);
    expect(json.error).toContain('already exists');
    expect(json.error).toContain('"uae"');
  });

  it('POST /api/cities auto-creates the canonical country row when missing', async () => {
    const { response, json } = await postJson(citiesRouteModule.POST, {
      name: 'Dubai',
      countryId: 'UAE',
    });

    expect(response.status).toBe(201);
    expect(json.data).toMatchObject({
      id: 'dubai',
      name: 'Dubai',
      countryId: 'united-arab-emirates',
    });

    const savedCountry = await dbModule.db
      .select()
      .from(countries)
      .where(eq(countries.id, 'united-arab-emirates'))
      .get();
    const savedCity = await dbModule.db
      .select()
      .from(cities)
      .where(eq(cities.id, 'dubai'))
      .get();

    expect(savedCountry).toEqual({
      id: 'united-arab-emirates',
      name: 'United Arab Emirates',
      currencyCode: 'AED',
      region: 'middle_east',
    });
    expect(savedCity?.countryId).toBe('united-arab-emirates');
  });

  it('POST /api/cities reuses an equivalent existing country row instead of inserting a duplicate canonical row', async () => {
    await dbModule.db.insert(countries).values({
      id: 'uae',
      name: 'United Arab Emirates',
      currencyCode: 'AED',
      region: 'middle_east',
    });

    const { response, json } = await postJson(citiesRouteModule.POST, {
      name: 'Dubai',
      countryId: 'United Arab Emirates',
    });

    expect(response.status).toBe(201);
    expect(json.data).toMatchObject({
      id: 'dubai',
      name: 'Dubai',
      countryId: 'uae',
    });

    const allCountries = await dbModule.db.select().from(countries);
    expect(allCountries).toEqual([
      {
        id: 'uae',
        name: 'United Arab Emirates',
        currencyCode: 'AED',
        region: 'middle_east',
      },
    ]);
  });

  it('POST /api/cities checks duplicate city ids before auto-creating a new canonical country row', async () => {
    await dbModule.db.insert(countries).values({
      id: 'france',
      name: 'France',
      currencyCode: 'EUR',
      region: 'europe',
    });
    await dbModule.db.insert(cities).values({
      id: 'paris',
      name: 'Paris',
      countryId: 'france',
      estimatedAt: new Date('2026-04-17T00:00:00.000Z').toISOString(),
      estimationSource: 'seed',
    });

    const { response, json } = await postJson(citiesRouteModule.POST, {
      name: 'Paris',
      countryId: 'UAE',
    });

    expect(response.status).toBe(409);
    expect(json.error).toContain('City id "paris" already exists');

    const createdCountry = await dbModule.db
      .select()
      .from(countries)
      .where(eq(countries.id, 'united-arab-emirates'))
      .get();

    expect(createdCountry).toBeUndefined();
  });
});
