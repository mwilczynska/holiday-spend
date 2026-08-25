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

export interface ExpenseLegResolver<T extends DateBoundLeg = DateBoundLeg> {
  legs: T[];
  findForDate(date: string): T | null;
  resolve(expense: ExpenseWithOptionalLeg): T | null;
  reportingDate(expense: ExpenseWithOptionalLeg): string;
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
  return createExpenseLegResolver(legs).findForDate(date);
}

export function resolveExpenseLeg(
  expense: ExpenseWithOptionalLeg,
  legs: DateBoundLeg[]
): DateBoundLeg | null {
  return createExpenseLegResolver(legs).resolve(expense);
}

export function getExpenseReportingDate(
  expense: ExpenseWithOptionalLeg,
  legs: DateBoundLeg[]
): string {
  return createExpenseLegResolver(legs).reportingDate(expense);
}

export function createExpenseLegResolver<T extends DateBoundLeg>(legs: T[]): ExpenseLegResolver<T> {
  const derivedLegs = deriveLegDates(legs);
  const legsById = new Map(derivedLegs.map((leg) => [leg.id, leg]));
  const legsByExpenseDate = new Map<string, T | null>();

  function findForDate(date: string): T | null {
    if (!date) return null;
    if (legsByExpenseDate.has(date)) return legsByExpenseDate.get(date) ?? null;

    const matchedLeg = derivedLegs
      .filter((leg) => matchesExpenseDate(date, leg))
      .sort(compareLegPriority)[0] ?? null;
    legsByExpenseDate.set(date, matchedLeg);
    return matchedLeg;
  }

  function resolve(expense: ExpenseWithOptionalLeg): T | null {
    if (expense.legId != null) return legsById.get(expense.legId) ?? null;
    return findForDate(expense.date);
  }

  function reportingDate(expense: ExpenseWithOptionalLeg): string {
    const matchedLeg = resolve(expense);
    if (!matchedLeg) return expense.date;

    if (matchedLeg.startDate && expense.date < matchedLeg.startDate) return matchedLeg.startDate;
    if (matchedLeg.endDate && expense.date > matchedLeg.endDate) return matchedLeg.endDate;
    return expense.date;
  }

  return { legs: derivedLegs, findForDate, resolve, reportingDate };
}
