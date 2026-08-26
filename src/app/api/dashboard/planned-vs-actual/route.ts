import { db } from '@/db';
import { itineraryLegs, itineraryLegTransports, cities, countries, expenses } from '@/db/schema';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { getLegTotalFromTransports, getDailyBreakdown } from '@/lib/cost-calculator';
import { getExpenseAudAmount } from '@/lib/expense-aud';
import { createExpenseLegResolver } from '@/lib/expense-leg-assignment';
import { getIntercityTransportTotal, groupIntercityTransportsByLegId } from '@/lib/intercity-transport';
import { getPlannerGroupSize } from '@/lib/planner-settings';
import { getTripWindow, isWithinTripWindow } from '@/lib/trip-window';
import { createCountryBlockRefs } from '@/lib/country-blocks';
import { requireCurrentUserId } from '@/lib/auth';
import { success, handleError } from '@/lib/api-helpers';
import type { AccomTier, FoodTier, DrinksTier, ActivitiesTier, LegStatus } from '@/types';

export const dynamic = 'force-dynamic';

function mergeCountryStatus(current: LegStatus | null, next: string | null): LegStatus | null {
  if (next === 'active') return 'active';
  if (current === 'active') return current;
  if (next === 'planned') return current === 'completed' ? 'planned' : 'planned';
  if (current === 'planned') return current;
  if (next === 'completed') return 'completed';
  return current;
}

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    const allLegs = await db.select().from(itineraryLegs).where(eq(itineraryLegs.userId, userId)).orderBy(asc(itineraryLegs.sortOrder));
    const allTransports = allLegs.length > 0
      ? await db
          .select()
          .from(itineraryLegTransports)
          .where(inArray(itineraryLegTransports.legId, allLegs.map((leg) => leg.id)))
          .orderBy(asc(itineraryLegTransports.sortOrder), asc(itineraryLegTransports.id))
      : [];
    const allCities = await db.select().from(cities);
    const allCountries = await db.select().from(countries);
    const allExpenses = await db.select().from(expenses).where(and(eq(expenses.userId, userId), ne(expenses.isDeleted, 1)));
    const groupSize = await getPlannerGroupSize(userId);

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

    return success({ comparison, plannedCategoryTotals, actualCategoryTotals });
  } catch (err) {
    return handleError(err);
  }
}
