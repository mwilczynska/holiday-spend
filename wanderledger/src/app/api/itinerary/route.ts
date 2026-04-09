import { db } from '@/db';
import { itineraryLegs, itineraryLegTransports, cities, countries } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { getDailyCost, getLegTotalFromTransports } from '@/lib/cost-calculator';
import { getIntercityTransportTotal, groupIntercityTransportsByLegId, normalizeIntercityTransports } from '@/lib/intercity-transport';
import { getPlannerGroupSize } from '@/lib/planner-settings';
import { success, handleError } from '@/lib/api-helpers';
import type { AccomTier, FoodTier, DrinksTier, ActivitiesTier } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const legs = await db
      .select()
      .from(itineraryLegs)
      .orderBy(asc(itineraryLegs.sortOrder));
    const transportRows = await db
      .select()
      .from(itineraryLegTransports)
      .orderBy(asc(itineraryLegTransports.sortOrder), asc(itineraryLegTransports.id));

    const allCities = await db.select().from(cities);
    const allCountries = await db.select().from(countries);
    const groupSize = await getPlannerGroupSize();

    const cityMap = new Map(allCities.map(c => [c.id, c]));
    const countryMap = new Map(allCountries.map(c => [c.id, c]));
    const transportMap = groupIntercityTransportsByLegId(transportRows);

    const legsWithCosts = legs.map(leg => {
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
