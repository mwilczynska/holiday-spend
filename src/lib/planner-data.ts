import { db } from '@/db';
import { cities, countries, fixedCosts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { loadItinerary } from './itinerary-data';
import { toPlannerCity } from './city-library-data';
import { getPlannerGroupSize } from './planner-settings';
import { loadSavedPlanSummaries } from './saved-plan-data';
import { getStoredCityClimates } from './city-climate-service';

export async function loadPlannerData(userId: string) {
  const [allCities, allCountries, groupSize, costs, savedPlans] = await Promise.all([
    db.select().from(cities), db.select().from(countries), getPlannerGroupSize(userId),
    db.select().from(fixedCosts).where(eq(fixedCosts.userId, userId)), loadSavedPlanSummaries(userId),
  ]);
  const legs = await loadItinerary(userId, { cities: allCities, countries: allCountries, groupSize });
  const countryMap = new Map(allCountries.map(country => [country.id, country.name]));
  const plannerCities = allCities.map(toPlannerCity);
  const climate = await getStoredCityClimates(legs.map(leg => leg.cityId));
  return {
    legs, groupSize, savedPlans, climate, fixedCosts: costs,
    countries: allCountries.sort((a,b) => a.name.localeCompare(b.name)),
    cities: plannerCities.map(city => ({ ...city, countryName: countryMap.get(city.countryId) || 'Unknown' }))
      .sort((a,b) => (a.countryName + '-' + a.name).localeCompare(b.countryName + '-' + b.name)),
  };
}
