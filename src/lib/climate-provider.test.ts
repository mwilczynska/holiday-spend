import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCityClimate, getClimateModel, parseArchiveClimate, resolveClimateLocation } from './climate-provider';

const numericFields = [
  'temperature_2m_mean',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
] as const;

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

type GeocodingPlace = {
  name: string;
  country_code: string;
  feature_code: string;
  population?: number;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  latitude: number;
  longitude: number;
};

function place(name: string, country_code: string, population = 100_000, details: Partial<GeocodingPlace> = {}): GeocodingPlace {
  return {
    name,
    country_code,
    feature_code: 'PPLC',
    population,
    latitude: 12.5,
    longitude: -45.25,
    ...details,
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
    const location = resolveClimateLocation({ results: [
      place('San Jose', 'US', 1_000_000),
      place('San José', 'CR', 340_000),
    ] }, 'San Jose', 'CR');

    expect(location).toMatchObject({
      name: 'San José', countryCode: 'CR', latitude: 12.5, longitude: -45.25, queryName: 'San Jose',
    });
    const source = new URL(location.sourceUrl);
    expect(source.origin + source.pathname).toBe('https://geocoding-api.open-meteo.com/v1/search');
    expect(Object.fromEntries(source.searchParams)).toMatchObject({ name: 'San Jose', countryCode: 'CR' });
  });

  it.each([
    { city: 'Hanoi', code: 'VN', result: place('Hanoi', 'VN', 8_053_663, { feature_code: 'PPLC', admin1: 'Hanoi', latitude: 21.0245, longitude: 105.84117 }) },
    { city: 'Ho Chi Minh City', code: 'VN', result: place('Ho Chi Minh City', 'VN', 14_002_598, { feature_code: 'PPL', admin1: 'Ho Chi Minh City (HCMC)', latitude: 10.82302, longitude: 106.62965 }) },
    { city: 'Mui Ne', code: 'VN', result: place('Mui Ne', 'VN', 50_166, { feature_code: 'PPL', admin1: 'Lam Dong', latitude: 10.93314, longitude: 108.28327 }) },
    { city: 'Hue', code: 'VN', result: place('Huế', 'VN', 1_380_000, { feature_code: 'PPLA', admin1: 'Thừa Thiên Huế Province', latitude: 16.4619, longitude: 107.59546 }) },
  ])('resolves the saved city identity exactly for $city', ({ city, code, result }) => {
    const location = resolveClimateLocation({ results: [result] }, city, code);

    expect(location.name).toBe(result.name);
    expect(location.countryCode).toBe(code);
    expect(location.queryName).toBe(city);
    expect(location.latitude).toBe(result.latitude);
    expect(location.longitude).toBe(result.longitude);
    expect(Object.fromEntries(new URL(location.sourceUrl).searchParams)).toMatchObject({ name: city, countryCode: code });
  });

  it('constrains Bali (Canggu) to the Bali administrative area', () => {
    const location = resolveClimateLocation({ results: [
      place('Canggu', 'ID', 100_000, { admin1: 'East Java', latitude: -7.7478, longitude: 112.2203 }),
      place('Canggu', 'ID', 50_000, { admin1: 'Bali', latitude: -8.64009, longitude: 115.14011 }),
      place('Canggu', 'ID', 25_000, { admin1: 'Lampung', latitude: -5.72556, longitude: 105.60772 }),
    ] }, 'Bali (Canggu)', 'ID');

    expect(location).toMatchObject({
      name: 'Canggu', countryCode: 'ID', latitude: -8.64009, longitude: 115.14011, queryName: 'Canggu',
    });
    expect(new URL(location.sourceUrl).searchParams.get('name')).toBe('Canggu');
  });

  it('allows the exact Don Det island result in Laos', () => {
    const location = resolveClimateLocation({ results: [
      place('Don Dét', 'LA', 1, { feature_code: 'ISL', admin1: 'Champasak Province', latitude: 13.97447, longitude: 105.92185 }),
    ] }, 'Don Det', 'LA');

    expect(location).toMatchObject({
      name: 'Don Dét', countryCode: 'LA', queryName: 'Don Det', latitude: 13.97447, longitude: 105.92185,
    });
  });

  it('resolves the legacy Bali (Ubud/Canggu) label to the exact Bali island feature', () => {
    const location = resolveClimateLocation({ results: [
      place('Bali', 'ID', 4_225_384, { feature_code: 'ISL', admin1: 'Bali', latitude: -8.33333, longitude: 115 }),
      place('Bali', 'ID', 10_000_000, { feature_code: 'PPL', admin1: 'North Sumatra', latitude: -0.13946, longitude: 98.186 }),
    ] }, 'Bali (Ubud/Canggu)', 'ID');

    expect(location).toMatchObject({ name: 'Bali', countryCode: 'ID', queryName: 'Bali', latitude: -8.33333, longitude: 115 });
  });

  it.each([
    {
      city: 'Bantayan (Bantayan)', countryCode: 'PH', queryName: 'Bantayan',
      target: place('Bantayan', 'PH', 87_394, { feature_code: 'PPLA3', admin1: 'Central Visayas', admin2: 'Province of Cebu', admin3: 'Bantayan', latitude: 11.1683, longitude: 123.7223 }),
      decoy: place('Bantayan', 'PH', 1_000_000, { feature_code: 'PPLA3', admin1: 'Eastern Visayas', admin2: 'Northern Samar', admin3: 'San Roque', latitude: 12.5237, longitude: 124.8283 }),
    },
    {
      city: 'Palawan (El Nido)', countryCode: 'PH', queryName: 'El Nido',
      target: place('El Nido', 'PH', 51_367, { feature_code: 'PPLA3', admin1: 'Mimaropa', admin2: 'Province of Palawan', admin3: 'El Nido', latitude: 11.18583, longitude: 119.39556 }),
      decoy: place('El Nido', 'PH', 1_000_000, { feature_code: 'PPLA3', admin1: 'Other region', admin2: 'Other province', admin3: 'El Nido', latitude: 15, longitude: 120 }),
    },
    {
      city: 'Santa Fe (Bantayan)', countryCode: 'PH', queryName: 'Santa Fe',
      target: place('Santa Fe', 'PH', 2_405, { feature_code: 'PPLA3', admin1: 'Central Visayas', admin2: 'Province of Cebu', admin3: 'Municipality of Santa Fe', latitude: 11.1544, longitude: 123.8058 }),
      decoy: place('Santa Fe', 'PH', 3_010, { feature_code: 'PPLA3', admin1: 'Eastern Visayas', admin2: 'Province of Leyte', admin3: 'Municipality of Santa Fe', latitude: 11.18556, longitude: 124.91611 }),
    },
    {
      city: 'Koh Lanta', countryCode: 'TH', queryName: 'Ko Lanta Yai',
      target: place('Ko Lanta Yai', 'TH', 0, { feature_code: 'ISL', admin1: 'Krabi', latitude: 7.56593, longitude: 99.05654 }),
      decoy: place('Ko Lanta Yai', 'TH', 6_090, { feature_code: 'PPL', admin1: 'Krabi', latitude: 7.53362, longitude: 99.08647 }),
      expectedSourceUrl: 'https://www.geonames.org/1152414/ko-lanta-yai.html',
    },
  ])('applies the saved qualifier for $city', ({ city, countryCode, queryName, target, decoy, expectedSourceUrl }) => {
    const location = resolveClimateLocation({ results: [decoy, target] }, city, countryCode);

    expect(location.name).toBe(queryName);
    expect(location.countryCode).toBe(countryCode);
    expect(location.queryName).toBe(queryName);
    expect(location.latitude).toBe(target.latitude);
    expect(location.longitude).toBe(target.longitude);
    if (expectedSourceUrl) {
      expect(location.sourceUrl).toBe(expectedSourceUrl);
    } else {
      expect(Object.fromEntries(new URL(location.sourceUrl).searchParams)).toMatchObject({ name: queryName, countryCode });
    }
  });

  it('uses a verified Pu Luong Nature Reserve coordinate override with source provenance', () => {
    const location = resolveClimateLocation({ results: [
      place('Phu Lương', 'VN', 0, { feature_code: 'MT', admin1: 'Lao Cai', latitude: 21.58333, longitude: 104.31667 }),
    ] }, 'Pu Luong', 'VN');

    expect(location).toEqual({
      name: 'Pu Luong Nature Reserve',
      countryCode: 'VN',
      latitude: 20.46653,
      longitude: 105.17268,
      queryName: 'Pu Luong',
      sourceUrl: 'https://www.openstreetmap.org/node/5191527721',
    });
  });
});

