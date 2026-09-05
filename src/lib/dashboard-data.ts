import { db } from '@/db';
import {
  cities, countries, expenses, fixedCosts, itineraryLegs, itineraryLegTransports,
} from '@/db/schema';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { buildBurnRateSeries, buildCountryBands, calcBurnRate, enumerateDates, projectTotal } from '@/lib/burn-rate';
import { getDailyBreakdown, getDailyCost, getLegTotalFromTransports } from '@/lib/cost-calculator';
import { createCountryBlockRefs } from '@/lib/country-blocks';
import { resolveDashboardAsOfDate, wholeCalendarDaysBetween } from '@/lib/dashboard-as-of';
import { getExpenseAudAmount } from '@/lib/expense-aud';
import { createExpenseLegResolver } from '@/lib/expense-leg-assignment';
import { getIntercityTransportTotal, groupIntercityTransportsByLegId } from '@/lib/intercity-transport';
import { getPlannerGroupSize } from '@/lib/planner-settings';
import { getTripWindow, isWithinTripWindow } from '@/lib/trip-window';
import type { AccomTier, ActivitiesTier, DrinksTier, FoodTier, LegStatus } from '@/types';

/**
 * Shared loading and derivation for the dashboard.
 *
 * `/api/dashboard/summary`, `/api/dashboard/planned-vs-actual` and `/api/dashboard/burn-rate` each
 * read the same rows — the user's legs and leg transports, every city, every country, the user's
 * expenses — so rendering the dashboard read them three times over, including 1,300 expense rows
 * on each pass. The three routes remain, unchanged in shape, but they and the combined
 * `/api/dashboard` endpoint now share one read.
 *
 * The builders are deliberately self-contained: each redoes its own in-memory derivations from the
 * shared rows. Those are map constructions over a few thousand objects, and keeping them separate
 * meant the three bodies moved across verbatim.
 */
export async function loadDashboardInputs(userId: string) {
  const rawLegs = await db
    .select()
    .from(itineraryLegs)
    .where(eq(itineraryLegs.userId, userId))
    .orderBy(asc(itineraryLegs.sortOrder));

  const allTransports = rawLegs.length > 0
    ? await db
        .select()
        .from(itineraryLegTransports)
        .where(inArray(itineraryLegTransports.legId, rawLegs.map((leg) => leg.id)))
        .orderBy(asc(itineraryLegTransports.sortOrder), asc(itineraryLegTransports.id))
    : [];

  const allCities = await db.select().from(cities);
  const allCountries = await db.select().from(countries);
  const allExpenses = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.userId, userId), ne(expenses.isDeleted, 1)));
  const allFixed = await db.select().from(fixedCosts).where(eq(fixedCosts.userId, userId));
  const groupSize = await getPlannerGroupSize(userId);

  return { rawLegs, allTransports, allCities, allCountries, allExpenses, allFixed, groupSize };
}

export type DashboardSharedInputs = Awaited<ReturnType<typeof loadDashboardInputs>>;


// --- helpers lifted from the three routes ---

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().split('T')[0];
}

function maxDate(...dates: Array<string | null | undefined>): string | null {
  const filtered = dates.filter((date): date is string => Boolean(date)).sort();
  return filtered[filtered.length - 1] || null;
}

function minDate(...dates: Array<string | null | undefined>): string | null {
  const filtered = dates.filter((date): date is string => Boolean(date)).sort();
  return filtered[0] || null;
}

function mergeCountryStatus(current: LegStatus | null, next: string | null): LegStatus | null {
  if (next === 'active') return 'active';
  if (current === 'active') return current;
  if (next === 'planned') return current === 'completed' ? 'planned' : 'planned';
  if (current === 'planned') return current;
  if (next === 'completed') return 'completed';
  return current;
}

