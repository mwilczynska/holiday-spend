import { db } from '@/db';
import { cities, countries } from '@/db/schema';

type CountryRow = typeof countries.$inferSelect;
type CountryWithCities = CountryRow & { cities: Array<typeof cities.$inferSelect> };
export function loadCountries(includeCities: true): Promise<CountryWithCities[]>;
export function loadCountries(includeCities?: false): Promise<CountryRow[]>;
export function loadCountries(includeCities: boolean): Promise<Array<CountryRow | CountryWithCities>>;
export async function loadCountries(includeCities = false) {
  if (!includeCities) {
    return db.select({ id: countries.id, name: countries.name, currencyCode: countries.currencyCode, region: countries.region }).from(countries);
  }
  const allCountries = await db.select().from(countries);
  const allCities = await db.select().from(cities);

  // Group once rather than scanning every city per country, which was
  // O(countries x cities) - roughly 14,000 comparisons at current volumes.
  const citiesByCountry = new Map<string, typeof allCities>();
  for (const city of allCities) {
    if (city.countryId === null) continue;
    const bucket = citiesByCountry.get(city.countryId);
    if (bucket) {
      bucket.push(city);
    } else {
      citiesByCountry.set(city.countryId, [city]);
    }
  }

  const result = allCountries.map((c) => ({
    ...c,
    cities: citiesByCountry.get(c.id) ?? [],
  }));

  return result;
}

export async function loadPlannerCities() {
  const plannerCities = await db.select({
    id: cities.id,
    countryId: cities.countryId,
    name: cities.name,
    accomHostel: cities.accomHostel,
    accomPrivateRoom: cities.accomPrivateRoom,
    accom1star: cities.accom1star,
    accom2star: cities.accom2star,
    accom3star: cities.accom3star,
    accom4star: cities.accom4star,
    foodStreet: cities.foodStreet,
    foodBudget: cities.foodBudget,
    foodMid: cities.foodMid,
    foodHigh: cities.foodHigh,
    drinkCoffee: cities.drinkCoffee,
    drinksNone: cities.drinksNone,
    drinksLight: cities.drinksLight,
    drinksModerate: cities.drinksModerate,
    drinksHeavy: cities.drinksHeavy,
    activitiesFree: cities.activitiesFree,
    activitiesBudget: cities.activitiesBudget,
    activitiesMid: cities.activitiesMid,
    activitiesHigh: cities.activitiesHigh,
    transportLocal: cities.transportLocal,
  }).from(cities);
  return plannerCities;
}

export function toPlannerCity(city: typeof cities.$inferSelect) {
  const {
    id, countryId, name, accomHostel, accomPrivateRoom, accom1star, accom2star, accom3star, accom4star,
    foodStreet, foodBudget, foodMid, foodHigh, drinkCoffee, drinksNone, drinksLight, drinksModerate, drinksHeavy,
    activitiesFree, activitiesBudget, activitiesMid, activitiesHigh, transportLocal,
  } = city;
  return {
    id, countryId, name, accomHostel, accomPrivateRoom, accom1star, accom2star, accom3star, accom4star,
    foodStreet, foodBudget, foodMid, foodHigh, drinkCoffee, drinksNone, drinksLight, drinksModerate, drinksHeavy,
    activitiesFree, activitiesBudget, activitiesMid, activitiesHigh, transportLocal,
  };
}
