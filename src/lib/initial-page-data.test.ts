import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';

let database: typeof import('@/db');
let planner: typeof import('./planner-data');
let settings: typeof import('./settings-data');
let dataset: typeof import('./dataset-data');
let provenance: typeof import('./estimate-data');
let directory: string;
const priorDatabasePath = process.env.HOLIDAY_SPEND_DB_PATH;
const providerFetch = vi.fn(() => { throw new Error('Initial page reads must not contact a provider.'); });

describe.sequential('initial page data', () => {
  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-initial-data-'));
    process.env.HOLIDAY_SPEND_DB_PATH = path.join(directory, 'test.db');
    const fixture = new Database(process.env.HOLIDAY_SPEND_DB_PATH);
    // Create the declared tables without loading local data or running the seed command.
    for (const table of Object.values(schema)) {
      const config = getTableConfig(table);
      fixture.exec(`CREATE TABLE "${config.name}" (${config.columns.map(column =>
        `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`
      ).join(', ')})`);
    }
    fixture.close();
    vi.resetModules();
    vi.stubGlobal('fetch', providerFetch);
    database = await import('@/db');
    planner = await import('./planner-data');
    settings = await import('./settings-data');
    dataset = await import('./dataset-data');
    provenance = await import('./estimate-data');
    const db = database.db;
    await db.insert(schema.users).values([{ id: 'alice' }, { id: 'bob' }]);
    await db.insert(schema.countries).values({ id: 'japan', name: 'Japan', currencyCode: 'JPY' });
    await db.insert(schema.cities).values(['tokyo', 'osaka'].map(id => ({
      id, name: id === 'tokyo' ? 'Tokyo' : 'Osaka', countryId: 'japan',
      accom2star: 100, foodMid: 40, drinksModerate: 20, activitiesMid: 10,
      estimationId: id === 'tokyo' ? 1 : null,
    })));
    await db.insert(schema.userPreferences).values([
      { userId: 'alice', plannerGroupSize: 3, llmMaxOutputTokens: 32000, llmRequestTimeoutMs: 90000 },
      { userId: 'bob', plannerGroupSize: 1 },
    ]);
    await db.insert(schema.itineraryLegs).values([
      { id: 1, userId: 'alice', cityId: 'tokyo', nights: 2, startDate: '2026-10-01', sortOrder: 0 },
      { id: 2, userId: 'alice', cityId: 'osaka', nights: 1, sortOrder: 1 },
      { id: 3, userId: 'bob', cityId: 'tokyo', nights: 20, sortOrder: 0 },
    ]);
    await db.insert(schema.itineraryLegTransports).values([
      { legId: 1, mode: 'train', cost: 30, sortOrder: 0 },
      { legId: 3, mode: 'train', cost: 500, sortOrder: 0 },
    ]);
    await db.insert(schema.fixedCosts).values([
      { userId: 'alice', description: 'Alice insurance', amountAud: 500 },
      { userId: 'bob', description: 'Bob flight', amountAud: 900 },
    ]);
    await db.insert(schema.savedPlans).values(['alice', 'bob'].map(userId => ({
      id: userId + '-plan', userId, name: userId + ' plan', snapshotJson: '{}',
      groupSize: 2, legCount: 1, totalNights: 2, totalBudget: 500, fixedCostCount: 1,
    })));
    const climate = {
      cityId: 'tokyo', period: '2021–2025', sourceUrl: 'https://open-meteo.com/', sourceModel: 'era5_seamless',
      location: { name: 'Tokyo', countryCode: 'JP', latitude: 35.7, longitude: 139.7 },
      grid: { latitude: 35.7, longitude: 139.7, elevation: 20, timezone: 'Asia/Tokyo' },
      months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, temperatureC: 15, highC: 20, lowC: 10, rainfallMm: 60 })),
    };
    await db.insert(schema.cityClimate).values([
      { cityId: 'tokyo', cityName: 'Tokyo', countryCode: 'JP', dataJson: JSON.stringify(climate), version: 'era5_seamless_2021_2025_v1', collectedAt: '2026-10-01', lastAttemptAt: '2026-10-01' },
      { cityId: 'osaka', cityName: 'Osaka', countryCode: 'JP', dataJson: null, version: 'era5_seamless_2021_2025_v1', lastAttemptAt: '2026-10-01', lastError: 'Unavailable' },
    ]);
    await db.insert(schema.cityEstimates).values({
      id: 1, cityId: 'tokyo', estimatedAt: '2026-10-01', source: 'llm_city_generation_v1_1',
      dataJson: '{}', anchorsJson: JSON.stringify({ coffee: 3 }),
      metadataJson: JSON.stringify({ methodologyVersion: 'v1.1', reasoningEffort: 'max', fx: { asOf: '2026-09-30' } }),
    });
  }, 30000);

  afterAll(() => {
    database?.sqlite.close();
    vi.unstubAllGlobals();
    if (priorDatabasePath === undefined) delete process.env.HOLIDAY_SPEND_DB_PATH;
    else process.env.HOLIDAY_SPEND_DB_PATH = priorDatabasePath;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('scopes itinerary, transport, costs, preferences and saved plans to the caller', async () => {
    const result = await planner.loadPlannerData('alice');
    expect(result.legs.map(leg => leg.id)).toEqual([1, 2]);
    expect(result.groupSize).toBe(3);
    expect(result.legs[0]).toMatchObject({ dailyCost: 302, legTotal: 634, intercityTransportCost: 30 });
    expect(result.legs[1]).toMatchObject({ startDate: '2026-10-03', endDate: '2026-10-04' });
    expect(result.fixedCosts.map(cost => cost.description)).toEqual(['Alice insurance']);
    expect(result.savedPlans.map(plan => plan.id)).toEqual(['alice-plan']);
    expect(result.cities.map(city => city.name)).toEqual(['Osaka', 'Tokyo']);
    expect(result.cities[0]).not.toHaveProperty('notes');
  });

  it('returns saved climate and recorded missing data without collection', async () => {
    const result = await planner.loadPlannerData('alice');
    expect(result.climate.tokyo?.months).toHaveLength(12);
    expect(result.climate.tokyo?.collectedAt).toBe('2026-10-01');
    expect(result.climate.osaka).toBeNull();
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('reads current preferences and costs rather than caching another visit', async () => {
    const first = await settings.loadSettingsData('alice');
    expect(first.llm).toMatchObject({ maxOutputTokens: 32000, requestTimeoutMs: 90000 });
    expect(first.costs.map(cost => cost.description)).toEqual(['Alice insurance']);
    await database.db.update(schema.userPreferences).set({ plannerGroupSize: 4 }).where(eq(schema.userPreferences.userId, 'alice'));
    expect((await settings.loadSettingsData('alice')).groupSize).toBe(4);
    expect((await settings.loadSettingsData('bob')).groupSize).toBe(1);
  });

  it('keeps list provenance slim and provides full details on demand', async () => {
    const result = await dataset.loadDatasetData();
    expect(result.countries[0].cities).toHaveLength(2);
    expect(result.historyCount).toBe(1);
    const city = result.countries[0].cities.find(row => row.id === 'tokyo')!;
    expect(city.currentEstimateProvenance).toMatchObject({ methodologyVersion: 'v1.1', reasoningEffort: 'max' });
    expect(city.currentEstimateProvenance).not.toHaveProperty('anchors');
    expect(city.currentEstimateProvenance).not.toHaveProperty('fx');
    expect((await provenance.loadCityProvenance('tokyo')).currentEstimateProvenance?.anchors).toEqual({ coffee: 3 });
  });
});
