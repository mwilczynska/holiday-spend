import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { cities } from '@/db/schema';
import { requireCurrentUserId } from '@/lib/auth';
import { success, error, handleError } from '@/lib/api-helpers';
import { findKnownCountryMetadata } from '@/lib/country-metadata';
import { getStoredCityClimates, ensureCityClimate } from '@/lib/city-climate-service';

export const dynamic = 'force-dynamic';
const idsSchema = z.array(z.string().min(1).max(200)).max(300);

/** One database read for the complete itinerary; browsing never refreshes saved weather. */
export async function GET(request: Request) {
  try {
    await requireCurrentUserId();
    const query = new URL(request.url).searchParams;
    const cityIds = idsSchema.parse(query.has('cityIds') ? JSON.parse(query.get('cityIds')!) : [query.get('cityId')]);
    return success(await getStoredCityClimates(cityIds));
  } catch (err) { return handleError(err); }
}

/** Collect a missing record, or explicitly retry/refresh. No provider key is involved. */
export async function POST(request: Request) {
  try {
    await requireCurrentUserId();
    const cityId = z.string().min(1).max(200).parse(new URL(request.url).searchParams.get('cityId'));
    const { refresh } = z.object({ refresh: z.boolean().default(false) }).parse(await request.json());
    const city = await db.select({ id: cities.id, name: cities.name, countryId: cities.countryId }).from(cities).where(eq(cities.id, cityId)).get();
    if (!city) return error('City not found.', 404);
    const country = findKnownCountryMetadata(city.countryId);
    if (!country) return error('Climate location unavailable for this country.', 422);
    return success(await ensureCityClimate(city.id, city.name, country.iso2, { refresh }));
  } catch (err) { return handleError(err); }
}
