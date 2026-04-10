import { db } from '@/db';
import { itineraryLegs, itineraryLegTransports, cities, countries, expenses } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { getLegTotalFromTransports, getDailyBreakdown } from '@/lib/cost-calculator';
import { getExpenseAudAmount } from '@/lib/expense-aud';
import { getExpenseReportingDate, resolveExpenseLeg } from '@/lib/expense-leg-assignment';
import { getIntercityTransportTotal, groupIntercityTransportsByLegId } from '@/lib/intercity-transport';
import { getPlannerGroupSize } from '@/lib/planner-settings';
import { getTripWindow, isWithinTripWindow } from '@/lib/trip-window';
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
    const allLegs = await db.select().from(itineraryLegs).orderBy(asc(itineraryLegs.sortOrder));
    const allTransports = await db.select().from(itineraryLegTransports).orderBy(asc(itineraryLegTransports.sortOrder), asc(itineraryLegTransports.id));
    const allCities = await db.select().from(cities);
    const allCountries = await db.select().from(countries);
    const allExpenses = await db.select().from(expenses);
    const groupSize = await getPlannerGroupSize();

    const cityMap = new Map(allCities.map(c => [c.id, c]));
    const countryMap = new Map(allCountries.map(c => [c.id, c]));
    const transportMap = groupIntercityTransportsByLegId(allTransports);
    const { tripStart, tripEnd } = getTripWindow(allLegs);
    const statusByCountry = new Map<string, LegStatus>();

    // Build planned totals per country
    const plannedByCountry = new Map<string, { name: string; planned: number; days: number; categories: Record<string, number> }>();

    for (const leg of allLegs) {
      const city = cityMap.get(leg.cityId);
      if (!city) continue;
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

      if (!plannedByCountry.has(city.countryId)) {
        plannedByCountry.set(city.countryId, { name: countryName, planned: 0, days: 0, categories: {} });
      }
      const entry = plannedByCountry.get(city.countryId)!;
      entry.planned += legTotal;
      entry.days += leg.nights;
      statusByCountry.set(
        city.countryId,
        mergeCountryStatus(statusByCountry.get(city.countryId) ?? null, leg.status) ?? 'planned'
      );
      entry.categories.accommodation = (entry.categories.accommodation || 0) + breakdown.accommodation * leg.nights;
      entry.categories.food = (entry.categories.food || 0) + breakdown.food * leg.nights;
      entry.categories.drinks = (entry.categories.drinks || 0) + breakdown.drinks * leg.nights;
      entry.categories.activities = (entry.categories.activities || 0) + breakdown.activities * leg.nights;
      entry.categories.transport = (entry.categories.transport || 0) + breakdown.transport * leg.nights + intercityTransportTotal;
    }

    // Build actual totals per country (join expense → leg → city → country)
    const reportableExpenses = allExpenses.filter((expense) => {
      if (expense.isExcluded) return false;
      const matchedLeg = resolveExpenseLeg(expense, allLegs);
      return Boolean(matchedLeg) || isWithinTripWindow(getExpenseReportingDate(expense, allLegs), tripStart, tripEnd);
    });

    const actualByCountry = new Map<string, { name: string; actual: number; categories: Record<string, number> }>();

    for (const exp of reportableExpenses) {
      let countryId = 'unassigned';
      let countryName = 'Unassigned';

      const matchedLeg = resolveExpenseLeg(exp, allLegs);

      if (matchedLeg) {
        const city = cityMap.get(matchedLeg.cityId);
        if (city) {
          countryId = city.countryId;
          const country = countryMap.get(city.countryId);
          countryName = country?.name ?? city.countryId;
        }
      }

      if (!actualByCountry.has(countryId)) {
        actualByCountry.set(countryId, { name: countryName, actual: 0, categories: {} });
      }
      const entry = actualByCountry.get(countryId)!;
      const audAmount = getExpenseAudAmount(exp);
      entry.actual += audAmount;
      entry.categories[exp.category] = (entry.categories[exp.category] || 0) + audAmount;
    }

    // Merge into a unified array
    const allCountryIds = new Set([...Array.from(plannedByCountry.keys()), ...Array.from(actualByCountry.keys())]);
    const comparison = Array.from(allCountryIds).map(id => ({
      countryId: id,
      countryName: plannedByCountry.get(id)?.name ?? actualByCountry.get(id)?.name ?? id,
      planned: plannedByCountry.get(id)?.planned ?? 0,
      actual: actualByCountry.get(id)?.actual ?? 0,
      plannedDays: plannedByCountry.get(id)?.days ?? 0,
      plannedPerDay: (plannedByCountry.get(id)?.days ?? 0) > 0
        ? (plannedByCountry.get(id)?.planned ?? 0) / (plannedByCountry.get(id)?.days ?? 0)
        : null,
      actualPerDay: (plannedByCountry.get(id)?.days ?? 0) > 0
        ? (actualByCountry.get(id)?.actual ?? 0) / (plannedByCountry.get(id)?.days ?? 0)
        : null,
      status: statusByCountry.get(id) ?? null,
      plannedCategories: plannedByCountry.get(id)?.categories ?? {},
      actualCategories: actualByCountry.get(id)?.categories ?? {},
    }));

    // Category breakdown across all expenses
    const categoryTotals: Record<string, number> = {};
    for (const exp of reportableExpenses) {
      const audAmount = getExpenseAudAmount(exp);
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + audAmount;
    }

    return success({ comparison, categoryTotals });
  } catch (err) {
    return handleError(err);
  }
}
