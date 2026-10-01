export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const CLIMATE_START_YEAR = 2021;
export const CLIMATE_END_YEAR = 2025;
export type TemperatureUnit = 'C' | 'F';
export interface ClimateMonth { month: number; temperatureC: number; highC: number; lowC: number; rainfallMm: number }
export interface CityClimate {
  cityId: string;
  location: { name: string; countryCode: string; latitude: number; longitude: number; queryName?: string; sourceUrl?: string };
  period: string;
  sourceUrl: string;
  sourceModel?: 'era5_seamless' | 'ecmwf_ifs';
  collectedAt?: string;
  refreshFailedAt?: string;
  grid: { latitude: number; longitude: number; elevation: number; timezone: string };
  months: ClimateMonth[];
}
export interface ClimateLeg {
  id: number; cityId: string; cityName: string;
  startDate: string | null; endDate: string | null; nights: number;
}
export function temperature(value: number, unit: TemperatureUnit) { return unit === 'F' ? value * 9 / 5 + 32 : value; }
function parseDate(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}
/** Monthly segments occupied by the leg; departure is exclusive. */
export function climateSegments(leg: ClimateLeg) {
  let start = parseDate(leg.startDate);
  let end = parseDate(leg.endDate);
  const duration = Number.isInteger(leg.nights) && leg.nights > 0 ? leg.nights * 86400000 : null;
  if (start == null && leg.startDate != null || end == null && leg.endDate != null) return [];
  if (start == null && end != null && duration != null) start = end - duration;
  if (end == null && start != null && duration != null) end = start + duration;
  if (start == null || end == null || end <= start || end - start > 3660 * 86400000) return [];
  const result: Array<{ month: number; label: string; start: number; end: number }> = [];
  while (start < end) {
    const date = new Date(start);
    const next = Math.min(end, Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    result.push({ month: date.getUTCMonth() + 1, label: `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`, start, end: next });
    start = next;
  }
  return result;
}
export function tripClimatePoints(legs: ClimateLeg[], climate: Record<string, CityClimate | null | undefined>, unit: TemperatureUnit) {
  return legs.flatMap(leg => climateSegments(leg).map(segment => {
    const values = climate[leg.cityId]?.months.find(month => month.month === segment.month);
    return {
      key: `${leg.id}-${segment.start}`, date: segment.start,
      label: `${leg.cityName} · ${segment.label}`, startDate: new Date(segment.start).toISOString().slice(0, 10),
      endDate: new Date(segment.end).toISOString().slice(0, 10),
      temperature: values ? temperature(values.temperatureC, unit) : null,
      rainfall: values?.rainfallMm ?? null,
    };
  })).sort((a, b) => a.date - b.date);
}
