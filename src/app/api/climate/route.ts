import { instrumentRoute } from '@/lib/analytics/route';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { cities } from '@/db/schema';
import { requireCurrentUser, requireCurrentUserId } from '@/lib/auth';
import { isLibraryAdmin } from '@/lib/auth-policy';
import { checkRateLimit } from '@/lib/rate-limit';
import { success, error, handleError } from '@/lib/api-helpers';
import { findKnownCountryMetadata } from '@/lib/country-metadata';
import { getStoredCityClimates, ensureCityClimate } from '@/lib/city-climate-service';

export const dynamic = 'force-dynamic';
const idsSchema = z.array(z.string().min(1).max(200)).max(300);

/** One database read for the complete itinerary; browsing never refreshes saved weather. */
async function handleGET(request: Request) {
  try {
    await requireCurrentUserId();
    const query = new URL(request.url).searchParams;
    const cityIds = idsSchema.parse(query.has('cityIds') ? JSON.parse(query.get('cityIds')!) : [query.get('cityId')]);
    return success(await getStoredCityClimates(cityIds));
  } catch (err) { return handleError(err); }
}

/**
 * Collect a missing record, or explicitly retry/refresh. No provider key is involved.
 *
 * Climate is shared library data. Any account may fill a missing record or retry a failed one,
 * which is all the planner asks for; replacing a successful record is reserved for library
 * administrators. Collection is rate limited per account because each call reaches Open-Meteo.
 */
async function handlePOST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const cityId = z.string().min(1).max(200).parse(new URL(request.url).searchParams.get('cityId'));
    const { refresh } = z.object({ refresh: z.boolean().default(false) }).parse(await request.json());
    if (!isLibraryAdmin(user.email)) {
      const stored = (await getStoredCityClimates([cityId]))[cityId];
      if (stored) return success(stored);
      const limit = await checkRateLimit(`climate:user:${user.id}`, { max: 200, windowSeconds: 60 * 60 });
      if (!limit.allowed) return error('Too many climate requests. Try again later.', 429);
    }
    const city = await db.select({ id: cities.id, name: cities.name, countryId: cities.countryId }).from(cities).where(eq(cities.id, cityId)).get();
    if (!city) return error('City not found.', 404);
    const country = findKnownCountryMetadata(city.countryId);
    if (!country) return error('Climate location unavailable for this country.', 422);
    return success(await ensureCityClimate(city.id, city.name, country.iso2, { refresh }));
  } catch (err) { return handleError(err); }
}

export const GET = instrumentRoute(handleGET, '/api/climate', 'GET');
export const POST = instrumentRoute(handlePOST, '/api/climate', 'POST');
