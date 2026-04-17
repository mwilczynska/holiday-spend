import { db } from '@/db';
import { countries, cities } from '@/db/schema';
import { error, success, handleError } from '@/lib/api-helpers';
import {
  APP_REGION_VALUES,
  findKnownCountryCurrencyCode,
  findKnownCountryRegion,
  slugifyId,
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

const createSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  currencyCode: z.string().optional(),
  region: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const name = data.name.trim();
    const id = slugifyId(data.id?.trim() || name);
    const currencyCode = (data.currencyCode?.trim().toUpperCase() || findKnownCountryCurrencyCode(name) || '').trim();
    const region = (data.region?.trim() || findKnownCountryRegion(name) || '').trim();

    if (!name) {
      return error('Country name is required.', 400);
    }

    if (!id) {
      return error('Country id is required.', 400);
    }

    if (!currencyCode) {
      return error(`Enter a currency code because one could not be inferred for "${name}".`, 400);
    }

    if (region && !APP_REGION_VALUES.includes(region as (typeof APP_REGION_VALUES)[number])) {
      return error(`Region "${region}" is not one of the supported app regions.`, 400);
    }

    const existingCountryById = await db.select().from(countries).where(eq(countries.id, id)).get();
    if (existingCountryById) {
      return error(`Country id "${id}" already exists. Choose a different id or update the existing country.`, 409);
    }

    const allCountries = await db.select().from(countries);
    const duplicateByName = allCountries.find((country) => slugifyId(country.name) === slugifyId(name));
    if (duplicateByName) {
      return error(
        `Country "${duplicateByName.name}" already exists with id "${duplicateByName.id}". Reuse that country instead of creating a duplicate.`,
        409
      );
    }

    await db.insert(countries).values({
      id,
      name,
      currencyCode,
      region: region || null,
    });

    return success(
      {
        id,
        name,
        currencyCode,
        region: region || null,
      },
      201
    );
  } catch (err) {
    return handleError(err);
  }
}
