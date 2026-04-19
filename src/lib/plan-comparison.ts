import type { PlanSnapshot } from './plan-snapshot';
import type { AccomTier, ActivitiesTier, DrinksTier, FoodTier } from '@/types';
import { getDailyBreakdown } from './cost-calculator';
import { getIntercityTransportTotal } from './intercity-transport';
import { deriveLegDates } from './itinerary-leg-dates';
import { enumerateDates } from './burn-rate';

interface CityData {
  id: string;
  name: string;
  countryId: string | null;
  countryName: string | null;
  accomHostel: number | null;
  accomPrivateRoom: number | null;
  accom1star: number | null;
  accom2star: number | null;
  accom3star: number | null;
  accom4star: number | null;
  foodStreet: number | null;
  foodBudget: number | null;
  foodMid: number | null;
  foodHigh: number | null;
  drinkCoffee: number | null;
  drinksNone: number | null;
  drinksLight: number | null;
  drinksModerate: number | null;
  drinksHeavy: number | null;
  activitiesFree: number | null;
  activitiesBudget: number | null;
  activitiesMid: number | null;
  activitiesHigh: number | null;
  transportLocal: number | null;
}

export type PlannedAllocationCategory =
  | 'accommodation'
  | 'food'
  | 'drinks'
  | 'activities'
  | 'local_transport'
  | 'intercity_transport'
  | 'fixed_cost';

export interface PlannedAllocationRow {
  planId: string;
  legId: number | null;
  date: string | null;
  countryId: string | null;
  countryName: string | null;
  cityId: string | null;
  cityName: string | null;
  category: PlannedAllocationCategory;
  amount: number;
}

export interface PlanComparisonSeries {
  date: string;
  cumulativePlanned: number;
  dailyPlanned: number;
}

export interface PlanComparisonCountryTotal {
  countryId: string | null;
  countryName: string | null;
  totalPlanned: number;
  plannedDays: number;
  plannedPerDay: number | null;
}

export interface PlanComparisonCategoryTotal {
  category: 'accommodation' | 'food' | 'drinks' | 'activities' | 'transport' | 'fixed_cost';
  totalPlanned: number;
}

export interface PlanComparisonResult {
  id: string;
  name: string;
  groupSize: number;
  summary: {
    totalBudget: number;
    totalNights: number;
    avgDailySpend: number;
    legCount: number;
    fixedCostTotal: number;
  };
  series: PlanComparisonSeries[];
  countryTotals: PlanComparisonCountryTotal[];
  categoryTotals: PlanComparisonCategoryTotal[];
}

