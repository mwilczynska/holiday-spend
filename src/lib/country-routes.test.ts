import fs from 'fs';
import os from 'os';
import path from 'path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cities, cityEstimates, countries } from '@/db/schema';

type DbModule = typeof import('@/db');
type CountriesRouteModule = typeof import('@/app/api/countries/route');
type CitiesRouteModule = typeof import('@/app/api/cities/route');
type EstimatesRouteModule = typeof import('@/app/api/estimates/route');

let dbModule: DbModule;
let countriesRouteModule: CountriesRouteModule;
let citiesRouteModule: CitiesRouteModule;
let estimatesRouteModule: EstimatesRouteModule;
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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-country-routes-'));
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
    dbModule.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS city_estimates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        city_id TEXT NOT NULL REFERENCES cities(id),
        estimated_at TEXT NOT NULL,
        source TEXT NOT NULL,
        llm_provider TEXT,
        llm_model TEXT,
        prompt_version TEXT,
        data_json TEXT NOT NULL,
        anchors_json TEXT,
        metadata_json TEXT,
        reasoning TEXT,
        confidence TEXT,
        numbeo_items TEXT,
        sources_json TEXT,
        input_snapshot_json TEXT,
        fallback_log_json TEXT,
        is_active INTEGER DEFAULT 1
      );
    `);
    countriesRouteModule = await import('@/app/api/countries/route');
    citiesRouteModule = await import('@/app/api/cities/route');
    estimatesRouteModule = await import('@/app/api/estimates/route');
  }, 60000);

  afterAll(() => {
    dbModule?.sqlite.close();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await dbModule.db.delete(cityEstimates);
    await dbModule.db.delete(cities);
    await dbModule.db.delete(countries);
  });

  it('GET /api/countries keeps nested city rows by default', async () => {
    await dbModule.db.insert(countries).values({
      id: 'japan',
      name: 'Japan',
      currencyCode: 'JPY',
      region: 'east_asia',
    });
    await dbModule.db.insert(cities).values({
      id: 'tokyo',
      name: 'Tokyo',
      countryId: 'japan',
    });

    const response = await countriesRouteModule.GET(new Request('http://localhost/api/countries'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data[0].cities).toEqual([
      expect.objectContaining({ id: 'tokyo', name: 'Tokyo', countryId: 'japan' }),
    ]);
  });

  it('GET /api/countries can omit nested city rows for planner startup', async () => {
    await dbModule.db.insert(countries).values({
      id: 'japan',
      name: 'Japan',
      currencyCode: 'JPY',
      region: 'east_asia',
    });
    await dbModule.db.insert(cities).values({
      id: 'tokyo',
      name: 'Tokyo',
      countryId: 'japan',
      notes: 'Large row that the planner does not need.',
    });

    const response = await countriesRouteModule.GET(
      new Request('http://localhost/api/countries?includeCities=false')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual([{
      id: 'japan',
      name: 'Japan',
      currencyCode: 'JPY',
      region: 'east_asia',
    }]);
  });

  it('GET /api/cities planner view keeps cost inputs and omits editor metadata', async () => {
    await dbModule.db.insert(countries).values({
      id: 'japan',
      name: 'Japan',
      currencyCode: 'JPY',
      region: 'east_asia',
    });
    await dbModule.db.insert(cities).values({
      id: 'tokyo',
      name: 'Tokyo',
      countryId: 'japan',
      accom2star: 100,
      foodMid: 50,
      drinksModerate: 25,
      activitiesMid: 40,
      estimationSource: 'test-source',
      notes: 'Editor-only metadata.',
    });

    const response = await citiesRouteModule.GET(
      new Request('http://localhost/api/cities?view=planner')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({
      id: 'tokyo',
      countryId: 'japan',
      name: 'Tokyo',
      accom2star: 100,
      foodMid: 50,
      drinksModerate: 25,
      activitiesMid: 40,
    });
    expect(json.data[0]).not.toHaveProperty('notes');
    expect(json.data[0]).not.toHaveProperty('estimationSource');
  });

  it('GET /api/estimates dataset view returns lightweight current rows', async () => {
    await dbModule.db.insert(countries).values({
      id: 'japan',
      name: 'Japan',
      currencyCode: 'JPY',
      region: 'east_asia',
    });
    await dbModule.db.insert(cities).values({
      id: 'tokyo',
      name: 'Tokyo',
      countryId: 'japan',
      accom2star: 100,
      estimationSource: 'seed',
      estimatedAt: '2026-08-21T00:00:00.000Z',
    });
    const estimate = await dbModule.db.insert(cityEstimates).values({
      cityId: 'tokyo',
      estimatedAt: '2026-08-21T00:00:00.000Z',
      source: 'seed',
      dataJson: '{}',
      reasoning: 'Test history row.',
      isActive: 1,
    }).returning({ id: cityEstimates.id }).get();
    await dbModule.db.update(cities).set({ estimationId: estimate.id }).where(eq(cities.id, 'tokyo'));

    const response = await estimatesRouteModule.GET(
      new Request('http://localhost/api/estimates?view=dataset')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.rows).toHaveLength(1);
    expect(json.data.rows[0]).toHaveProperty('cityId', 'tokyo');
    expect(json.data.rows[0]).toHaveProperty('currentEstimateProvenance');
    expect(json.data.rows[0]).not.toHaveProperty('cityName');
    expect(json.data.rows[0]).not.toHaveProperty('estimateHistory');
    expect(json.data.history).toHaveLength(1);
    expect(json.data.summary.historyCount).toBe(1);
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
