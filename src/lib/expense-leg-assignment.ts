import { deriveLegDates } from '@/lib/itinerary-leg-dates';

export interface DateBoundLeg {
  id: number;
  cityId: string;
  startDate: string | null;
  endDate: string | null;
  nights: number;
  sortOrder: number | null;
}

interface ExpenseWithOptionalLeg {
  date: string;
  legId?: number | null;
}

function matchesExpenseDate(date: string, leg: DateBoundLeg): boolean {
  if (!leg.startDate && !leg.endDate) return false;
  if (leg.startDate && date < leg.startDate) return false;
  if (leg.endDate && date > leg.endDate) return false;
  return true;
}

function compareLegPriority(a: DateBoundLeg, b: DateBoundLeg): number {
  const startCompare = (b.startDate || '').localeCompare(a.startDate || '');
  if (startCompare !== 0) return startCompare;

  const endCompare = (b.endDate || '').localeCompare(a.endDate || '');
  if (endCompare !== 0) return endCompare;

  return (b.sortOrder ?? 0) - (a.sortOrder ?? 0);
}

export function findLegForExpenseDate(
  date: string,
  legs: DateBoundLeg[]
): DateBoundLeg | null {
  if (!date) return null;

  const matches = deriveLegDates(legs)
    .filter((leg) => matchesExpenseDate(date, leg))
    .sort(compareLegPriority);

  return matches[0] ?? null;
}

export function resolveExpenseLeg(
  expense: ExpenseWithOptionalLeg,
  legs: DateBoundLeg[]
): DateBoundLeg | null {
  const derivedLegs = deriveLegDates(legs);

  if (expense.legId != null) {
    return derivedLegs.find((leg) => leg.id === expense.legId) ?? null;
  }

  return findLegForExpenseDate(expense.date, derivedLegs);
}

export function getExpenseReportingDate(
  expense: ExpenseWithOptionalLeg,
  legs: DateBoundLeg[]
): string {
  const matchedLeg = resolveExpenseLeg(expense, legs);
  if (!matchedLeg) return expense.date;

  if (matchedLeg.startDate && expense.date < matchedLeg.startDate) {
    return matchedLeg.startDate;
  }

  if (matchedLeg.endDate && expense.date > matchedLeg.endDate) {
    return matchedLeg.endDate;
  }

  return expense.date;
}