interface NormalizedComparisonLeg {
  id: number | null;
  cityId: string;
  cityName: string | null;
  countryId: string | null;
  countryName: string | null;
  startDate: string | null;
  nights: number;
  accomTier: AccomTier;
  foodTier: FoodTier;
  drinksTier: DrinksTier;
  activitiesTier: ActivitiesTier;
  accomOverride: number | null;
  foodOverride: number | null;
  drinksOverride: number | null;
  activitiesOverride: number | null;
  transportOverride: number | null;
  intercityTransports: Array<{ cost?: number | null }>;
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().split('T')[0];
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getCountryBucketKey(countryId: string | null, countryName: string | null) {
  if (countryId) {
    return `id:${countryId}`;
  }
  return `name:${countryName ?? 'null'}`;
}

function buildCountryNameById(cityMap: Map<string, CityData>) {
  const countryNames = new Map<string, string>();

  for (const city of Array.from(cityMap.values())) {
    if (!city.countryId || !city.countryName) continue;
    if (!countryNames.has(city.countryId)) {
      countryNames.set(city.countryId, city.countryName);
    }
  }

  return countryNames;
}

function buildLegPlannedAllocations(
  planId: string,
  snapshot: PlanSnapshot,
  datedLegs: NormalizedComparisonLeg[],
  cityMap: Map<string, CityData>
): PlannedAllocationRow[] {
  const allocations: PlannedAllocationRow[] = [];

  for (const leg of datedLegs) {
    const city = cityMap.get(leg.cityId);
    if (!city || !leg.startDate) continue;

    const countryId = city.countryId ?? leg.countryId ?? null;
    const countryName = city.countryName ?? leg.countryName ?? null;
    const cityName = city.name ?? leg.cityName ?? null;
    const dailyBreakdown = getDailyBreakdown(
      city,
      leg.accomTier,
      leg.foodTier,
      leg.drinksTier,
      leg.activitiesTier,
      {
        accomOverride: leg.accomOverride,
        foodOverride: leg.foodOverride,
        drinksOverride: leg.drinksOverride,
        activitiesOverride: leg.activitiesOverride,
        transportOverride: leg.transportOverride,
      },
      snapshot.groupSize
    );

    for (let offset = 0; offset < leg.nights; offset += 1) {
      const date = addDays(leg.startDate, offset);
      const baseRow = {
        planId,
        legId: leg.id,
        date,
        countryId,
        countryName,
        cityId: leg.cityId,
        cityName,
      };

      const categoryAmounts: Array<{ category: PlannedAllocationCategory; amount: number }> = [
        { category: 'accommodation', amount: dailyBreakdown.accommodation },
        { category: 'food', amount: dailyBreakdown.food },
        { category: 'drinks', amount: dailyBreakdown.drinks },
        { category: 'activities', amount: dailyBreakdown.activities },
        { category: 'local_transport', amount: dailyBreakdown.transport },
      ];

      for (const entry of categoryAmounts) {
        if (!entry.amount) continue;
        allocations.push({
          ...baseRow,
          category: entry.category,
          amount: entry.amount,
        });
      }
    }

    const intercityTransportTotal = getIntercityTransportTotal(leg.intercityTransports);
    if (intercityTransportTotal > 0) {
      allocations.push({
        planId,
        legId: leg.id,
        date: leg.startDate,
        countryId,
        countryName,
        cityId: leg.cityId,
        cityName,
        category: 'intercity_transport',
        amount: intercityTransportTotal,
      });
    }
  }

  return allocations;
}

function buildFixedCostAllocations(
  planId: string,
  snapshot: PlanSnapshot,
  tripDates: string[],
  countryNameById: Map<string, string>
): PlannedAllocationRow[] {
  const allocations: PlannedAllocationRow[] = [];

  for (const fixedCost of snapshot.fixedCosts) {
    if (fixedCost.amountAud <= 0) continue;

    const baseRow = {
      planId,
      legId: null,
      countryId: fixedCost.countryId ?? null,
      countryName: fixedCost.countryId ? (countryNameById.get(fixedCost.countryId) ?? null) : null,
      cityId: null,
      cityName: null,
      category: 'fixed_cost' as const,
    };

    if (fixedCost.date) {
      allocations.push({
        ...baseRow,
        date: fixedCost.date,
        amount: fixedCost.amountAud,
      });
      continue;
    }

    if (tripDates.length === 0) {
      allocations.push({
        ...baseRow,
        date: null,
        amount: fixedCost.amountAud,
      });
      continue;
    }

    const perDay = fixedCost.amountAud / tripDates.length;
    for (const date of tripDates) {
      allocations.push({
        ...baseRow,
        date,
        amount: perDay,
      });
    }
  }

  return allocations;
}

function buildPlanComparisonSeries(allocations: PlannedAllocationRow[]): PlanComparisonSeries[] {
  const datedAllocations = allocations.filter((allocation) => allocation.date !== null);
  if (datedAllocations.length === 0) return [];

  const plannedByDate = new Map<string, number>();
  for (const allocation of datedAllocations) {
    const date = allocation.date as string;
    plannedByDate.set(date, (plannedByDate.get(date) || 0) + allocation.amount);
  }

  const sortedDates = Array.from(plannedByDate.keys()).sort();
  const startDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];

  let cumulativePlanned = 0;
  return enumerateDates(startDate, endDate).map((date) => {
    const dailyPlanned = plannedByDate.get(date) || 0;
    cumulativePlanned += dailyPlanned;
    return {
      date,
      cumulativePlanned: roundMoney(cumulativePlanned),
      dailyPlanned: roundMoney(dailyPlanned),
    };
  });
}

function buildCountryPlannedDays(
  datedLegs: NormalizedComparisonLeg[],
  cityMap: Map<string, CityData>
) {
  const daysByCountry = new Map<string, PlanComparisonCountryTotal>();

  for (const leg of datedLegs) {
    const city = cityMap.get(leg.cityId);
    const countryId = city?.countryId ?? leg.countryId ?? null;
    const countryName = city?.countryName ?? leg.countryName ?? null;
    const key = getCountryBucketKey(countryId, countryName);
    const existing = daysByCountry.get(key) ?? {
      countryId,
      countryName,
      totalPlanned: 0,
      plannedDays: 0,
      plannedPerDay: null,
    };

    existing.countryName = existing.countryName ?? countryName;
    existing.plannedDays += leg.nights;
    daysByCountry.set(key, existing);
  }

  return daysByCountry;
}