describe('fetchCityClimate provider requests', () => {
  it('selects IFS only for Salento, Colombia; an identical name in another country keeps the default', () => {
    expect(getClimateModel('Salento', 'CO')).toBe('ecmwf_ifs');
    expect(getClimateModel('SALENTO', 'co')).toBe('ecmwf_ifs');
    expect(getClimateModel('Salento', 'ES')).toBe('era5_seamless');
    expect(getClimateModel('Salento del Sur', 'CO')).toBe('era5_seamless');
    expect(getClimateModel('Bogota', 'CO')).toBe('era5_seamless');
  });
  it('requests exact geocoding and the complete ERA5 Archive period with required variables and units', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(bogotaSearchResponse()))
      .mockResolvedValueOnce(jsonResponse(dailyPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const climate = await fetchCityClimate('bogota-id', 'Bogotá', 'CO');

    expect(climate.cityId).toBe('bogota-id');
    expect(climate.sourceModel).toBe('era5_seamless');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const geocodingUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(geocodingUrl.origin + geocodingUrl.pathname)
      .toBe('https://geocoding-api.open-meteo.com/v1/search');
    expect(Object.fromEntries(geocodingUrl.searchParams)).toMatchObject({
      name: 'Bogotá', countryCode: 'CO', count: '100', language: 'en', format: 'json',
    });
    expect(climate.location.queryName).toBe('Bogotá');
    expect(climate.location.sourceUrl).toBe(geocodingUrl.toString());

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

  it('uses IFS for Salento, preserves the common five-year period, and keeps parsed values unscaled', async () => {
    const archive = dailyPayload();
    archive.latitude = 4.6045694;
    archive.longitude = -75.60297;
    archive.elevation = 1979;
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ results: [
        place('Salento', 'CO', 7_000, { admin1: 'Quindio', latitude: 4.6375, longitude: -75.57028 }),
      ] }))
      .mockResolvedValueOnce(jsonResponse(archive));
    vi.stubGlobal('fetch', fetchMock);

    const climate = await fetchCityClimate('salento-id', 'Salento', 'CO');

    expect(climate.sourceModel).toBe('ecmwf_ifs');
    expect(climate.period).toBe('2021–2025');
    expect(climate.months[0]).toEqual({ month: 1, temperatureC: 1, highC: 11, lowC: -4, rainfallMm: 46.5 });
    expect(climate.grid).toEqual({ latitude: 4.6045694, longitude: -75.60297, elevation: 1979, timezone: 'America/Bogota' });
    const archiveUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(Object.fromEntries(archiveUrl.searchParams)).toMatchObject({
      models: 'ecmwf_ifs',
      daily: 'temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum',
      timezone: 'auto',
      temperature_unit: 'celsius',
      precipitation_unit: 'mm',
      latitude: '4.6375',
      longitude: '-75.57028',
      start_date: '2021-01-01',
      end_date: '2025-12-31',
    });
    expect(climate.sourceUrl).toBe(archiveUrl.toString());
  });

  it('uses the Bali qualifier when requesting Canggu coordinates and keeps the requested country', async () => {
    const archive = dailyPayload();
    archive.latitude = -8.64009;
    archive.longitude = 115.14011;
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ results: [
        place('Canggu', 'ID', 100_000, { admin1: 'East Java', latitude: -7.7478, longitude: 112.2203 }),
        place('Canggu', 'ID', 50_000, { admin1: 'Bali', latitude: -8.64009, longitude: 115.14011 }),
      ] }))
      .mockResolvedValueOnce(jsonResponse(archive));
    vi.stubGlobal('fetch', fetchMock);

    const climate = await fetchCityClimate('bali-canggu', 'Bali (Canggu)', 'ID');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const geocodingUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(Object.fromEntries(geocodingUrl.searchParams)).toMatchObject({ name: 'Canggu', countryCode: 'ID' });
    expect(climate.location).toMatchObject({ name: 'Canggu', countryCode: 'ID', queryName: 'Canggu', latitude: -8.64009, longitude: 115.14011 });
    expect(climate.location.sourceUrl).toBe(geocodingUrl.toString());
    const archiveUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(Object.fromEntries(archiveUrl.searchParams)).toMatchObject({ latitude: '-8.64009', longitude: '115.14011' });
  });

  it('uses the cited Pu Luong reserve coordinate without querying a namesake mountain', async () => {
    const archive = dailyPayload();
    archive.latitude = 20.46653;
    archive.longitude = 105.17268;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse(archive));
    vi.stubGlobal('fetch', fetchMock);

    const climate = await fetchCityClimate('pu-luong', 'Pu Luong', 'VN');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(fetchMock.mock.calls[0][0] as string).origin).toBe('https://archive-api.open-meteo.com');
    expect(climate.location).toEqual({
      name: 'Pu Luong Nature Reserve', countryCode: 'VN', latitude: 20.46653, longitude: 105.17268,
      queryName: 'Pu Luong', sourceUrl: 'https://www.openstreetmap.org/node/5191527721',
    });
    expect(Object.fromEntries(new URL(fetchMock.mock.calls[0][0] as string).searchParams))
      .toMatchObject({ latitude: '20.46653', longitude: '105.17268' });
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
