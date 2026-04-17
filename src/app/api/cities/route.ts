import { db } from '@/db';
import { cities, countries } from '@/db/schema';
import { error, success, handleError } from '@/lib/api-helpers';
import { eq } from 'drizzle-orm';
import { findKnownCountryMetadata, slugifyId } from '@/lib/country-metadata';
import { z } from 'zod';

const createSchema = z.object({
  id: z.string().optional(),
  countryId: z.string().min(1),
  name: z.string().min(1),
  accomHostel: z.number().optional(),
  accomPrivateRoom: z.number().optional(),
  accom1star: z.number().optional(),
  accom2star: z.number().optional(),
  accom3star: z.number().optional(),
  accom4star: z.number().optional(),
  foodStreet: z.number().optional(),
  foodBudget: z.number().optional(),
  foodMid: z.number().optional(),
  foodHigh: z.number().optional(),
  drinkLocalBeer: z.number().optional(),
  drinkImportBeer: z.number().optional(),
  drinkWineGlass: z.number().optional(),
  drinkCocktail: z.number().optional(),
  drinkCoffee: z.number().optional(),
  drinksNone: z.number().optional(),
  drinksLight: z.number().optional(),
  drinksModerate: z.number().optional(),
  drinksHeavy: z.number().optional(),
  activitiesFree: z.number().optional(),
  activitiesBudget: z.number().optional(),
  activitiesMid: z.number().optional(),
  activitiesHigh: z.number().optional(),
  estimationSource: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const allCities = await db.select().from(cities);
    return success(allCities);
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

    const canonicalCountry = findKnownCountryMetadata(requestedCountryId);
    if (!canonicalCountry) {
      return error(
        `"${requestedCountryId}" is not in the canonical country dataset. Add it to src/lib/data/country-metadata.overrides.json and regenerate before adding cities under it.`,
        400
      );
    }

    const countryId = canonicalCountry.id;

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

    const existingCountry = await db
      .select({ id: countries.id })
      .from(countries)
      .where(eq(countries.id, countryId))
      .get();
    if (!existingCountry) {
      await db.insert(countries).values({
        id: canonicalCountry.id,
        name: canonicalCountry.name,
        currencyCode: canonicalCountry.currencyCode,
        region: canonicalCountry.region,
      });
    }

    await db.insert(cities).values({
      ...data,
      id,
      countryId,
      name,
      estimatedAt: new Date().toISOString(),
    });

    return success(
      {
        ...data,
        id,
        countryId,
        name,
      },
      201
    );
  } catch (err) {
    return handleError(err);
  }
}