function buildPlanComparisonCountryTotals(
  allocations: PlannedAllocationRow[],
  plannedDaysByCountry: Map<string, PlanComparisonCountryTotal>
): PlanComparisonCountryTotal[] {
  const totals = new Map<string, PlanComparisonCountryTotal>();

  for (const allocation of allocations) {
    const key = getCountryBucketKey(allocation.countryId, allocation.countryName);
    const existing = totals.get(key) ?? {
      countryId: allocation.countryId,
      countryName: allocation.countryName,
      totalPlanned: 0,
      plannedDays: plannedDaysByCountry.get(key)?.plannedDays ?? 0,
      plannedPerDay: null,
    };

    existing.countryName = existing.countryName ?? allocation.countryName;
    existing.totalPlanned += allocation.amount;
    totals.set(key, existing);
  }

  return Array.from(totals.values())
    .map((entry) => ({
      ...entry,
      totalPlanned: roundMoney(entry.totalPlanned),
      plannedPerDay: entry.plannedDays > 0 ? roundMoney(entry.totalPlanned / entry.plannedDays) : null,
    }))
    .sort((a, b) => b.totalPlanned - a.totalPlanned || (a.countryName ?? '').localeCompare(b.countryName ?? ''));
}

function toPublicCategory(category: PlannedAllocationCategory): PlanComparisonCategoryTotal['category'] {
  if (category === 'local_transport' || category === 'intercity_transport') {
    return 'transport';
  }
  return category;
}

function buildPlanComparisonCategoryTotals(allocations: PlannedAllocationRow[]): PlanComparisonCategoryTotal[] {
  const totals = new Map<PlanComparisonCategoryTotal['category'], number>();

  for (const allocation of allocations) {
    const category = toPublicCategory(allocation.category);
    totals.set(category, (totals.get(category) || 0) + allocation.amount);
  }

  const categoryOrder: PlanComparisonCategoryTotal['category'][] = [
    'accommodation',
    'food',
    'drinks',
    'activities',
    'transport',
    'fixed_cost',
  ];

  return categoryOrder
    .filter((category) => totals.has(category))
    .map((category) => ({
      category,
      totalPlanned: roundMoney(totals.get(category) || 0),
    }));
}

function buildPlanComparisonSummary(snapshot: PlanSnapshot, allocations: PlannedAllocationRow[]) {
  const totalBudget = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const fixedCostTotal = allocations
    .filter((allocation) => allocation.category === 'fixed_cost')
    .reduce((sum, allocation) => sum + allocation.amount, 0);
  const totalNights = snapshot.legs.reduce((sum, leg) => sum + leg.nights, 0);

  return {
    totalBudget: roundMoney(totalBudget),
    totalNights,
    avgDailySpend: totalNights > 0 ? roundMoney(totalBudget / totalNights) : 0,
    legCount: snapshot.legs.length,
    fixedCostTotal: roundMoney(fixedCostTotal),
  };
}

export function computePlanComparison(
  planId: string,
  name: string,
  snapshot: PlanSnapshot,
  cityMap: Map<string, CityData>
): PlanComparisonResult {
  const countryNameById = buildCountryNameById(cityMap);
  const datedLegs = deriveLegDates(
    snapshot.legs.map((leg, index) => ({
      id: leg.id ?? null,
      cityId: leg.cityId,
      cityName: leg.cityName ?? null,
      countryId: leg.countryId ?? null,
      countryName: leg.countryName ?? null,
      startDate: leg.startDate ?? null,
      endDate: leg.endDate ?? null,
      nights: leg.nights,
      sortOrder: leg.sortOrder ?? index + 1,
      accomTier: (leg.accomTier || '2star') as AccomTier,
      foodTier: (leg.foodTier || 'mid') as FoodTier,
      drinksTier: (leg.drinksTier || 'moderate') as DrinksTier,
      activitiesTier: (leg.activitiesTier || 'mid') as ActivitiesTier,
      accomOverride: leg.accomOverride ?? null,
      foodOverride: leg.foodOverride ?? null,
      drinksOverride: leg.drinksOverride ?? null,
      activitiesOverride: leg.activitiesOverride ?? null,
      transportOverride: leg.transportOverride ?? null,
      intercityTransports: leg.intercityTransports ?? [],
    }))
  );

  const legAllocations = buildLegPlannedAllocations(planId, snapshot, datedLegs, cityMap);
  const tripDates = Array.from(
    new Set(
      legAllocations
        .map((allocation) => allocation.date)
        .filter((date): date is string => date !== null)
    )
  ).sort();
  const fixedCostAllocations = buildFixedCostAllocations(planId, snapshot, tripDates, countryNameById);
  const allocations = [...legAllocations, ...fixedCostAllocations];
  const plannedDaysByCountry = buildCountryPlannedDays(datedLegs, cityMap);

  return {
    id: planId,
    name,
    groupSize: snapshot.groupSize,
    summary: buildPlanComparisonSummary(snapshot, allocations),
    series: buildPlanComparisonSeries(allocations),
    countryTotals: buildPlanComparisonCountryTotals(allocations, plannedDaysByCountry),
    categoryTotals: buildPlanComparisonCategoryTotals(allocations),
  };
}