export function buildDashboardSummary(inputs: DashboardSharedInputs) {
  const { rawLegs, allTransports, allCities, allExpenses, allFixed, groupSize } = inputs;

  const expenseLegResolver = createExpenseLegResolver(rawLegs);
  const allLegs = expenseLegResolver.legs;
  const cityMap = new Map(allCities.map(c => [c.id, c]));
  const transportMap = groupIntercityTransportsByLegId(allTransports);
  const { tripStart, tripEnd } = getTripWindow(allLegs);

  // Calculate planned budget from legs + fixed costs
  const legTotals = allLegs.map(leg => {
    const city = cityMap.get(leg.cityId);
    const dailyCost = city
      ? getDailyCost(
          city,
          (leg.accomTier || '2star') as AccomTier,
          (leg.foodTier || 'mid') as FoodTier,
          (leg.drinksTier || 'moderate') as DrinksTier,
          (leg.activitiesTier || 'mid') as ActivitiesTier,
          { accomOverride: leg.accomOverride, foodOverride: leg.foodOverride, drinksOverride: leg.drinksOverride, activitiesOverride: leg.activitiesOverride, transportOverride: leg.transportOverride },
          groupSize
        )
      : 0;
    return getLegTotalFromTransports(dailyCost, leg.nights, transportMap.get(leg.id));
  });

  const plannedLegsTotal = legTotals.reduce((s, t) => s + t, 0);
  const fixedTotal = allFixed.reduce((s, f) => s + f.amountAud, 0);
  const totalBudget = plannedLegsTotal + fixedTotal;

  // Calculate actual spend (non-excluded)
  const activeExpenses = allExpenses.filter((expense) => {
    if (expense.isExcluded) return false;
    const matchedLeg = expenseLegResolver.resolve(expense);
    return Boolean(matchedLeg) || isWithinTripWindow(expenseLegResolver.reportingDate(expense), tripStart, tripEnd);
  });
  const totalSpent = activeExpenses.reduce((s, e) => s + getExpenseAudAmount(e), 0);

  const today = new Date().toISOString().split('T')[0];
  const expenseData = activeExpenses.map((expense) => ({
    date: expenseLegResolver.reportingDate(expense),
    amountAud: getExpenseAudAmount(expense),
  }));
  const { date: asOfDate, source: asOfSource } = resolveDashboardAsOfDate(
    expenseData.map((expense) => expense.date),
    today
  );
  const totalNights = allLegs.reduce((s, l) => s + l.nights, 0);

  let daysElapsed = 0;
  let daysRemaining = 0;
  if (tripStart) {
    daysElapsed = wholeCalendarDaysBetween(tripStart, asOfDate);
    if (tripEnd) {
      daysRemaining = wholeCalendarDaysBetween(asOfDate, tripEnd);
    } else {
      daysRemaining = Math.max(0, totalNights - daysElapsed);
    }
  }

  const plannedByDate = new Map<string, number>();
  for (const leg of allLegs) {
    if (!leg.startDate || leg.nights < 1) continue;

    const city = cityMap.get(leg.cityId);
    if (!city) continue;

    const dailyCost = getDailyCost(
      city,
      (leg.accomTier || '2star') as AccomTier,
      (leg.foodTier || 'mid') as FoodTier,
      (leg.drinksTier || 'moderate') as DrinksTier,
      (leg.activitiesTier || 'mid') as ActivitiesTier,
      {
        accomOverride: leg.accomOverride,
        foodOverride: leg.foodOverride,
        drinksOverride: leg.drinksOverride,
        activitiesOverride: leg.activitiesOverride,
        transportOverride: leg.transportOverride,
      },
      groupSize
    );

    const intercityTotal = (transportMap.get(leg.id) || []).reduce((sum, transport) => sum + (transport.cost ?? 0), 0);
    for (let offset = 0; offset < leg.nights; offset += 1) {
      const date = addDays(leg.startDate, offset);
      const plannedAmount = dailyCost + (offset === 0 ? intercityTotal : 0);
      plannedByDate.set(date, (plannedByDate.get(date) || 0) + plannedAmount);
    }
  }

  const plannedDatesElapsed = Array.from(plannedByDate.keys()).filter((date) => date <= asOfDate);
  const plannedToDate = plannedDatesElapsed.reduce((sum, date) => sum + (plannedByDate.get(date) || 0), 0);
  const plannedAvgSoFar = plannedDatesElapsed.length > 0 ? plannedToDate / plannedDatesElapsed.length : 0;
  const varianceToDate = totalSpent - plannedToDate;

  // Burn rates
  const { tripAvg, windowAvg: sevenDayAvg } = calcBurnRate(totalSpent, daysElapsed, {
    expenses: expenseData,
    days: 7,
    asOfDate,
  });
  const { windowAvg: thirtyDayAvg } = calcBurnRate(totalSpent, daysElapsed, {
    expenses: expenseData,
    days: 30,
    asOfDate,
  });

  // Projection using 7-day average if available, else trip average
  const projectionRate = sevenDayAvg ?? tripAvg;
  const projectedTotal = projectTotal(totalSpent, projectionRate, daysRemaining);
  const forecastVariance = projectedTotal - plannedLegsTotal;
  const remainingLegBudget = plannedLegsTotal - totalSpent;
  const requiredDailyPace = daysRemaining > 0 ? Math.max(remainingLegBudget, 0) / daysRemaining : null;

  // Budget health: ratio of projected to budget
  let budgetHealth: 'on_track' | 'warning' | 'over_budget' = 'on_track';
  if (totalBudget > 0) {
    const ratio = projectedTotal / totalBudget;
    if (ratio > 1.1) budgetHealth = 'over_budget';
    else if (ratio > 0.95) budgetHealth = 'warning';
  }


  return {
    totalBudget,
    plannedLegsTotal,
    fixedTotal,
    groupSize,
    totalSpent,
    plannedToDate,
    varianceToDate,
    projectedTotal,
    forecastVariance,
    remainingLegBudget,
    tripStart,
    tripEnd,
    asOfDate,
    asOfSource,
    totalNights,
    daysElapsed,
    daysRemaining,
    destinations: allLegs.length,
    expenseCount: activeExpenses.length,
    burnRate: {
      tripAvg,
      plannedAvgSoFar,
      sevenDayAvg,
      thirtyDayAvg,
      requiredDailyPace,
    },
    budgetHealth,
    remaining: totalBudget - totalSpent,
  };
}

