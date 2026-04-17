import { db } from '@/db';
import { countries, cities } from '@/db/schema';
import { error, success, handleError } from '@/lib/api-helpers';
import {
  APP_REGION_VALUES,
  findExistingCountryForCanonical,
  CountryMetadataResolutionError,
  type AppRegion,
} from '@/lib/country-metadata';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const allCountries = await db.select().from(countries);
    const allCities = await db.select().from(cities);

    const result = allCountries.map(c => ({
      ...c,
      cities: allCities.filter(city => city.countryId === c.id),
    }));

    return success(result);
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    region: z.enum(APP_REGION_VALUES).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const name = data.name.trim();

    if (!name) {
      return error('Country name is required.', 400);
    }

    const allCountries = await db.select().from(countries);
    const resolved = findExistingCountryForCanonical(allCountries, {
      id: data.id,
      name,
    });

    if (!resolved) {
      return error(
        `"${name}" is not in the canonical country dataset. Add it to src/lib/data/country-metadata.overrides.json (or the upstream source) and regenerate with "npm run country-metadata:generate" before creating the country.`,
        400
      );
    }

    if (resolved.existing) {
      return error(
        `Country "${resolved.existing.name}" already exists with id "${resolved.existing.id}". Reuse that country instead of creating a duplicate.`,
        409
      );
    }

    const { id, name: canonicalName, currencyCode } = resolved.dbInsert;
    const region: AppRegion = data.region ?? resolved.dbInsert.region;
    const existingCountryById = await db.select().from(countries).where(eq(countries.id, id)).get();
    if (existingCountryById) {
      return error(`Country id "${id}" already exists. Choose a different id or update the existing country.`, 409);
    }

    await db.insert(countries).values({
      id,
      name: canonicalName,
      currencyCode,
      region,
    });

    return success(
      {
        id,
        name: canonicalName,
        currencyCode,
        region,
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
