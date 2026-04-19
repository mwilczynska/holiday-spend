import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COUNTRY_CHART_MODE,
  buildCountryChartRows,
} from './comparison-country-chart';
import type { PlanComparisonResult } from '@/lib/plan-comparison';

function makePlan(input: {
  id: string;
  name: string;
  countryTotals: PlanComparisonResult['countryTotals'];
}): PlanComparisonResult {
  return {
    id: input.id,
    name: input.name,
    groupSize: 2,
    summary: {
      totalBudget: 0,
      totalNights: 0,
      avgDailySpend: 0,
      legCount: 0,
      fixedCostTotal: 0,
    },
    series: [],
    countryTotals: input.countryTotals,
    categoryTotals: [],
  };
}

describe('comparison-country-chart helpers', () => {
  it('defaults to daily mode', () => {
    expect(DEFAULT_COUNTRY_CHART_MODE).toBe('daily');
  });

  it('orders country rows by the highest planned daily spend shown across compared plans', () => {
    const plans = [
      makePlan({
        id: 'plan-a',
        name: 'Plan A',
        countryTotals: [
          {
            countryId: 'jp',
            countryName: 'Japan',
            totalPlanned: 1200,
            plannedDays: 4,
            plannedPerDay: 300,
          },
          {
            countryId: 'th',
            countryName: 'Thailand',
            totalPlanned: 1600,
            plannedDays: 8,
            plannedPerDay: 200,
          },
        ],
      }),
      makePlan({
        id: 'plan-b',
        name: 'Plan B',
        countryTotals: [
          {
            countryId: 'kr',
            countryName: 'South Korea',
            totalPlanned: 700,
            plannedDays: 2,
            plannedPerDay: 350,
          },
          {
            countryId: 'th',
            countryName: 'Thailand',
            totalPlanned: 450,
            plannedDays: 3,
            plannedPerDay: 180,
          },
        ],
      }),
    ];

    const rows = buildCountryChartRows(plans, 'total');

    expect(rows.map((row) => row.countryName)).toEqual([
      'South Korea',
      'Japan',
      'Thailand',
    ]);
  });
});
