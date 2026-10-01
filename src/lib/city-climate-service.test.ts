import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', async () => {
  const Database = (await import('better-sqlite3')).default;
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('@/db/schema');
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE countries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency_code TEXT NOT NULL,
      region TEXT
    );
    CREATE TABLE cities (
      id TEXT PRIMARY KEY,
      country_id TEXT NOT NULL REFERENCES countries(id),
      name TEXT NOT NULL
    );
    CREATE TABLE city_climate (
      city_id TEXT PRIMARY KEY REFERENCES cities(id) ON DELETE CASCADE,
      city_name TEXT NOT NULL,
      country_code TEXT NOT NULL,
      data_json TEXT,
      collected_at TEXT,
      last_attempt_at TEXT NOT NULL,
      last_error TEXT,
      version TEXT NOT NULL
    );
  `);
  return { db: drizzle(sqlite, { schema }), sqlite, schema };
});

vi.mock('./climate-provider', () => ({
  fetchCityClimate: vi.fn(),
  getClimateModel: vi.fn((name: string, countryCode: string) => name === 'Salento' && countryCode === 'CO' ? 'ecmwf_ifs' : 'era5_seamless'),
}));

import { sqlite } from '@/db';
import type { CityClimate } from './climate';
import { fetchCityClimate, getClimateModel } from './climate-provider';
import {
  CITY_CLIMATE_DATA_VERSION,
  ensureCityClimate,
  getCityClimateDataVersion,
  getStoredCityClimates,
} from './city-climate-service';

const fetchClimateMock = vi.mocked(fetchCityClimate);
const climateModelMock = vi.mocked(getClimateModel);

function makeClimate(cityId: string, temperatureC = 20, sourceModel?: CityClimate['sourceModel']): CityClimate {
  return {
    cityId,
    location: {
      name: 'Bogotá', countryCode: 'CO', latitude: 4.7, longitude: -74.1,
      queryName: 'Bogota', sourceUrl: 'https://geocoding-api.open-meteo.com/v1/search?name=Bogota&countryCode=CO',
    },
    period: '2021–2025',
    sourceUrl: `https://archive-api.open-meteo.com/v1/archive?models=${sourceModel ?? 'era5_seamless'}`,
    ...(sourceModel ? { sourceModel } : {}),
    grid: { latitude: 4.7, longitude: -74.1, elevation: 2600, timezone: 'America/Bogota' },
    months: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      temperatureC,
      highC: temperatureC + 5,
      lowC: temperatureC - 5,
      rainfallMm: 50,
    })),
  };
}

function addCity(cityId: string, name = 'Bogota') {
  sqlite.prepare('INSERT INTO cities (id, country_id, name) VALUES (?, ?, ?)').run(cityId, 'colombia', name);
}

function storedRow(cityId: string) {
  return sqlite.prepare('SELECT * FROM city_climate WHERE city_id = ?').get(cityId) as {
    city_id: string;
    city_name: string;
    country_code: string;
    data_json: string | null;
    collected_at: string | null;
    last_attempt_at: string;
    last_error: string | null;
    version: string;
  } | undefined;
}

