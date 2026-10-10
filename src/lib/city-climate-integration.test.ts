import fs from 'fs';
import os from 'os';
import path from 'path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const climate = {
  cityId: 'osaka',
  location: { name: 'Osaka', countryCode: 'JP', latitude: 34.7, longitude: 135.5 },
  period: '2021-2025',
  sourceUrl: 'https://open-meteo.com/',
  grid: { latitude: 34.7, longitude: 135.5, elevation: 10, timezone: 'Asia/Tokyo' },
  months: [{ month: 1, temperatureC: 6, highC: 10, lowC: 2, rainfallMm: 50 }],
};

const generatedCityPayload = {
  city: 'Osaka',
  country: 'Japan',
  region: 'East Asia',
  confidence: 'medium',
  confidence_notes: 'Mocked provider result for integration coverage.',
  anchors_usd: {
    beer: 5,
    coffee: 3,
    inexp_meal_1p: 8,
    midrange_meal_2p: 40,
    cocktail: 10,
    wine_glass: 8,
    hostel_dorm_1p: 20,
    hostel_private_2p: 40,
    hotel_1star_2p: 50,
    hotel_3star_2p: 90,
  },
  tiers_aud: {
    accom_shared_hostel_dorm: 20,
    accom_hostel_private_room: 40,
    accom_1_star: 50,
    accom_2_star: 70,
    accom_3_star: 90,
    accom_4_star: 130,
    food_street_food: 25,
    food_budget: 45,
    food_mid_range: 75,
    food_high_end: 140,
    drinks_none: 6,
    drinks_light: 16,
    drinks_moderate: 36,
    drinks_heavy: 56,
    activities_free: 0,
    activities_budget: 12,
    activities_mid_range: 30,
    activities_high_end: 70,
  },
};

const metadataResponse = {
  city: 'Osaka',
  country: 'Japan',
  confidence_notes: 'The requested city and country are canonical.',
};

const providerMock = vi.fn();
const ensureCityClimateMock = vi.fn();
const collectCityImageMock = vi.fn();

type DbModule = typeof import('@/db');
type GenerationServiceModule = typeof import('@/lib/city-generation-service');
type PlannerResolutionModule = typeof import('@/lib/planner-city-resolution');
type CitiesRouteModule = typeof import('@/app/api/cities/route');

let dbModule: DbModule;
let generationService: GenerationServiceModule;
let plannerResolution: PlannerResolutionModule;
let citiesRoute: CitiesRouteModule;
let tempDir: string;
let originalDbPath: string | undefined;
let originalMethodologyVersion: string | undefined;
let originalV6Flag: string | undefined;