export function buildPlannedVsActual(inputs: DashboardSharedInputs) {
  const { rawLegs: allLegs, allTransports, allCities, allCountries, allExpenses, groupSize } = inputs;

  const expenseLegResolver = createExpenseLegResolver(allLegs);
  const resolvedLegs = expenseLegResolver.legs;
  const cityMap = new Map(allCities.map(c => [c.id, c]));
  const countryMap = new Map(allCountries.map(c => [c.id, c]));
  const transportMap = groupIntercityTransportsByLegId(allTransports);
  const { tripStart, tripEnd } = getTripWindow(resolvedLegs);
  type PlannedCountryBlock = {
    blockId: string;
    countryId: string;
    blockIndex: number;
    name: string;
    planned: number;
    days: number;
    status: LegStatus | null;
    categories: Record<string, number>;
  };

  type ActualTotals = {
    name: string;
    actual: number;
    categories: Record<string, number>;
  };

  // Build planned totals in itinerary order. A country gets a new row when
  // the itinerary leaves that country and later returns to it.
  const countryBlockRefs = createCountryBlockRefs(resolvedLegs, (leg) => {
    const city = cityMap.get(leg.cityId);
    return city?.countryId ?? null;
  });
  const plannedByBlock = new Map<string, PlannedCountryBlock>();
  const blockIdByLegId = new Map<number, string>();

  for (let legIndex = 0; legIndex < resolvedLegs.length; legIndex += 1) {
    const leg = resolvedLegs[legIndex];
    const city = cityMap.get(leg.cityId);
    const blockRef = countryBlockRefs[legIndex];
    if (!city || !blockRef) continue;
    const country = countryMap.get(city.countryId);
    const countryName = country?.name ?? city.countryId;

    const breakdown = getDailyBreakdown(
      city,
      (leg.accomTier || '2star') as AccomTier,
      (leg.foodTier || 'mid') as FoodTier,
      (leg.drinksTier || 'moderate') as DrinksTier,
      (leg.activitiesTier || 'mid') as ActivitiesTier,
      { accomOverride: leg.accomOverride, foodOverride: leg.foodOverride, drinksOverride: leg.drinksOverride, activitiesOverride: leg.activitiesOverride, transportOverride: leg.transportOverride },
      groupSize
    );

    const intercityTransportTotal = getIntercityTransportTotal(transportMap.get(leg.id));
    const legTotal = getLegTotalFromTransports(breakdown.total, leg.nights, transportMap.get(leg.id));

    if (!plannedByBlock.has(blockRef.blockId)) {
      plannedByBlock.set(blockRef.blockId, {
        blockId: blockRef.blockId,
        countryId: blockRef.countryId,
        blockIndex: blockRef.blockIndex,
        name: countryName,
        planned: 0,
        days: 0,
        status: null,
        categories: {},
      });
    }
    const entry = plannedByBlock.get(blockRef.blockId)!;
    blockIdByLegId.set(leg.id, blockRef.blockId);
    entry.planned += legTotal;
    entry.days += leg.nights;
    entry.status = mergeCountryStatus(entry.status, leg.status) ?? 'planned';
    entry.categories.accommodation = (entry.categories.accommodation || 0) + breakdown.accommodation * leg.nights;
    entry.categories.food = (entry.categories.food || 0) + breakdown.food * leg.nights;
    entry.categories.drinks = (entry.categories.drinks || 0) + breakdown.drinks * leg.nights;
    entry.categories.activities = (entry.categories.activities || 0) + breakdown.activities * leg.nights;
    entry.categories.transport = (entry.categories.transport || 0) + breakdown.transport * leg.nights + intercityTransportTotal;
  }

  // Build actual totals per country (join expense → leg → city → country)
  const reportableExpenses = allExpenses.filter((expense) => {
    if (expense.isExcluded) return false;
    const matchedLeg = expenseLegResolver.resolve(expense);
    return Boolean(matchedLeg) || isWithinTripWindow(expenseLegResolver.reportingDate(expense), tripStart, tripEnd);
  });

  const actualByBlock = new Map<string, ActualTotals>();
  const actualOnlyByCountry = new Map<string, ActualTotals>();

  for (const exp of reportableExpenses) {
    let countryId = 'unassigned';
    let countryName = 'Unassigned';

    const matchedLeg = expenseLegResolver.resolve(exp);

    const matchedBlockId = matchedLeg ? blockIdByLegId.get(matchedLeg.id) : undefined;

    if (matchedLeg && !matchedBlockId) {
      const city = cityMap.get(matchedLeg.cityId);
      if (city) {
        countryId = city.countryId;
        const country = countryMap.get(city.countryId);
        countryName = country?.name ?? city.countryId;
      }
    }

    const target = matchedBlockId ? actualByBlock : actualOnlyByCountry;
    const targetId = matchedBlockId ?? countryId;
    if (!target.has(targetId)) {
      target.set(targetId, { name: countryName, actual: 0, categories: {} });
    }
    const entry = target.get(targetId)!;
    const audAmount = getExpenseAudAmount(exp);
    entry.actual += audAmount;
    entry.categories[exp.category] = (entry.categories[exp.category] || 0) + audAmount;
  }

  const toComparisonRow = (
    planned: PlannedCountryBlock | undefined,
    actual: ActualTotals | undefined,
    countryId: string,
    countryName: string,
    blockIndex: number | null
  ) => ({
    countryId,
    countryName,
    blockIndex,
    planned: planned?.planned ?? 0,
    actual: actual?.actual ?? 0,
    plannedDays: planned?.days ?? 0,
    plannedPerDay: (planned?.days ?? 0) > 0
      ? (planned?.planned ?? 0) / (planned?.days ?? 0)
      : null,
    actualPerDay: (planned?.days ?? 0) > 0
      ? (actual?.actual ?? 0) / (planned?.days ?? 0)
      : null,
    status: planned?.status ?? null,
    plannedCategories: planned?.categories ?? {},
    actualCategories: actual?.categories ?? {},
  });

  // Planned blocks are already in itinerary order because Map insertion
  // follows resolvedLegs. Actual-only rows are appended after those blocks.
  const comparison = [
    ...Array.from(plannedByBlock.values()).map((planned) => toComparisonRow(
      planned,
      actualByBlock.get(planned.blockId),
      planned.countryId,
      planned.name,
      planned.blockIndex
    )),
    ...Array.from(actualOnlyByCountry.entries()).map(([countryId, actual]) => toComparisonRow(
      undefined,
      actual,
      countryId,
      actual.name,
      null
    )),
  ];

  // Category breakdown across all planned legs
  const plannedCategoryTotals: Record<string, number> = {};
  for (const entry of Array.from(plannedByBlock.values())) {
    for (const [category, amount] of Object.entries(entry.categories)) {
      plannedCategoryTotals[category] = (plannedCategoryTotals[category] || 0) + Number(amount);
    }
  }

  // Category breakdown across all expenses
  const actualCategoryTotals: Record<string, number> = {};
  for (const exp of reportableExpenses) {
    const audAmount = getExpenseAudAmount(exp);
    actualCategoryTotals[exp.category] = (actualCategoryTotals[exp.category] || 0) + audAmount;
  }


  return { comparison, plannedCategoryTotals, actualCategoryTotals };
}