beforeEach(() => {
  sqlite.exec('DELETE FROM city_climate; DELETE FROM cities; DELETE FROM countries;');
  sqlite.prepare('INSERT INTO countries (id, name, currency_code, region) VALUES (?, ?, ?, ?)')
    .run('colombia', 'Colombia', 'COP', 'latin_america');
  fetchClimateMock.mockReset();
  climateModelMock.mockClear();
  climateModelMock.mockImplementation((name, countryCode) => name === 'Salento' && countryCode === 'CO' ? 'ecmwf_ifs' : 'era5_seamless');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('city climate persistence', () => {
  it('bulk reads matching stored climates without contacting the provider', async () => {
    addCity('bogota');
    addCity('medellin', 'Medellin');
    fetchClimateMock.mockResolvedValueOnce(makeClimate('bogota'));
    await ensureCityClimate('bogota', 'Bogota', 'CO');

    const result = await getStoredCityClimates(['bogota', 'medellin', 'missing', 'bogota']);

    expect(Object.keys(result)).toEqual(['bogota']);
    expect(result.bogota).toMatchObject({ cityId: 'bogota', collectedAt: expect.any(String) });
    expect(fetchClimateMock).toHaveBeenCalledTimes(1);
  });

  it('persists a success and returns it again without relying on module memory', async () => {
    addCity('bogota');
    fetchClimateMock.mockResolvedValueOnce(makeClimate('bogota'));

    const first = await ensureCityClimate('bogota', 'Bogota', 'CO');
    const second = await ensureCityClimate('bogota', 'Bogota', 'CO');

    expect(first).toMatchObject({ cityId: 'bogota', collectedAt: expect.any(String) });
    expect(second).toMatchObject({ cityId: 'bogota', collectedAt: first?.collectedAt });
    expect(second?.location).toMatchObject({ queryName: 'Bogota', sourceUrl: expect.stringContaining('geocoding-api.open-meteo.com') });
    expect(storedRow('bogota')).toMatchObject({
      city_name: 'Bogota',
      country_code: 'CO',
      version: CITY_CLIMATE_DATA_VERSION,
      last_error: null,
    });
    expect(fetchClimateMock).toHaveBeenCalledTimes(1);
  });

  it('stores an initial failure and does not retry it on ordinary reads', async () => {
    addCity('bogota');
    fetchClimateMock.mockRejectedValueOnce(new Error('upstream unavailable'));

    await expect(ensureCityClimate('bogota', 'Bogota', 'CO')).resolves.toBeNull();
    const stored = await getStoredCityClimates(['bogota', 'medellin']);
    await expect(ensureCityClimate('bogota', 'Bogota', 'CO')).resolves.toBeNull();

    expect(stored).toEqual({ bogota: null });
    expect(storedRow('bogota')).toMatchObject({
      data_json: null,
      collected_at: null,
      last_attempt_at: expect.any(String),
      last_error: 'upstream unavailable',
      version: CITY_CLIMATE_DATA_VERSION,
    });
    expect(fetchClimateMock).toHaveBeenCalledTimes(1);
  });

  it('preserves the last successful climate and records a failed explicit refresh', async () => {
    addCity('bogota');
    fetchClimateMock.mockResolvedValueOnce(makeClimate('bogota', 20));
    const first = await ensureCityClimate('bogota', 'Bogota', 'CO');
    fetchClimateMock.mockRejectedValueOnce(new Error('refresh unavailable'));

    const refreshed = await ensureCityClimate('bogota', 'Bogota', 'CO', { refresh: true });
    const subsequent = await ensureCityClimate('bogota', 'Bogota', 'CO');
    const row = storedRow('bogota');

    expect(refreshed).toMatchObject({
      cityId: 'bogota',
      collectedAt: first?.collectedAt,
      refreshFailedAt: expect.any(String),
    });
    expect(refreshed?.months[0]).toMatchObject({ month: 1, temperatureC: 20 });
    expect(subsequent).toMatchObject({ refreshFailedAt: refreshed?.refreshFailedAt, collectedAt: first?.collectedAt });
    expect(row?.data_json).toBeTruthy();
    expect(row?.collected_at).toBe(first?.collectedAt);
    expect(row?.last_error).toBe('refresh unavailable');
    expect(fetchClimateMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes stale identity and version rows, while rejecting a mismatched caller identity', async () => {
    addCity('bogota');
    fetchClimateMock.mockResolvedValueOnce(makeClimate('bogota'));
    await ensureCityClimate('bogota', 'Bogota', 'CO');
    sqlite.prepare('UPDATE city_climate SET version = ? WHERE city_id = ?').run('old-version', 'bogota');

    expect(await getStoredCityClimates(['bogota'])).toEqual({});
    fetchClimateMock.mockResolvedValueOnce(makeClimate('bogota', 21));
    const refreshedVersion = await ensureCityClimate('bogota', 'Bogota', 'CO');
    expect(refreshedVersion?.months[0].temperatureC).toBe(21);

    sqlite.prepare('UPDATE cities SET name = ? WHERE id = ?').run('Bogotá', 'bogota');
    expect(await getStoredCityClimates(['bogota'])).toEqual({});
    await expect(ensureCityClimate('bogota', 'Bogota', 'CO')).resolves.toBeNull();
    fetchClimateMock.mockResolvedValueOnce(makeClimate('bogota', 22));
    const refreshedIdentity = await ensureCityClimate('bogota', 'Bogotá', 'CO');

    expect(refreshedIdentity?.months[0].temperatureC).toBe(22);
    expect(storedRow('bogota')?.city_name).toBe('Bogotá');
    expect(fetchClimateMock).toHaveBeenCalledTimes(3);
  });

  it('invalidates only Salento when its selected source changes to ECMWF and durably reuses its new model', async () => {
    addCity('bogota', 'Bogota');
    addCity('salento', 'Salento');
    fetchClimateMock.mockResolvedValueOnce(makeClimate('bogota'));
    const bogotaClimate = await ensureCityClimate('bogota', 'Bogota', 'CO');

    const oldSalentoClimate = makeClimate('salento', 19, 'era5_seamless');
    sqlite.prepare(`
      INSERT INTO city_climate (city_id, city_name, country_code, data_json, collected_at, last_attempt_at, last_error, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('salento', 'Salento', 'CO', JSON.stringify(oldSalentoClimate), '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', null, CITY_CLIMATE_DATA_VERSION);

    const beforeRefresh = await getStoredCityClimates(['bogota', 'salento']);
    expect(beforeRefresh.bogota).toMatchObject({ cityId: 'bogota', months: bogotaClimate?.months });
    expect(beforeRefresh.salento).toBeUndefined();
    expect(fetchClimateMock).toHaveBeenCalledTimes(1);
    expect(getCityClimateDataVersion('Bogota', 'CO')).toBe(CITY_CLIMATE_DATA_VERSION);
    expect(getCityClimateDataVersion('Salento', 'CO')).toBe('ecmwf_ifs_2021_2025_v1');

    fetchClimateMock.mockResolvedValueOnce(makeClimate('salento', 18, 'ecmwf_ifs'));
    const newSalentoClimate = await ensureCityClimate('salento', 'Salento', 'CO');
    expect(newSalentoClimate).toMatchObject({ cityId: 'salento', sourceModel: 'ecmwf_ifs' });
    expect(newSalentoClimate?.months[0]).toMatchObject({ month: 1, temperatureC: 18 });
    expect(storedRow('salento')).toMatchObject({
      version: 'ecmwf_ifs_2021_2025_v1',
      last_error: null,
    });

    const afterRefresh = await getStoredCityClimates(['bogota', 'salento']);
    expect(afterRefresh.salento).toMatchObject({ sourceModel: 'ecmwf_ifs', collectedAt: newSalentoClimate?.collectedAt });
    await expect(ensureCityClimate('salento', 'Salento', 'CO')).resolves.toMatchObject({ sourceModel: 'ecmwf_ifs' });
    expect(fetchClimateMock).toHaveBeenCalledTimes(2);
    expect(climateModelMock).toHaveBeenCalledWith('Salento', 'CO');
  });

  it('rejects contradictory model provenance from both storage and collection', async () => {
    addCity('salento', 'Salento');
    const oldModelPayload = makeClimate('salento', 19, 'era5_seamless');
    sqlite.prepare(`
      INSERT INTO city_climate (city_id, city_name, country_code, data_json, collected_at, last_attempt_at, last_error, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('salento', 'Salento', 'CO', JSON.stringify(oldModelPayload), '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', null, getCityClimateDataVersion('Salento', 'CO'));

    expect(await getStoredCityClimates(['salento'])).toEqual({});
    fetchClimateMock.mockResolvedValueOnce(oldModelPayload);
    await expect(ensureCityClimate('salento', 'Salento', 'CO')).resolves.toBeNull();
    expect(storedRow('salento')).toMatchObject({
      data_json: null,
      last_error: expect.stringContaining('different city, model'),
      version: 'ecmwf_ifs_2021_2025_v1',
    });

    fetchClimateMock.mockResolvedValueOnce(makeClimate('salento', 18, 'ecmwf_ifs'));
    await expect(ensureCityClimate('salento', 'Salento', 'CO', { refresh: true })).resolves.toMatchObject({ sourceModel: 'ecmwf_ifs' });
    expect(fetchClimateMock).toHaveBeenCalledTimes(2);
  });

  it('coalesces simultaneous requests per city and limits provider work to three cities', async () => {
    for (const cityId of ['one', 'two', 'three', 'four']) addCity(cityId, cityId);
    let active = 0;
    let maximumActive = 0;
    const releases: Array<(climate: CityClimate) => void> = [];
    fetchClimateMock.mockImplementation(() => new Promise((resolve) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      releases.push((climate) => { active -= 1; resolve(climate); });
    }));

    const first = ensureCityClimate('one', 'one', 'CO');
    const sameCity = ensureCityClimate('one', 'one', 'CO');
    const others = [
      ensureCityClimate('two', 'two', 'CO'),
      ensureCityClimate('three', 'three', 'CO'),
      ensureCityClimate('four', 'four', 'CO'),
    ];

    expect(fetchClimateMock).toHaveBeenCalledTimes(3);
    expect(maximumActive).toBe(3);
    releases[0](makeClimate('one'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchClimateMock).toHaveBeenCalledTimes(4);
    releases[1](makeClimate('two'));
    releases[2](makeClimate('three'));
    releases[3](makeClimate('four'));
    await Promise.all([first, sameCity, ...others]);

    expect(fetchClimateMock).toHaveBeenCalledTimes(4);
    expect(maximumActive).toBe(3);
  });

  it('cascades climate data when its city is deleted', async () => {
    addCity('bogota');
    fetchClimateMock.mockResolvedValueOnce(makeClimate('bogota'));
    await ensureCityClimate('bogota', 'Bogota', 'CO');

    sqlite.prepare('DELETE FROM cities WHERE id = ?').run('bogota');

    expect(storedRow('bogota')).toBeUndefined();
  });

  it('does not persist a result if the city is renamed or deleted during collection', async () => {
    addCity('renamed');
    let releaseRename!: (climate: CityClimate) => void;
    fetchClimateMock.mockImplementationOnce(() => new Promise((resolve) => { releaseRename = resolve; }));
    const renamedRequest = ensureCityClimate('renamed', 'Bogota', 'CO');
    sqlite.prepare('UPDATE cities SET name = ? WHERE id = ?').run('New name', 'renamed');
    releaseRename(makeClimate('renamed'));

    await expect(renamedRequest).resolves.toBeNull();
    expect(storedRow('renamed')?.data_json).toBeNull();
    expect(await getStoredCityClimates(['renamed'])).toEqual({});

    addCity('deleted');
    let releaseDelete!: (climate: CityClimate) => void;
    fetchClimateMock.mockImplementationOnce(() => new Promise((resolve) => { releaseDelete = resolve; }));
    const deletedRequest = ensureCityClimate('deleted', 'Bogota', 'CO');
    sqlite.prepare('DELETE FROM cities WHERE id = ?').run('deleted');
    releaseDelete(makeClimate('deleted'));

    await expect(deletedRequest).resolves.toBeNull();
    expect(storedRow('deleted')).toBeUndefined();
  });

  it('rejects a saved payload whose resolved location is in another country', async () => {
    addCity('bogota');
    const wrongCountry = makeClimate('bogota');
    wrongCountry.location.countryCode = 'AR';
    sqlite.prepare(`
      INSERT INTO city_climate (city_id, city_name, country_code, data_json, collected_at, last_attempt_at, last_error, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('bogota', 'Bogota', 'CO', JSON.stringify(wrongCountry), '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', null, CITY_CLIMATE_DATA_VERSION);

    expect(await getStoredCityClimates(['bogota'])).toEqual({});
    fetchClimateMock.mockResolvedValueOnce(makeClimate('bogota', 21));
    const repaired = await ensureCityClimate('bogota', 'Bogota', 'CO');

    expect(repaired?.location.countryCode).toBe('CO');
    expect(repaired?.months[0].temperatureC).toBe(21);
  });

  it('omits a null marker while this process is still collecting so callers can join it', async () => {
    addCity('bogota');
    let release!: (climate: CityClimate) => void;
    fetchClimateMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const pending = ensureCityClimate('bogota', 'Bogota', 'CO');

    expect(await getStoredCityClimates(['bogota'])).toEqual({});
    const joined = ensureCityClimate('bogota', 'Bogota', 'CO');
    release(makeClimate('bogota'));

    await expect(Promise.all([pending, joined])).resolves.toMatchObject([
      { cityId: 'bogota' },
      { cityId: 'bogota' },
    ]);
    expect(fetchClimateMock).toHaveBeenCalledTimes(1);
  });
});
