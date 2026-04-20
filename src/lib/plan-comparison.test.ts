import { describe, expect, it } from 'vitest';
import type { PlanSnapshot } from './plan-snapshot';
import { computePlanComparison } from './plan-comparison';

function makeCity(id: string, name: string, countryId: string, countryName: string) {
  return {
    id,
    name,
    countryId,
    countryName,
    accomHostel: null,
    accomPrivateRoom: null,
    accom1star: null,
    accom2star: null,
    accom3star: null,
    accom4star: null,
    foodStreet: null,
    foodBudget: null,
    foodMid: null,
    foodHigh: null,
    drinkCoffee: null,
    drinksNone: null,
    drinksLight: null,
    drinksModerate: null,
    drinksHeavy: null,
    activitiesFree: null,
    activitiesBudget: null,
    activitiesMid: null,
    activitiesHigh: null,
    transportLocal: null,
  };
}

const cityMap = new Map([
  ['city-a', makeCity('city-a', 'Alpha City', 'country-a', 'Country A')],
  ['city-b', makeCity('city-b', 'Beta City', 'country-b', 'Country B')],
]);

function sumTotals(items: Array<{ totalPlanned: number }>) {
  return items.reduce((sum, item) => sum + item.totalPlanned, 0);
}

describe('computePlanComparison', () => {
  it('allocates exactly the canonical number of nights when the explicit date range is longer than nights', () => {
    const snapshot: PlanSnapshot = {
      version: 1,
      groupSize: 2,
      legs: [
        {
          id: 1,
          cityId: 'city-a',
          cityName: 'Alpha City',
          countryId: 'country-a',
          countryName: 'Country A',
          startDate: '2026-02-04',
          endDate: '2026-02-11',
          nights: 7,
          accomTier: '2star',
          foodTier: 'mid',
          drinksTier: 'moderate',
          activitiesTier: 'mid',
          accomOverride: 100,
          foodOverride: 20,
          drinksOverride: 10,
          activitiesOverride: 30,
          transportOverride: 5,
          intercityTransports: [{ cost: 70 }],
          sortOrder: 1,
          notes: null,
          status: 'planned',
        },
      ],
      fixedCosts: [],
    };

    const result = computePlanComparison('plan-1', 'Mismatch fixture', snapshot, cityMap);

    expect(result.summary.totalBudget).toBe(1225);
    expect(result.countryTotals).toEqual([
      {
        countryId: 'country-a',
        countryName: 'Country A',
        totalPlanned: 1225,
        plannedDays: 7,
        plannedPerDay: 175,
      },
    ]);
    expect(result.series).toHaveLength(7);
    expect(result.series[0]).toMatchObject({
      date: '2026-02-04',
      dailyPlanned: 235,
      cumulativePlanned: 235,
    });
    expect(result.series[6]).toMatchObject({
      date: '2026-02-10',
      dailyPlanned: 165,
      cumulativePlanned: 1225,
    });
  });

  it('keeps intercity transport on the first allocation day when dates and nights already align', () => {
    const snapshot: PlanSnapshot = {
      version: 1,
      groupSize: 2,
      legs: [
        {
          id: 2,
          cityId: 'city-a',
          cityName: 'Alpha City',
          countryId: 'country-a',
          countryName: 'Country A',
          startDate: '2026-03-01',
          endDate: '2026-03-07',
          nights: 7,
          accomTier: '2star',
          foodTier: 'mid',
          drinksTier: 'moderate',
          activitiesTier: 'mid',
          accomOverride: 80,
          foodOverride: 15,
          drinksOverride: 5,
          activitiesOverride: 20,
          transportOverride: 10,
          intercityTransports: [{ cost: 40 }],
          sortOrder: 1,
          notes: null,
          status: 'planned',
        },
      ],
      fixedCosts: [],
    };

    const result = computePlanComparison('plan-2', 'Aligned fixture', snapshot, cityMap);

    expect(result.series).toHaveLength(7);
    expect(result.series[0]?.dailyPlanned).toBe(170);
    expect(result.series[1]?.dailyPlanned).toBe(130);
    expect(result.summary.totalBudget).toBe(950);
    expect(result.countryTotals).toEqual([
      {
        countryId: 'country-a',
        countryName: 'Country A',
        totalPlanned: 950,
        plannedDays: 7,
        plannedPerDay: 135.71,
      },
    ]);
    expect(result.series[result.series.length - 1]?.cumulativePlanned).toBe(950);
  });

  it('reconciles dated fixed costs, undated fixed costs, and grouped totals across a multi-leg plan', () => {
    const snapshot: PlanSnapshot = {
      version: 1,
      groupSize: 2,
      legs: [
        {
          id: 11,
          cityId: 'city-a',
          cityName: 'Alpha City',
          countryId: 'country-a',
          countryName: 'Country A',
          startDate: '2026-04-01',
          endDate: '2026-04-03',
          nights: 3,
          accomTier: '2star',
          foodTier: 'mid',
          drinksTier: 'moderate',
          activitiesTier: 'mid',
          accomOverride: 120,
          foodOverride: 25,
          drinksOverride: 15,
          activitiesOverride: 40,
          transportOverride: 10,
          intercityTransports: [{ cost: 90 }],
          sortOrder: 1,
          notes: null,
          status: 'planned',
        },
        {
          id: 12,
          cityId: 'city-b',
          cityName: 'Beta City',
          countryId: 'country-b',
          countryName: 'Country B',
          startDate: '2026-04-04',
          endDate: '2026-04-05',
          nights: 2,
          accomTier: '2star',
          foodTier: 'mid',
          drinksTier: 'moderate',
          activitiesTier: 'mid',
          accomOverride: 60,
          foodOverride: 12,
          drinksOverride: 8,
          activitiesOverride: 20,
          transportOverride: 5,
          intercityTransports: [{ cost: 30 }],
          sortOrder: 2,
          notes: null,
          status: 'planned',
        },
      ],
      fixedCosts: [
        {
          id: 201,
          description: 'Visa',
          amountAud: 100,
          category: 'visa',
          countryId: 'country-b',
          date: '2026-04-02',
          isPaid: 0,
          notes: null,
        },
        {
          id: 202,
          description: 'Insurance',
          amountAud: 50,
          category: 'insurance',
          countryId: null,
          date: null,
          isPaid: 0,
          notes: null,
        },
      ],
    };

    const result = computePlanComparison('plan-3', 'Full reconciliation fixture', snapshot, cityMap);
    const finalCumulative = result.series[result.series.length - 1]?.cumulativePlanned ?? 0;

    expect(result.summary.totalBudget).toBe(1110);
    expect(result.summary.fixedCostTotal).toBe(150);
    expect(finalCumulative).toBe(1110);
    expect(sumTotals(result.countryTotals)).toBeCloseTo(result.summary.totalBudget, 2);
    expect(sumTotals(result.categoryTotals)).toBeCloseTo(result.summary.totalBudget, 2);

    expect(result.countryTotals).toEqual([
      {
        countryId: 'country-a',
        countryName: 'Country A',
        totalPlanned: 720,
        plannedDays: 3,
        plannedPerDay: 240,
      },
      {
        countryId: 'country-b',
        countryName: 'Country B',
        totalPlanned: 340,
        plannedDays: 2,
        plannedPerDay: 170,
      },
      {
        countryId: null,
        countryName: null,
        totalPlanned: 50,
        plannedDays: 0,
        plannedPerDay: null,
      },
    ]);

    expect(result.categoryTotals).toEqual([
      { category: 'accommodation', totalPlanned: 480 },
      { category: 'food', totalPlanned: 99 },
      { category: 'drinks', totalPlanned: 61 },
      { category: 'activities', totalPlanned: 160 },
      { category: 'transport', totalPlanned: 160 },
      { category: 'fixed_cost', totalPlanned: 150 },
    ]);

    expect(result.series).toEqual([
      { date: '2026-04-01', dailyPlanned: 310, cumulativePlanned: 310 },
      { date: '2026-04-02', dailyPlanned: 320, cumulativePlanned: 630 },
      { date: '2026-04-03', dailyPlanned: 220, cumulativePlanned: 850 },
      { date: '2026-04-04', dailyPlanned: 145, cumulativePlanned: 995 },
      { date: '2026-04-05', dailyPlanned: 115, cumulativePlanned: 1110 },
    ]);
  });
});
