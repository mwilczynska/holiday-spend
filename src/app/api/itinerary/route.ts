import { db } from '@/db';
import { itineraryLegs, itineraryLegTransports, cities, countries } from '@/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { getDailyCost, getLegTotalFromTransports } from '@/lib/cost-calculator';
import { getIntercityTransportTotal, groupIntercityTransportsByLegId, normalizeIntercityTransports } from '@/lib/intercity-transport';
import { deriveLegDates } from '@/lib/itinerary-leg-dates';
import { getPlannerGroupSize } from '@/lib/planner-settings';
import { requireCurrentUserId } from '@/lib/auth';
import { success, handleError } from '@/lib/api-helpers';
import type { AccomTier, FoodTier, DrinksTier, ActivitiesTier } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const view = new URL(request.url).searchParams.get('view');

    if (view === 'track') {
      const trackLegs = await db
        .select({
          id: itineraryLegs.id,
          cityId: itineraryLegs.cityId,
          cityName: cities.name,
          countryName: countries.name,
          startDate: itineraryLegs.startDate,
          endDate: itineraryLegs.endDate,
          nights: itineraryLegs.nights,
          sortOrder: itineraryLegs.sortOrder,
        })
        .from(itineraryLegs)
        .leftJoin(cities, eq(itineraryLegs.cityId, cities.id))
        .leftJoin(countries, eq(cities.countryId, countries.id))
        .where(eq(itineraryLegs.userId, userId))
        .orderBy(asc(itineraryLegs.sortOrder));

      return success(deriveLegDates(trackLegs).map((leg) => ({
        id: leg.id,
        cityName: leg.cityName ?? 'Unknown',
        countryName: leg.countryName ?? 'Unknown',
        startDate: leg.startDate,
        endDate: leg.endDate,
      })));
    }

    const legs = await db
      .select()
      .from(itineraryLegs)
      .where(eq(itineraryLegs.userId, userId))
      .orderBy(asc(itineraryLegs.sortOrder));
    const transportRows = legs.length > 0
      ? await db
          .select()
          .from(itineraryLegTransports)
          .where(inArray(itineraryLegTransports.legId, legs.map((leg) => leg.id)))
          .orderBy(asc(itineraryLegTransports.sortOrder), asc(itineraryLegTransports.id))
      : [];

    const allCities = await db.select().from(cities);
    const allCountries = await db.select().from(countries);
    const groupSize = await getPlannerGroupSize(userId);

    const cityMap = new Map(allCities.map(c => [c.id, c]));
    const countryMap = new Map(allCountries.map(c => [c.id, c]));
    const transportMap = groupIntercityTransportsByLegId(transportRows);

    const legsWithCosts = deriveLegDates(legs).map(leg => {
      const city = cityMap.get(leg.cityId);
      const country = city ? countryMap.get(city.countryId) : null;
      const intercityTransports = normalizeIntercityTransports(transportMap.get(leg.id));

      const dailyCost = city
        ? getDailyCost(
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
          )
        : 0;

      const legTotal = getLegTotalFromTransports(
        dailyCost,
        leg.nights,
        intercityTransports
      );

      return {
        ...leg,
        cityName: city?.name ?? 'Unknown',
        countryName: country?.name ?? 'Unknown',
        countryId: city?.countryId ?? '',
        intercityTransports,
        intercityTransportCost: getIntercityTransportTotal(intercityTransports),
        intercityTransportNote: intercityTransports.find((transport) => transport.note)?.note ?? null,
        groupSize,
        dailyCost,
        legTotal,
      };
    });

    return success(legsWithCosts);
  } catch (err) {
    return handleError(err);
  }
}
