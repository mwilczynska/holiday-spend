import { db } from '@/db';
import { cities, countries } from '@/db/schema';
import { CityGenerationError } from '@/lib/city-generation';
import { generateAndPersistCityEstimate } from '@/lib/city-generation-service';
import { CountryMetadataResolutionError, findExistingCountryForCanonical } from '@/lib/country-metadata';
import type { MissingCityResolution, SnapshotImportRequest } from '@/lib/snapshot-import';

export interface ResolveMissingCitiesResult {
  createdCountries: string[];
  createdCities: string[];
  generatedCities: string[];
  knownCountryIds: Set<string>;
}

function normalizeCountryName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export async function resolveMissingCities(params: {
  resolutions: MissingCityResolution[];
  missingCityStrategy: SnapshotImportRequest['missingCityStrategy'];
  generationConfig?: SnapshotImportRequest['generationConfig'];
}) {
  const { resolutions, missingCityStrategy, generationConfig } = params;

  const cityRows = await db.select({ id: cities.id }).from(cities);
  const countryRows = await db.select({ id: countries.id, name: countries.name }).from(countries);
  const knownCityIds = new Set(cityRows.map((row) => row.id));
  const knownCountryIds = new Set(countryRows.map((row) => row.id));

  const createdCountries: string[] = [];
  const createdCities: string[] = [];
  const generatedCities: string[] = [];

  const createdCountryDefinitions = new Map<
    string,
    { id: string; name: string; currencyCode: string; region: string }
  >();
  const resolvedCountryIdByCityId = new Map<string, string>();

  for (const resolution of resolutions) {
    const countryName = normalizeCountryName(resolution.countryName);
    let resolvedCountry;
    try {
      resolvedCountry = findExistingCountryForCanonical(countryRows, {
        id: resolution.countryId,
        name: countryName,
      });
    } catch (err) {
      if (err instanceof CountryMetadataResolutionError) {
        throw new CityGenerationError(err.message, 400);
      }
      throw err;
    }
    if (!resolvedCountry) {
      throw new CityGenerationError(
        `"${countryName}" is not in the canonical country dataset. Add it to src/lib/data/country-metadata.overrides.json (or the upstream source) and regenerate with "npm run country-metadata:generate" before importing cities in that country.`,
        400
      );
    }

    const resolvedCountryId = resolvedCountry.existing?.id ?? resolvedCountry.dbInsert.id;
    resolvedCountryIdByCityId.set(resolution.cityId, resolvedCountryId);

    if (resolvedCountry.existing || knownCountryIds.has(resolvedCountryId)) continue;

    createdCountryDefinitions.set(resolvedCountry.dbInsert.id, resolvedCountry.dbInsert);
  }

  for (const country of Array.from(createdCountryDefinitions.values())) {
    await db.insert(countries).values(country);
    knownCountryIds.add(country.id);
    createdCountries.push(country.id);
  }

  for (const resolution of resolutions) {
    const cityId = resolution.cityId.trim();
    const resolvedCountryId = resolvedCountryIdByCityId.get(resolution.cityId);
    if (!resolvedCountryId) {
      throw new CityGenerationError(`Could not resolve the country for "${resolution.cityName}".`, 400);
    }

    if (!knownCityIds.has(cityId)) {
      await db.insert(cities).values({
        id: cityId,
        name: resolution.cityName.trim(),
        countryId: resolvedCountryId,
        estimationSource: 'snapshot_import_placeholder',
        estimatedAt: new Date().toISOString(),
        notes: 'Created automatically during plan snapshot import or planner add-leg flow.',
      });
      knownCityIds.add(cityId);
      createdCities.push(cityId);
    }

    if (missingCityStrategy === 'generate') {
      await generateAndPersistCityEstimate({
        cityId,
        provider: generationConfig?.provider,
        apiKey: generationConfig?.apiKey,
        model: generationConfig?.model,
        referenceDate: generationConfig?.referenceDate,
        extraContext: generationConfig?.extraContext,
      });
      generatedCities.push(cityId);
    }
  }

  return {
    createdCountries,
    createdCities,
    generatedCities,
    knownCountryIds,
  } satisfies ResolveMissingCitiesResult;
}
