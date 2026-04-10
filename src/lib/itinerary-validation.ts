interface LegDates {
  startDate?: string | null;
  endDate?: string | null;
}

export function validateLegDates({ startDate, endDate }: LegDates): string | null {
  if (!startDate || !endDate) return null;
  if (endDate < startDate) {
    return 'End date cannot be earlier than start date';
  }
  return null;
}
