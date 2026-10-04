import { loadPlannerCities } from '@/lib/city-library-data';
import { db } from '@/db';
import { cities, countries } from '@/db/schema';
import { error, success, handleError } from '@/lib/api-helpers';
import { eq } from 'drizzle-orm';
import { ensureCityClimate } from '@/lib/city-climate-service';
import {
  CountryMetadataResolutionError,
  findExistingCountryForCanonical,
  slugifyId,
} from '@/lib/country-metadata';
import type { CityClimateStatus } from '@/lib/city-generation-service';
import { z } from 'zod';

const createSchema = z.object({
  id: z.string().optional(),
  countryId: z.string().min(1),
  name: z.string().min(1),
  accomHostel: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  accomPrivateRoom: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  accom1star: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  accom2star: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  accom3star: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  accom4star: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  foodStreet: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  foodBudget: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  foodMid: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  foodHigh: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  drinkLocalBeer: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  drinkImportBeer: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  drinkWineGlass: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  drinkCocktail: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  drinkCoffee: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  drinksNone: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  drinksLight: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  drinksModerate: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  drinksHeavy: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  activitiesFree: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  activitiesBudget: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  activitiesMid: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  activitiesHigh: z.number().finite().nonnegative('City costs must be nonnegative.').optional(),
  estimationSource: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const view = new URL(request.url).searchParams.get('view');

    if (view === 'planner') {
      const plannerCities = await loadPlannerCities();

      return success(plannerCities);
    }

    return success(await db.select().from(cities));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const name = data.name.trim();
    const requestedCountryId = data.countryId.trim();
    const id = slugifyId(data.id?.trim() || name);

    if (!name) {
      return error('City name is required.', 400);
    }

    if (!id) {
      return error('City id is required.', 400);
    }

    const allCountries = await db.select().from(countries);
    const resolvedCountry = findExistingCountryForCanonical(allCountries, {
      id: requestedCountryId,
      name: requestedCountryId,
    });
    if (!resolvedCountry) {
      return error(
        `"${requestedCountryId}" is not in the canonical country dataset. Add it to src/lib/data/country-metadata.overrides.json and regenerate before adding cities under it.`,
        400
      );
    }

    const countryId = resolvedCountry.existing?.id ?? resolvedCountry.dbInsert.id;

    const existingCity = await db.select({ id: cities.id }).from(cities).where(eq(cities.id, id)).get();
    if (existingCity) {
      return error(`City id "${id}" already exists. Choose a different id or update the existing city.`, 409);
    }

    const allCitiesInCountry = await db.select().from(cities).where(eq(cities.countryId, countryId));
    const duplicateByName = allCitiesInCountry.find((city) => slugifyId(city.name) === slugifyId(name));
    if (duplicateByName) {
      return error(
        `City "${duplicateByName.name}" already exists in this country with id "${duplicateByName.id}". Reuse that city instead of creating a duplicate.`,
        409
      );
    }

    if (!resolvedCountry.existing) {
      await db.insert(countries).values(resolvedCountry.dbInsert);
    }

    await db.insert(cities).values({
      ...data,
      id,
      countryId,
      name,
      estimatedAt: new Date().toISOString(),
    });

    let climateStatus: CityClimateStatus = 'unavailable';
    try {
      const climate = await ensureCityClimate(
        id,
        name,
        resolvedCountry.canonical.iso2,
        { refresh: false }
      );
      climateStatus = climate
        ? climate.refreshFailedAt ? 'stale' : 'ready'
        : 'unavailable';
      if (!climate) {
        console.warn('[city-climate] Initial climate collection returned no data for ' + id + '.');
      } else if (climate.refreshFailedAt) {
        console.warn('[city-climate] Previous climate refresh failed for ' + id + '; keeping the saved result.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown climate error.';
      console.warn('[city-climate] Initial climate collection failed for ' + id + ': ' + message);
    }

    return success(
      {
        ...data,
        id,
        countryId,
        name,
        climateStatus,
      },
      201
    );
  } catch (err) {
    if (err instanceof CountryMetadataResolutionError) {
      return error(err.message, 400);
    }
    return handleError(err);
  }
}
