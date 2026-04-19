import type { PlanComparisonResult } from '@/lib/plan-comparison';

export type CountryChartMode = 'total' | 'daily';

export interface CountryChartRow {
  countryId: string;
  countryName: string;
  combinedValue: number;
  combinedDailyValue: number;
  [key: `plan_${number}`]: number;
}

export const DEFAULT_COUNTRY_CHART_MODE: CountryChartMode = 'daily';

export function buildCountryChartRows(plans: PlanComparisonResult[], mode: CountryChartMode) {
  const rowsByCountry = new Map<string, CountryChartRow>();

  for (let planIndex = 0; planIndex < plans.length; planIndex += 1) {
    const plan = plans[planIndex];
    for (const country of plan.countryTotals) {
      const countryId = country.countryId ?? `unassigned:${country.countryName ?? 'unknown'}`;
      const countryName = country.countryName ?? 'Unassigned';
      const value = mode === 'daily' ? (country.plannedPerDay ?? 0) : country.totalPlanned;
      const existing = rowsByCountry.get(countryId) ?? {
        countryId,
        countryName,
        combinedValue: 0,
        combinedDailyValue: 0,
      };

      existing.countryName = existing.countryName || countryName;
      existing[`plan_${planIndex}`] = value;
      existing.combinedValue += value;
      existing.combinedDailyValue += country.plannedPerDay ?? 0;
      rowsByCountry.set(countryId, existing);
    }
  }

  return Array.from(rowsByCountry.values())
    .map((row) => {
      const completedRow = { ...row };
      for (let planIndex = 0; planIndex < plans.length; planIndex += 1) {
        completedRow[`plan_${planIndex}`] = completedRow[`plan_${planIndex}`] ?? 0;
      }
      return completedRow;
    })
    .filter((row) => row.combinedValue > 0)
    .sort((a, b) => b.combinedDailyValue - a.combinedDailyValue || a.countryName.localeCompare(b.countryName));
}
