import { db } from '@/db';
import { expenses, itineraryLegs, itineraryLegTransports, cities, countries } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { buildBurnRateSeries, buildCountryBands, enumerateDates } from '@/lib/burn-rate';
import { getDailyBreakdown } from '@/lib/cost-calculator';
import { getExpenseAudAmount } from '@/lib/expense-aud';
import { findLegForExpenseDate, getExpenseReportingDate, resolveExpenseLeg } from '@/lib/expense-leg-assignment';
import { getIntercityTransportTotal, groupIntercityTransportsByLegId } from '@/lib/intercity-transport';
import { getPlannerGroupSize } from '@/lib/planner-settings';
import { getTripWindow, isWithinTripWindow } from '@/lib/trip-window';
import { success, handleError } from '@/lib/api-helpers';
import type { AccomTier, ActivitiesTier, DrinksTier, FoodTier } from '@/types';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  try {
    const allExpenses = await db.select().from(expenses);
    const allLegs = await db.select().from(itineraryLegs).orderBy(asc(itineraryLegs.sortOrder));
    const allTransports = await db.select().from(itineraryLegTransports).orderBy(asc(itineraryLegTransports.sortOrder), asc(itineraryLegTransports.id));
    const allCities = await db.select().from(cities);
    const allCountries = await db.select().from(countries);
    const groupSize = await getPlannerGroupSize();

    const legMap = new Map(allLegs.map((leg) => [leg.id, leg]));
    const cityMap = new Map(allCities.map((city) => [city.id, city]));
    const countryMap = new Map(allCountries.map((country) => [country.id, country]));
    const transportMap = groupIntercityTransportsByLegId(allTransports);
    const { tripStart, tripEnd } = getTripWindow(allLegs);

    const activeExpenses = allExpenses.filter((expense) => {
      if (expense.isExcluded) return false;
      const matchedLeg = resolveExpenseLeg(expense, allLegs);
      return Boolean(matchedLeg) || isWithinTripWindow(getExpenseReportingDate(expense, allLegs), tripStart, tripEnd);
    });

    const expenseDates = activeExpenses.map((expense) => getExpenseReportingDate(expense, allLegs)).filter(Boolean).sort();
    const seriesStart = minDate(tripStart, expenseDates[0]);
    const seriesEnd = maxDate(tripEnd, expenseDates[expenseDates.length - 1]);

    if (!seriesStart || !seriesEnd) {
      return success({
        cumulative: [],
        countryBands: [],
        tripStart,
        tripEnd,
        totalNights: allLegs.reduce((sum, leg) => sum + leg.nights, 0),
      });
    }

    const actualByDate = new Map<string, number>();
    for (const expense of activeExpenses) {
      const reportingDate = getExpenseReportingDate(expense, allLegs);
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
      const matchedLegRef = findLegForExpenseDate(date, allLegs);
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

    return success({
      cumulative,
      countryBands: buildCountryBands(cumulative),
      tripStart,
      tripEnd,
      totalNights: allLegs.reduce((sum, leg) => sum + leg.nights, 0),
    });
  } catch (err) {
    return handleError(err);
  }
}
