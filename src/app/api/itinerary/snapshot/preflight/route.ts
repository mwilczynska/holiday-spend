import { db } from '@/db';
import { cities, countries } from '@/db/schema';
import { error, handleError, success } from '@/lib/api-helpers';
import { collectMissingSnapshotCities, parseSnapshotImportRequest } from '@/lib/snapshot-import';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { snapshot } = parseSnapshotImportRequest(body);

    const cityRows = await db.select({ id: cities.id }).from(cities);
    const countryRows = await db.select({ id: countries.id }).from(countries);
    const knownCityIds = new Set(cityRows.map((row) => row.id));
    const knownCountryIds = new Set(countryRows.map((row) => row.id));

    const missingCities = collectMissingSnapshotCities(snapshot, knownCityIds);
    const missingCountry = snapshot.fixedCosts.find((cost) => cost.countryId && !knownCountryIds.has(cost.countryId));
    if (missingCountry?.countryId) {
      return error(`Cannot import snapshot. Unknown country id "${missingCountry.countryId}".`, 400);
    }

    return success({
      missingCities,
      readyToImport: missingCities.length === 0,
    });
  } catch (err) {
    return handleError(err);
  }
}
