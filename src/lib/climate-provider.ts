import { z } from 'zod';
import { CLIMATE_START_YEAR, CLIMATE_END_YEAR, MONTH_NAMES, type CityClimate } from './climate';

const coordinate = { latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) };
const geocodingSchema = z.object({ results: z.array(z.object({
  name: z.string(), country_code: z.string(), feature_code: z.string(),
  population: z.number().optional(), admin1: z.string().optional(), ...coordinate,
})).optional() });
const archiveSchema = z.object({
  elevation: z.number(), timezone: z.string(), ...coordinate,
  daily_units: z.object({ time: z.literal('iso8601'), temperature_2m_mean: z.literal('°C'), temperature_2m_max: z.literal('°C'), temperature_2m_min: z.literal('°C'), precipitation_sum: z.literal('mm') }),
  daily: z.object({ time: z.array(z.string()), temperature_2m_mean: z.array(z.number()), temperature_2m_max: z.array(z.number()), temperature_2m_min: z.array(z.number()), precipitation_sum: z.array(z.number()) }),
});
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function resolveClimateLocation(payload: unknown, name: string, countryCode: string) {
  // The library names Bali neighborhoods as "Bali (Canggu)" etc. Preserve the
  // province qualifier so a namesake on another Indonesian island cannot match.
  const bali = countryCode === 'ID' ? /^Bali \((Kuta|Ubud|Canggu)\)$/.exec(name) : null;
  const searchName = bali?.[1] ?? name;
  const candidates = (geocodingSchema.parse(payload).results ?? [])
    .filter(row => row.country_code === countryCode && (row.feature_code.startsWith('PPL') || row.feature_code === 'ISL') && normalize(row.name) === normalize(searchName) && (!bali || row.admin1 === 'Bali'))
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  if (!candidates.length) throw new Error('No matching city coordinates found.');
  // Multiple populated places with the same name require disambiguation, unless there is
  // a clear primary city. Never take a foreign-country or fuzzy-name search fallback.
  if (candidates.length > 1 && (candidates[0].population ?? 0) < 10 * (candidates[1].population ?? 1)) {
    throw new Error('City coordinates are ambiguous.');
  }
  const row = candidates[0];
  return { name: row.name, countryCode: row.country_code, latitude: row.latitude, longitude: row.longitude };
}
export function parseArchiveClimate(payload: unknown): Pick<CityClimate, 'period' | 'months' | 'grid'> {
  const data = archiveSchema.parse(payload);
  const expectedDays = (Date.UTC(CLIMATE_END_YEAR + 1, 0, 1) - Date.UTC(CLIMATE_START_YEAR, 0, 1)) / 86400000;
  if (!Object.values(data.daily).every(values => values.length === expectedDays)) throw new Error('Incomplete climate reference period.');
  const sums = MONTH_NAMES.map(() => ({ count: 0, mean: 0, high: 0, low: 0, rain: 0 }));
  // Require every day in the requested five complete years; missing days never become zeros.
  let index = 0;
  for (let date = Date.UTC(CLIMATE_START_YEAR, 0, 1); date < Date.UTC(CLIMATE_END_YEAR + 1, 0, 1); date += 86400000) {
    const day = new Date(date);
    if (data.daily.time[index] !== day.toISOString().slice(0, 10)) throw new Error('Missing or out-of-order climate dates.');
    const temperatureC = data.daily.temperature_2m_mean[index];
    const highC = data.daily.temperature_2m_max[index];
    const lowC = data.daily.temperature_2m_min[index];
    const rainfallDaily = data.daily.precipitation_sum[index];
    if (!Number.isFinite(temperatureC) || temperatureC < -90 || temperatureC > 65 ||
        !Number.isFinite(rainfallDaily) || rainfallDaily < 0 || rainfallDaily > 1000) {
      throw new Error('Incomplete or invalid climate averages.');
    }
    if (![highC, lowC].every(value => Number.isFinite(value) && value >= -90 && value <= 65) || lowC > temperatureC || highC < temperatureC) {
      throw new Error('Incomplete or invalid high/low climate averages.');
    }
    const sum = sums[day.getUTCMonth()];
    sum.count++; sum.mean += temperatureC; sum.high += highC; sum.low += lowC; sum.rain += rainfallDaily;
    index++;
  }
  const months = sums.map((sum, index) => ({ month: index + 1, temperatureC: sum.mean / sum.count,
    highC: sum.high / sum.count, lowC: sum.low / sum.count, rainfallMm: sum.rain / (CLIMATE_END_YEAR - CLIMATE_START_YEAR + 1) }));
  return { period: `${CLIMATE_START_YEAR}–${CLIMATE_END_YEAR}`, months,
    grid: { latitude: data.latitude, longitude: data.longitude, elevation: data.elevation, timezone: data.timezone } };
}
async function fetchJson(url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try { response = await fetch(url, { signal: AbortSignal.timeout(45000), cache: 'no-store' }); }
    catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
      continue;
    }
    if (response.status === 429 && attempt < 2) {
      const retrySeconds = Number(response.headers.get('Retry-After') ?? '60');
      const delay = Number.isFinite(retrySeconds) ? Math.min(60, Math.max(0, retrySeconds)) * 1000 : 60000;
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    if (!response.ok) throw new Error(`Climate provider unavailable (HTTP ${response.status}).`);
    return response.json();
  }
  throw new Error('Climate provider unavailable.');
}
export async function fetchCityClimate(cityId: string, name: string, countryCode: string): Promise<CityClimate> {
  const geocoding = new URL('https://geocoding-api.open-meteo.com/v1/search');
  const searchName = countryCode === 'ID' ? /^Bali \((Kuta|Ubud|Canggu)\)$/.exec(name)?.[1] ?? name : name;
  geocoding.search = new URLSearchParams({ name: searchName, countryCode, count: '100', language: 'en', format: 'json' }).toString();
  const location = resolveClimateLocation(await fetchJson(geocoding.toString()), name, countryCode);
  const archive = new URL('https://archive-api.open-meteo.com/v1/archive');
  archive.search = new URLSearchParams({ daily: 'temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum', models: 'era5_seamless', timezone: 'auto', temperature_unit: 'celsius', precipitation_unit: 'mm', latitude: String(location.latitude), longitude: String(location.longitude), start_date: `${CLIMATE_START_YEAR}-01-01`, end_date: `${CLIMATE_END_YEAR}-12-31` }).toString();
  return { cityId, location, sourceUrl: archive.toString(), ...parseArchiveClimate(await fetchJson(archive.toString())) };
}
