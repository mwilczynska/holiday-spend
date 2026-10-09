import type { BurnRatePoint } from './dashboard-chart-parts';

export interface DerivedLeg {
  cityName: string;
  countryName: string | null;
  startDate: string;
  endDate: string;
  nights: number;
  planned: number;
  actual: number;
  status: string | null;
}

export interface TripPosition {
  current: (DerivedLeg & { dayOfLeg: number; nightsLeft: number }) | null;
  next: DerivedLeg | null;
}

/**
 * The burn series has one point per trip date, tagged with the city planned for that date. Runs
 * of the same city are treated as one leg, so the dashboard can name where the traveller is and
 * where they go next without another request. Dates without a city break a run.
 */
export function deriveLegs(points: BurnRatePoint[]): DerivedLeg[] {
  const legs: DerivedLeg[] = [];
  for (const point of points) {
    if (!point.cityName) continue;
    const last = legs[legs.length - 1];
    if (last && last.cityName === point.cityName && last.countryName === point.countryName && isNextDay(last.endDate, point.date)) {
      last.endDate = point.date;
      last.nights += 1;
      last.planned += point.plannedDaily;
      last.actual += point.daily;
      continue;
    }
    legs.push({
      cityName: point.cityName,
      countryName: point.countryName,
      startDate: point.date,
      endDate: point.date,
      nights: 1,
      planned: point.plannedDaily,
      actual: point.daily,
      status: point.legStatus,
    });
  }
  return legs;
}

/** Locates the leg containing the cutoff date and the one after it. Missing data stays null. */
export function deriveTripPosition(points: BurnRatePoint[], asOfDate: string | null | undefined): TripPosition {
  const legs = deriveLegs(points);
  if (legs.length === 0) return { current: null, next: null };

  const currentIndex = asOfDate
    ? legs.findIndex((leg) => leg.startDate <= asOfDate && asOfDate <= leg.endDate)
    : -1;

  if (currentIndex === -1) {
    const upcoming = asOfDate ? legs.find((leg) => leg.startDate > asOfDate) ?? null : null;
    return { current: null, next: upcoming };
  }

  const leg = legs[currentIndex];
  const dayOfLeg = daysBetween(leg.startDate, asOfDate as string) + 1;
  return {
    current: { ...leg, dayOfLeg, nightsLeft: Math.max(leg.nights - dayOfLeg, 0) },
    next: legs[currentIndex + 1] ?? null,
  };
}

function toUtc(date: string) {
  return Date.parse(`${date}T00:00:00Z`);
}

function daysBetween(from: string, to: string) {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

function isNextDay(previous: string, date: string) {
  return daysBetween(previous, date) === 1;
}
