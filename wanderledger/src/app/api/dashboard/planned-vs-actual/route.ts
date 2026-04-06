import { db } from '@/db';
import { itineraryLegs, cities, countries, expenses } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { getLegTotal, getDailyBreakdown } from '@/lib/cost-calculator';
import { success, handleError } from '@/lib/api-helpers';
import type { AccomTier, FoodTier, DrinksTier, ActivitiesTier } from '@/types';

export async function GET() {
  try {
    const allLegs = await db.select().from(itineraryLegs).orderBy(asc(itineraryLegs.sortOrder));
    const allCities = await db.select().from(cities);
    const allCountries = await db.select().from(countries);
    const allExpenses = await db.select().from(expenses);

    const cityMap = new Map(allCities.map(c => [c.id, c]));
    const countryMap = new Map(allCountries.map(c => [c.id, c]));

    // Build planned totals per country
    const plannedByCountry = new Map<string, { name: string; planned: number; categories: Record<string, number> }>();

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
        { accomOverride: leg.accomOverride, foodOverride: leg.foodOverride, drinksOverride: leg.drinksOverride, activitiesOverride: leg.activitiesOverride, transportOverride: leg.transportOverride }
      );

      const legTotal = getLegTotal(breakdown.total, leg.nights, leg.intercityTransportCost ?? 0);

      if (!plannedByCountry.has(city.countryId)) {
        plannedByCountry.set(city.countryId, { name: countryName, planned: 0, categories: {} });
      }
      const entry = plannedByCountry.get(city.countryId)!;
      entry.planned += legTotal;
      entry.categories.accommodation = (entry.categories.accommodation || 0) + breakdown.accommodation * leg.nights;
      entry.categories.food = (entry.categories.food || 0) + breakdown.food * leg.nights;
      entry.categories.drinks = (entry.categories.drinks || 0) + breakdown.drinks * leg.nights;
      entry.categories.activities = (entry.categories.activities || 0) + breakdown.activities * leg.nights;
      entry.categories.transport = (entry.categories.transport || 0) + breakdown.transport * leg.nights + (leg.intercityTransportCost ?? 0);
    }

    // Build actual totals per country (join expense → leg → city → country)
    const activeExpenses = allExpenses.filter(e => !e.isExcluded);
    const legMap = new Map(allLegs.map(l => [l.id, l]));

    const actualByCountry = new Map<string, { name: string; actual: number; categories: Record<string, number> }>();

    for (const exp of activeExpenses) {
      let countryId = 'unassigned';
      let countryName = 'Unassigned';

      if (exp.legId) {
        const leg = legMap.get(exp.legId);
        if (leg) {
          const city = cityMap.get(leg.cityId);
          if (city) {
            countryId = city.countryId;
            const country = countryMap.get(city.countryId);
            countryName = country?.name ?? city.countryId;
          }
        }
      }

      if (!actualByCountry.has(countryId)) {
        actualByCountry.set(countryId, { name: countryName, actual: 0, categories: {} });
      }
      const entry = actualByCountry.get(countryId)!;
      const audAmount = exp.amountAud ?? exp.amount;
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
      plannedCategories: plannedByCountry.get(id)?.categories ?? {},
      actualCategories: actualByCountry.get(id)?.categories ?? {},
    }));

    // Category breakdown across all expenses
    const categoryTotals: Record<string, number> = {};
    for (const exp of activeExpenses) {
      const audAmount = exp.amountAud ?? exp.amount;
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + audAmount;
    }

    return success({ comparison, categoryTotals });
  } catch (err) {
    return handleError(err);
  }
}
