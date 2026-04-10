export interface DateBoundLeg {
  id: number;
  cityId: string;
  startDate: string | null;
  endDate: string | null;
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

  const matches = legs
    .filter((leg) => matchesExpenseDate(date, leg))
    .sort(compareLegPriority);

  return matches[0] ?? null;
}

export function resolveExpenseLeg(
  expense: ExpenseWithOptionalLeg,
  legs: DateBoundLeg[]
): DateBoundLeg | null {
  if (expense.legId != null) {
    return legs.find((leg) => leg.id === expense.legId) ?? null;
  }

  return findLegForExpenseDate(expense.date, legs);
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