async function postCity(body: Record<string, unknown>) {
  const response = await citiesRoute.POST(new Request('http://localhost/api/cities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  return { response, json: await response.json() };
}

describe.sequential('city climate collection integration', () => {
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-city-climate-'));
    originalDbPath = process.env.HOLIDAY_SPEND_DB_PATH;
    originalMethodologyVersion = process.env.CITY_COST_METHODOLOGY_VERSION;
    originalV6Flag = process.env.CITY_COST_METHODOLOGY_V6;
    process.env.HOLIDAY_SPEND_DB_PATH = path.join(tempDir, 'travel.db');
    process.env.CITY_COST_METHODOLOGY_VERSION = 'v1';
    delete process.env.CITY_COST_METHODOLOGY_V6;
    vi.resetModules();

    dbModule = await import('@/db');
    dbModule.sqlite.exec([
      'CREATE TABLE countries (id TEXT PRIMARY KEY, name TEXT NOT NULL, currency_code TEXT NOT NULL, region TEXT);',
      'CREATE TABLE cities (',
      '  id TEXT PRIMARY KEY, country_id TEXT NOT NULL REFERENCES countries(id), name TEXT NOT NULL,',
      '  accom_hostel REAL, accom_private_room REAL, accom_1star REAL, accom_2star REAL, accom_3star REAL, accom_4star REAL,',
      '  food_street REAL, food_budget REAL, food_mid REAL, food_high REAL,',
      '  drink_local_beer REAL, drink_import_beer REAL, drink_wine_glass REAL, drink_cocktail REAL, drink_coffee REAL,',
      '  drinks_none REAL, drinks_light REAL, drinks_moderate REAL, drinks_heavy REAL,',
      '  activities_free REAL DEFAULT 0, activities_budget REAL, activities_mid REAL, activities_high REAL, transport_local REAL,',
      '  estimation_source TEXT, estimated_at TEXT, estimation_id INTEGER, notes TEXT',
      ');',
      'CREATE TABLE city_estimates (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT, city_id TEXT NOT NULL REFERENCES cities(id), estimated_at TEXT NOT NULL,',
      '  source TEXT NOT NULL, llm_provider TEXT, llm_model TEXT, prompt_version TEXT, data_json TEXT NOT NULL,',
      '  anchors_json TEXT, metadata_json TEXT, reasoning TEXT, confidence TEXT, numbeo_items TEXT, sources_json TEXT,',
      '  input_snapshot_json TEXT, fallback_log_json TEXT, is_active INTEGER DEFAULT 1',
      ');',
    ].join('\n'));

    vi.doMock('@/lib/city-llm-client', () => ({
      runJsonPromptWithProvider: providerMock,
    }));
    vi.doMock('@/lib/city-climate-service', () => ({
      ensureCityClimate: ensureCityClimateMock,
    }));
    vi.doMock('@/lib/city-image-service', () => ({
      collectCityImageQuietly: collectCityImageMock,
    }));
    generationService = await import('@/lib/city-generation-service');
    plannerResolution = await import('@/lib/planner-city-resolution');
    citiesRoute = await import('@/app/api/cities/route');
  }, 60_000);

  afterAll(() => {
    dbModule?.sqlite.close();
    if (originalDbPath === undefined) delete process.env.HOLIDAY_SPEND_DB_PATH;
    else process.env.HOLIDAY_SPEND_DB_PATH = originalDbPath;
    if (originalMethodologyVersion === undefined) delete process.env.CITY_COST_METHODOLOGY_VERSION;
    else process.env.CITY_COST_METHODOLOGY_VERSION = originalMethodologyVersion;
    if (originalV6Flag === undefined) delete process.env.CITY_COST_METHODOLOGY_V6;
    else process.env.CITY_COST_METHODOLOGY_V6 = originalV6Flag;
    vi.doUnmock('@/lib/city-llm-client');
    vi.doUnmock('@/lib/city-climate-service');
    vi.doUnmock('@/lib/city-image-service');
    vi.resetModules();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await dbModule.db.delete(dbModule.schema.cityEstimates);
    await dbModule.db.delete(dbModule.schema.cities);
    await dbModule.db.delete(dbModule.schema.countries);
    providerMock.mockReset();
    providerMock.mockImplementation(async ({ systemPrompt }: { systemPrompt: string }) => ({
      provider: 'openai',
      model: 'mock-city-model',
      text: JSON.stringify(systemPrompt.includes('metadata assistant') ? metadataResponse : generatedCityPayload),
      webSearchUsed: false,
    }));
    ensureCityClimateMock.mockReset();
    ensureCityClimateMock.mockResolvedValue(climate);
    collectCityImageMock.mockReset();
    collectCityImageMock.mockResolvedValue('ok');
    await dbModule.db.insert(dbModule.schema.countries).values({
      id: 'japan',
      name: 'Japan',
      currencyCode: 'JPY',
      region: 'east_asia',
    });
  });

  it('refreshes climate after city-cost persistence and preserves successful costs when weather is unavailable', async () => {
    await dbModule.db.insert(dbModule.schema.cities).values({
      id: 'osaka',
      name: 'Osaka',
      countryId: 'japan',
    });

    const result = await generationService.generateAndPersistCityEstimate({
      cityId: 'osaka',
      provider: 'openai',
    });

    expect(result.climateStatus).toBe('ready');
    expect(ensureCityClimateMock).toHaveBeenCalledWith('osaka', 'Osaka', 'JP', { refresh: true });
    // The photo is collected after climate so it can reuse the verified coordinates.
    expect(result.imageStatus).toBe('ok');
    expect(collectCityImageMock).toHaveBeenCalledWith('osaka');
    expect(collectCityImageMock.mock.invocationCallOrder[0]).toBeGreaterThan(ensureCityClimateMock.mock.invocationCallOrder[0]);
    const persistedCity = await dbModule.db
      .select()
      .from(dbModule.schema.cities)
      .where(eq(dbModule.schema.cities.id, 'osaka'))
      .get();
    const activeEstimate = await dbModule.db
      .select()
      .from(dbModule.schema.cityEstimates)
      .where(eq(dbModule.schema.cityEstimates.cityId, 'osaka'))
      .get();
    expect(persistedCity?.estimationSource).toBe('llm_city_generation');
    expect(activeEstimate?.isActive).toBe(1);

    ensureCityClimateMock.mockResolvedValue(null);
    const refreshed = await generationService.generateAndPersistCityEstimate({
      cityId: 'osaka',
      provider: 'openai',
    });

    expect(refreshed.climateStatus).toBe('unavailable');
    const stillValidCity = await dbModule.db
      .select()
      .from(dbModule.schema.cities)
      .where(eq(dbModule.schema.cities.id, 'osaka'))
      .get();
    expect(stillValidCity?.estimationSource).toBe('llm_city_generation');
    expect(providerMock).toHaveBeenCalledTimes(2);
    expect(ensureCityClimateMock).toHaveBeenCalledTimes(2);
  });

  it('reports stale climate when a refresh fails but a prior result is retained', async () => {
    await dbModule.db.insert(dbModule.schema.cities).values({
      id: 'osaka',
      name: 'Osaka',
      countryId: 'japan',
    });
    ensureCityClimateMock.mockResolvedValue({
      ...climate,
      refreshFailedAt: '2026-10-01T00:00:00.000Z',
    });

    const result = await generationService.generateAndPersistCityEstimate({
      cityId: 'osaka',
      provider: 'openai',
    });

    expect(result.climateStatus).toBe('stale');
    expect(ensureCityClimateMock).toHaveBeenCalledWith('osaka', 'Osaka', 'JP', { refresh: true });
    expect(providerMock).toHaveBeenCalledTimes(1);
  });

  it('collects initial climate for manually created cities using canonical country ISO2', async () => {
    const { response, json } = await postCity({ name: 'Osaka', countryId: 'Japan' });

    expect(response.status).toBe(201);
    expect(json.data).toMatchObject({
      id: 'osaka',
      countryId: 'japan',
      climateStatus: 'ready',
      imageStatus: 'ok',
    });
    expect(ensureCityClimateMock).toHaveBeenCalledWith('osaka', 'Osaka', 'JP', { refresh: false });
    expect(collectCityImageMock).toHaveBeenCalledWith('osaka');
    expect(providerMock).not.toHaveBeenCalled();
  });

  it('returns climate status for a new planner city and does not refresh when an existing city is reused', async () => {
    const input = {
      cityName: 'Osaka',
      countryName: 'Japan',
      provider: 'openai' as const,
    };
    const created = await plannerResolution.resolveOrCreatePlannerCity(input);

    expect(created).toMatchObject({
      cityId: 'osaka',
      createdCity: true,
      generatedCity: true,
      reusedExistingCity: false,
      climateStatus: 'ready',
    });
    expect(ensureCityClimateMock).toHaveBeenCalledTimes(1);
    expect(ensureCityClimateMock).toHaveBeenCalledWith('osaka', 'Osaka', 'JP', { refresh: true });

    const reused = await plannerResolution.resolveOrCreatePlannerCity(input);
    expect(reused).toMatchObject({ cityId: 'osaka', reusedExistingCity: true });
    expect(reused.climateStatus).toBeUndefined();
    expect(ensureCityClimateMock).toHaveBeenCalledTimes(1);
    expect(providerMock).toHaveBeenCalledTimes(2);
  });
});
