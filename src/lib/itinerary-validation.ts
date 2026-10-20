interface LegDates {
  startDate?: string | null;
  endDate?: string | null;
  nights?: number | null;
}

// A date input reports a complete date on every keystroke, so typing "2026" into its year field passes through
// years 0002, 0020 and 0202. Those are real calendar dates, so the range is what keeps them out.
export const LEG_DATE_MIN_YEAR = 2000;
export const LEG_DATE_MAX_YEAR = 2100;
export const MAX_LEG_NIGHTS = 366;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real YYYY-MM-DD calendar date between 2000 and 2100. */
export function isPlausibleLegDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < LEG_DATE_MIN_YEAR || year > LEG_DATE_MAX_YEAR) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateLegDates({ startDate, endDate, nights }: LegDates): string | null {
  for (const [label, value] of [['Start date', startDate], ['End date', endDate]] as const) {
    if (value != null && !isPlausibleLegDate(value)) {
      return `${label} must be a real date between ${LEG_DATE_MIN_YEAR} and ${LEG_DATE_MAX_YEAR} (YYYY-MM-DD).`;
    }
  }
  if (nights != null && nights > MAX_LEG_NIGHTS) {
    return `A leg can be at most ${MAX_LEG_NIGHTS} nights.`;
  }
  return validateLegDateOrder({ startDate, endDate });
}

/** Ordering only, for checking a partial update against the leg's stored dates without re-validating them. */
export function validateLegDateOrder({ startDate, endDate }: LegDates): string | null {
  if (!startDate || !endDate) return null;
  if (endDate < startDate) {
    return 'End date cannot be earlier than start date';
  }
  return null;
}
