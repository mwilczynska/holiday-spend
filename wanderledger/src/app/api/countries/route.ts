import { db } from '@/db';
import { countries, cities } from '@/db/schema';
import { success, handleError } from '@/lib/api-helpers';
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
  id: z.string().min(1),
  name: z.string().min(1),
  currencyCode: z.string().min(1),
  region: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    await db.insert(countries).values({
      id: data.id,
      name: data.name,
      currencyCode: data.currencyCode,
      region: data.region,
    });

    return success(data, 201);
  } catch (err) {
    return handleError(err);
  }
}