export function buildBurnRate(inputs: DashboardSharedInputs) {
  const { rawLegs, allTransports, allCities, allCountries, allExpenses, groupSize } = inputs;

  const expenseLegResolver = createExpenseLegResolver(rawLegs);
  const allLegs = expenseLegResolver.legs;
  const legMap = new Map(allLegs.map((leg) => [leg.id, leg]));
  const cityMap = new Map(allCities.map((city) => [city.id, city]));
  const countryMap = new Map(allCountries.map((country) => [country.id, country]));
  const transportMap = groupIntercityTransportsByLegId(allTransports);
  const { tripStart, tripEnd } = getTripWindow(allLegs);

  const activeExpenses = allExpenses.filter((expense) => {
    if (expense.isExcluded) return false;
    const matchedLeg = expenseLegResolver.resolve(expense);
    return Boolean(matchedLeg) || isWithinTripWindow(expenseLegResolver.reportingDate(expense), tripStart, tripEnd);
  });

  const expenseDates = activeExpenses.map((expense) => expenseLegResolver.reportingDate(expense)).filter(Boolean).sort();
  const seriesStart = minDate(tripStart, expenseDates[0]);
  const seriesEnd = maxDate(tripEnd, expenseDates[expenseDates.length - 1]);

  if (!seriesStart || !seriesEnd) {
    return {
      cumulative: [],
      countryBands: [],
      tripStart,
      tripEnd,
      totalNights: allLegs.reduce((sum, leg) => sum + leg.nights, 0),
    };
  }

  const actualByDate = new Map<string, number>();
  for (const expense of activeExpenses) {
    const reportingDate = expenseLegResolver.reportingDate(expense);
    actualByDate.set(
      reportingDate,
      (actualByDate.get(reportingDate) || 0) + getExpenseAudAmount(expense)
    );
  }

  const plannedByDate = new Map<string, number>();
  for (const leg of allLegs) {
    if (!leg.startDate || leg.nights < 1) continue;

    const city = cityMap.get(leg.cityId);
    if (!city) continue;

    const dailyBreakdown = getDailyBreakdown(
      city,
      (leg.accomTier || '2star') as AccomTier,
      (leg.foodTier || 'mid') as FoodTier,
      (leg.drinksTier || 'moderate') as DrinksTier,
      (leg.activitiesTier || 'mid') as ActivitiesTier,
      {
        accomOverride: leg.accomOverride,
        foodOverride: leg.foodOverride,
        drinksOverride: leg.drinksOverride,
        activitiesOverride: leg.activitiesOverride,
        transportOverride: leg.transportOverride,
      },
      groupSize
    );

    for (let offset = 0; offset < leg.nights; offset += 1) {
      const date = addDays(leg.startDate, offset);
      const plannedAmount = dailyBreakdown.total + (offset === 0 ? getIntercityTransportTotal(transportMap.get(leg.id)) : 0);
      plannedByDate.set(date, (plannedByDate.get(date) || 0) + plannedAmount);
    }
  }

  const metadataByDate = new Map<string, { countryName: string | null; cityName: string | null; legStatus: string | null }>();
  for (const date of enumerateDates(seriesStart, seriesEnd)) {
    const matchedLegRef = expenseLegResolver.findForDate(date);
    const matchedLeg = matchedLegRef ? legMap.get(matchedLegRef.id) ?? null : null;

    if (!matchedLeg) {
      metadataByDate.set(date, { countryName: null, cityName: null, legStatus: null });
      continue;
    }

    const city = cityMap.get(matchedLeg.cityId);
    const country = city ? countryMap.get(city.countryId) : null;

    metadataByDate.set(date, {
      countryName: country?.name ?? null,
      cityName: city?.name ?? null,
      legStatus: matchedLeg.status ?? null,
    });
  }

  const cumulative = buildBurnRateSeries({
    startDate: seriesStart,
    endDate: seriesEnd,
    actualByDate,
    plannedByDate,
    metadataByDate,
  });


  return {
    cumulative,
    countryBands: buildCountryBands(cumulative),
    tripStart,
    tripEnd,
    totalNights: allLegs.reduce((sum, leg) => sum + leg.nights, 0),
  };
}
