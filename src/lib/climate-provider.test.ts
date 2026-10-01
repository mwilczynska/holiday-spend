import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCityClimate, parseArchiveClimate, resolveClimateLocation } from './climate-provider';

const numericFields = [
  'temperature_2m_mean',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
] as const;
type NumericField = typeof numericFields[number];

type ArchivePayload = {
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  daily_units: {
    time: string;
    temperature_2m_mean: string;
    temperature_2m_max: string;
    temperature_2m_min: string;
    precipitation_sum: string;
  };
  daily: {
    time: string[];
    temperature_2m_mean: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
};

function dailyPayload(): ArchivePayload {
  const payload: ArchivePayload = {
    latitude: 4.7,
    longitude: -74.1,
    elevation: 2600,
    timezone: 'America/Bogota',
    daily_units: {
      time: 'iso8601',
      temperature_2m_mean: '°C',
      temperature_2m_max: '°C',
      temperature_2m_min: '°C',
      precipitation_sum: 'mm',
    },
    daily: {
      time: [],
      temperature_2m_mean: [],
      temperature_2m_max: [],
      temperature_2m_min: [],
      precipitation_sum: [],
    },
  };

  for (let date = Date.UTC(2021, 0, 1); date < Date.UTC(2026, 0, 1); date += 86400000) {
    const day = new Date(date);
    const mean = day.getUTCMonth() + 1;
    payload.daily.time.push(day.toISOString().slice(0, 10));
    payload.daily.temperature_2m_mean.push(mean);
    payload.daily.temperature_2m_max.push(mean + 10);
    payload.daily.temperature_2m_min.push(mean - 5);
    payload.daily.precipitation_sum.push(1.5);
  }

  return payload;
}

function place(name: string, country_code: string, population = 100_000) {
  return {
    name,
    country_code,
    feature_code: 'PPLC',
    population,
    latitude: 12.5,
    longitude: -45.25,
  };
}

function jsonResponse(value: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), { status, headers });
}

function bogotaSearchResponse() {
  return { results: [{ ...place('Bogotá', 'CO'), latitude: 4.7, longitude: -74.1 }] };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Open-Meteo Archive climate aggregation', () => {
  it('aggregates all 1826 chronological days in 2021–2025, including leap day', () => {
    const payload = dailyPayload();
    expect(payload.daily.time).toHaveLength(1826);
    expect(payload.daily.time[0]).toBe('2021-01-01');
    expect(payload.daily.time.at(-1)).toBe('2025-12-31');

    const result = parseArchiveClimate(payload);

    expect(result.months).toHaveLength(12);
    expect(result.months[0]).toEqual({ month: 1, temperatureC: 1, highC: 11, lowC: -4, rainfallMm: 46.5 });
    // February has 141 days across the five years, including 2024-02-29.
    expect(result.months[1]).toEqual({ month: 2, temperatureC: 2, highC: 12, lowC: -3, rainfallMm: 42.3 });
    expect(result.months[11]).toEqual({ month: 12, temperatureC: 12, highC: 22, lowC: 7, rainfallMm: 46.5 });
    expect(result.grid).toEqual({ latitude: 4.7, longitude: -74.1, elevation: 2600, timezone: 'America/Bogota' });
  });

  it('rejects a missing day from the complete reference period', () => {
    const payload = dailyPayload();
    payload.daily.time.pop();

    expect(() => parseArchiveClimate(payload)).toThrow(/Incomplete climate reference period/);
  });

  it.each([
    ['a gap', '2021-01-03'],
    ['a duplicate', '2021-01-01'],
  ])('rejects %s in the daily date sequence', (_kind, replacement) => {
    const payload = dailyPayload();
    payload.daily.time[1] = replacement;

    expect(() => parseArchiveClimate(payload)).toThrow(/Missing or out-of-order climate dates/);
  });

  it('rejects dates that are complete but out of order', () => {
    const payload = dailyPayload();
    [payload.daily.time[1], payload.daily.time[2]] = [payload.daily.time[2], payload.daily.time[1]];

    expect(() => parseArchiveClimate(payload)).toThrow(/Missing or out-of-order climate dates/);
  });

  it.each(numericFields)('rejects a null daily %s value', (field) => {
    const payload = dailyPayload();
    payload.daily[field][0] = null as unknown as number;

    expect(() => parseArchiveClimate(payload)).toThrow();
  });

  it.each([
    ['temperature_2m_mean', 'F'],
    ['temperature_2m_max', 'F'],
    ['temperature_2m_min', 'F'],
    ['precipitation_sum', 'mm/day'],
  ] as const)('rejects unsupported units for %s', (field, units) => {
    const payload = dailyPayload();
    payload.daily_units[field] = units;

    expect(() => parseArchiveClimate(payload)).toThrow();
  });

  it('rejects unsupported date units', () => {
    const payload = dailyPayload();
    payload.daily_units.time = 'yyyyMMdd';

    expect(() => parseArchiveClimate(payload)).toThrow();
  });

  it('rejects inconsistent high/low observations', () => {
    const payload = dailyPayload();
    payload.daily.temperature_2m_max[0] = 0;

    expect(() => parseArchiveClimate(payload)).toThrow(/high\/low/);
  });
});

