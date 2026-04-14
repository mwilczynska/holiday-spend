import { deriveLegDates } from '@/lib/itinerary-leg-dates';

interface DatedLeg {
  startDate: string | null;
  endDate: string | null;
  nights: number;
  sortOrder?: number | null;
}

export function getTripWindow(legs: DatedLeg[]): {
  tripStart: string | null;
  tripEnd: string | null;
} {
  const derivedLegs = deriveLegDates(legs);
  const legDates = derivedLegs.filter((leg) => leg.startDate).map((leg) => leg.startDate!).sort();
  const legEndDates = derivedLegs.filter((leg) => leg.endDate).map((leg) => leg.endDate!).sort();

  return {
    tripStart: legDates[0] || null,
    tripEnd: legEndDates[legEndDates.length - 1] || null,
  };
}

export function isWithinTripWindow(
  date: string,
  tripStart: string | null,
  tripEnd: string | null
): boolean {
  if (!date) return false;
  if (tripStart && date < tripStart) return false;
  if (tripEnd && date > tripEnd) return false;
  return true;
}
