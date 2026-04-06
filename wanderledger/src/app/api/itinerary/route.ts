import { db } from '@/db';
import { itineraryLegs, cities, countries } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { getDailyCost, getLegTotal } from '@/lib/cost-calculator';
import { success, handleError } from '@/lib/api-helpers';
import type { AccomTier, FoodTier, DrinksTier, ActivitiesTier } from '@/types';

export async function GET() {
  try {
    const legs = await db
      .select()
      .from(itineraryLegs)
      .orderBy(asc(itineraryLegs.sortOrder));

    const allCities = await db.select().from(cities);
    const allCountries = await db.select().from(countries);

    const cityMap = new Map(allCities.map(c => [c.id, c]));
    const countryMap = new Map(allCountries.map(c => [c.id, c]));

    const legsWithCosts = legs.map(leg => {
      const city = cityMap.get(leg.cityId);
      const country = city ? countryMap.get(city.countryId) : null;

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
            }
          )
        : 0;

      const legTotal = getLegTotal(
        dailyCost,
        leg.nights,
        leg.intercityTransportCost ?? 0
      );

      return {
        ...leg,
        cityName: city?.name ?? 'Unknown',
        countryName: country?.name ?? 'Unknown',
        countryId: city?.countryId ?? '',
        dailyCost,
        legTotal,
      };
    });

    return success(legsWithCosts);
  } catch (err) {
    return handleError(err);
  }
}
