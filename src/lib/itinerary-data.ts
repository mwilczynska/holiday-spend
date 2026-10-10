import { db } from '@/db';
import { itineraryLegs, itineraryLegTransports, cities, countries } from '@/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { getDailyCost, getLegTotalFromTransports } from '@/lib/cost-calculator';
import { getIntercityTransportTotal, groupIntercityTransportsByLegId, normalizeIntercityTransports } from '@/lib/intercity-transport';
import { deriveLegDates } from '@/lib/itinerary-leg-dates';
import { getPlannerGroupSize } from '@/lib/planner-settings';
import { getCityImageViews } from '@/lib/city-image-service';
import type { AccomTier, FoodTier, DrinksTier, ActivitiesTier } from '@/types';


type ItineraryInputs = {
  cities: Array<typeof cities.$inferSelect>;
  countries: Array<typeof countries.$inferSelect>;
  groupSize: number;
};

export async function loadItinerary(userId: string, inputs?: ItineraryInputs) {
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

  const allCities = inputs?.cities ?? await db.select().from(cities);
  const allCountries = inputs?.countries ?? await db.select().from(countries);
  const groupSize = inputs?.groupSize ?? await getPlannerGroupSize(userId);

  const cityMap = new Map(allCities.map(c => [c.id, c]));
  const countryMap = new Map(allCountries.map(c => [c.id, c]));
  const transportMap = groupIntercityTransportsByLegId(transportRows);
  const cityImages = getCityImageViews(legs.map((leg) => leg.cityId));

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
      intercityTransports,
      leg.miscellaneousExpenses
    );

    return {
      ...leg,
      cityName: city?.name ?? 'Unknown',
      countryName: country?.name ?? 'Unknown',
      countryId: city?.countryId ?? '',
      cityImage: cityImages[leg.cityId] ?? null,
      intercityTransports,
      intercityTransportCost: getIntercityTransportTotal(intercityTransports),
      intercityTransportNote: intercityTransports.find((transport) => transport.note)?.note ?? null,
      groupSize,
      dailyCost,
      legTotal,
    };
  });

  return legsWithCosts;
}