describe('climate geocoding', () => {
  it('does not accept an exact city-name match from another country', () => {
    expect(() => resolveClimateLocation({ results: [place('Springfield', 'US')] }, 'Springfield', 'CA'))
      .toThrow(/No matching city coordinates/);
  });

  it('requires disambiguation when same-country exact-name places have similar populations', () => {
    expect(() => resolveClimateLocation({ results: [
      place('San José', 'CR', 340_000),
      place('San Jose', 'CR', 300_000),
    ] }, 'San Jose', 'CR')).toThrow(/ambiguous/);
  });

  it('uses an exact normalized name match in the requested country', () => {
    expect(resolveClimateLocation({ results: [
      place('San Jose', 'US', 1_000_000),
      place('San José', 'CR', 340_000),
    ] }, 'San Jose', 'CR')).toEqual({
      name: 'San José', countryCode: 'CR', latitude: 12.5, longitude: -45.25,
    });
  });
});

describe('fetchCityClimate provider requests', () => {
  it('requests exact geocoding and the complete ERA5 Archive period with required variables and units', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(bogotaSearchResponse()))
      .mockResolvedValueOnce(jsonResponse(dailyPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const climate = await fetchCityClimate('bogota-id', 'Bogotá', 'CO');

    expect(climate.cityId).toBe('bogota-id');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const geocodingUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(geocodingUrl.origin + geocodingUrl.pathname)
      .toBe('https://geocoding-api.open-meteo.com/v1/search');
    expect(Object.fromEntries(geocodingUrl.searchParams)).toMatchObject({
      name: 'Bogotá', countryCode: 'CO', count: '100', language: 'en', format: 'json',
    });

    const archiveUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(archiveUrl.origin + archiveUrl.pathname).toBe('https://archive-api.open-meteo.com/v1/archive');
    expect(Object.fromEntries(archiveUrl.searchParams)).toMatchObject({
      daily: 'temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum',
      models: 'era5_seamless',
      timezone: 'auto',
      temperature_unit: 'celsius',
      precipitation_unit: 'mm',
      latitude: '4.7',
      longitude: '-74.1',
      start_date: '2021-01-01',
      end_date: '2025-12-31',
    });
  });

  it('retries a transient network failure and recovers', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('temporary connection failure'))
      .mockResolvedValueOnce(jsonResponse(bogotaSearchResponse()))
      .mockResolvedValueOnce(jsonResponse(dailyPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const pending = fetchCityClimate('bogota-id', 'Bogotá', 'CO');
    await vi.advanceTimersByTimeAsync(1000);
    const climate = await pending;

    expect(climate.cityId).toBe('bogota-id');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(fetchMock.mock.calls[1][0]);
  });

  it('retries a 429 using Retry-After and recovers', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 429, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(jsonResponse(bogotaSearchResponse()))
      .mockResolvedValueOnce(jsonResponse(dailyPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const climate = await fetchCityClimate('bogota-id', 'Bogotá', 'CO');

    expect(climate.cityId).toBe('bogota-id');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(fetchMock.mock.calls[1][0]);
  });

  it('does not retry a permanent 500 response', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'upstream failure' }, 500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCityClimate('bogota-id', 'Bogotá', 'CO'))
      .rejects.toThrow(/HTTP 500/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an Archive response containing a null daily measurement', async () => {
    const archive = dailyPayload();
    archive.daily.precipitation_sum[0] = null as unknown as number;
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(bogotaSearchResponse()))
      .mockResolvedValueOnce(jsonResponse(archive));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCityClimate('bogota-id', 'Bogotá', 'CO')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
