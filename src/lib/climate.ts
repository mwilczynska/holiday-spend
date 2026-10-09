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
export interface TripClimateSeriesPoint {
  /** UTC milliseconds; the chart's x position. */
  t: number;
  temperature: number | null;
  /** Average daily low and high for the month, for the shaded band. */
  range: [number, number] | null;
  rainfall: number | null;
  cityName: string | null;
  monthLabel: string | null;
  /** True for the closing point of a stay, which only extends the previous step. */
  isEnd?: boolean;
}

export interface TripClimateStay { legId: number; cityName: string; start: number; end: number }

/**
 * A date-scaled series for the trip chart. Each monthly segment of a stay becomes a step that
 * holds that month's values from its first day until the next segment (or departure), so a long
 * stay reads as a long run and a short one as a short run. Gaps between dated stays, and cities
 * without climate, break the line rather than being bridged.
 */
export function tripClimateSeries(legs: ClimateLeg[], climate: Record<string, CityClimate | null | undefined>, unit: TemperatureUnit) {
  const stays = legs
    .map(leg => ({ leg, segments: climateSegments(leg) }))
    .filter(entry => entry.segments.length > 0)
    .sort((a, b) => a.segments[0].start - b.segments[0].start);

  const points: TripClimateSeriesPoint[] = [];
  const bands: TripClimateStay[] = [];
  let previousEnd: number | null = null;

  for (const { leg, segments } of stays) {
    const start = segments[0].start;
    const end = segments[segments.length - 1].end;
    if (previousEnd != null && start > previousEnd) {
      points.push({ t: previousEnd, temperature: null, range: null, rainfall: null, cityName: null, monthLabel: null });
    }
    bands.push({ legId: leg.id, cityName: leg.cityName, start, end });
    let last: TripClimateSeriesPoint | null = null;
    for (const segment of segments) {
      const values = climate[leg.cityId]?.months.find(month => month.month === segment.month);
      last = {
        t: segment.start,
        temperature: values ? temperature(values.temperatureC, unit) : null,
        range: values ? [temperature(values.lowC, unit), temperature(values.highC, unit)] : null,
        rainfall: values?.rainfallMm ?? null,
        cityName: leg.cityName,
        monthLabel: segment.label,
      };
      points.push(last);
    }
    if (last) points.push({ ...last, t: end, isEnd: true });
    previousEnd = end;
  }

  return { points, stays: bands };
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
