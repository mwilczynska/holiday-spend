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

  it('uses the mode-specific values while still filling missing plan bars with zero', () => {
    const plans = [
      makePlan({
        id: 'plan-a',
        name: 'Plan A',
        countryTotals: [
          {
            countryId: 'mx',
            countryName: 'Mexico',
            totalPlanned: 1200,
            plannedDays: 4,
            plannedPerDay: 300,
          },
        ],
      }),
      makePlan({
        id: 'plan-b',
        name: 'Plan B',
        countryTotals: [
          {
            countryId: 'jp',
            countryName: 'Japan',
            totalPlanned: 1600,
            plannedDays: 4,
            plannedPerDay: 400,
          },
        ],
      }),
    ];

    const totalRows = buildCountryChartRows(plans, 'total');
    const dailyRows = buildCountryChartRows(plans, 'daily');

    expect(totalRows.find((row) => row.countryName === 'Mexico')).toMatchObject({
      countryName: 'Mexico',
      plan_0: 1200,
      plan_1: 0,
    });
    expect(totalRows.find((row) => row.countryName === 'Japan')).toMatchObject({
      countryName: 'Japan',
      plan_0: 0,
      plan_1: 1600,
    });

    expect(dailyRows.find((row) => row.countryName === 'Mexico')).toMatchObject({
      countryName: 'Mexico',
      plan_0: 300,
      plan_1: 0,
    });
    expect(dailyRows.find((row) => row.countryName === 'Japan')).toMatchObject({
      countryName: 'Japan',
      plan_0: 0,
      plan_1: 400,
    });
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

  it('drops rows that have no displayed value in daily mode', () => {
    const plans = [
      makePlan({
        id: 'plan-a',
        name: 'Plan A',
        countryTotals: [
          {
            countryId: 'unknown',
            countryName: 'Unassigned',
            totalPlanned: 50,
            plannedDays: 0,
            plannedPerDay: null,
          },
          {
            countryId: 'id',
            countryName: 'Indonesia',
            totalPlanned: 200,
            plannedDays: 2,
            plannedPerDay: 100,
          },
        ],
      }),
    ];

    const rows = buildCountryChartRows(plans, 'daily');

    expect(rows.map((row) => row.countryName)).toEqual(['Indonesia']);
  });
});
