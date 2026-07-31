const DAY_MS = 86400000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DashboardAsOfSource = 'last_transaction' | 'today';

export interface DashboardAsOfDate {
  date: string;
  source: DashboardAsOfSource;
}

export function resolveDashboardAsOfDate(
  expenseDates: Array<string | null | undefined>,
  fallbackDate: string
): DashboardAsOfDate {
  const validDates = expenseDates
    .filter((date): date is string => typeof date === 'string' && ISO_DATE_PATTERN.test(date))
    .sort();

  return {
    date: validDates[validDates.length - 1] ?? fallbackDate,
    source: validDates.length > 0 ? 'last_transaction' : 'today',
  };
}

export function wholeCalendarDaysBetween(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): number {
  if (!startDate || !endDate) return 0;

  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;

  return Math.floor((end - start) / DAY_MS);
}
