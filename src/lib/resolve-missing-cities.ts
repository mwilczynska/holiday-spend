import { db } from '@/db';
import { cities, countries } from '@/db/schema';
import { CityGenerationError } from '@/lib/city-generation';
import { generateAndPersistCityEstimate } from '@/lib/city-generation-service';
import { findKnownCountryCurrencyCode, slugifyId } from '@/lib/country-metadata';
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
  const countryRows = await db.select({ id: countries.id }).from(countries);
  const knownCityIds = new Set(cityRows.map((row) => row.id));
  const knownCountryIds = new Set(countryRows.map((row) => row.id));

  const createdCountries: string[] = [];
  const createdCities: string[] = [];
  const generatedCities: string[] = [];

  const createdCountryDefinitions = new Map<
    string,
    { name: string; currencyCode: string; region: string | null }
  >();

  for (const resolution of resolutions) {
    const countryName = normalizeCountryName(resolution.countryName);
    const derivedCountryId = resolution.countryId?.trim() || slugifyId(countryName);
    if (knownCountryIds.has(derivedCountryId)) continue;

    const currencyCode =
      resolution.countryCurrencyCode?.trim().toUpperCase() ||
      findKnownCountryCurrencyCode(countryName) ||
      '';
    const region = resolution.countryRegion?.trim() || null;

    if (!currencyCode) {
      throw new CityGenerationError(
        `Cannot create country "${countryName}" without a currency code.`,
        400
      );
    }

    const existingDefinition = createdCountryDefinitions.get(derivedCountryId);
    if (existingDefinition) {
      const hasNameConflict = slugifyId(existingDefinition.name) !== slugifyId(countryName);
      const hasCurrencyConflict = existingDefinition.currencyCode !== currencyCode;
      const hasRegionConflict = Boolean(existingDefinition.region && region && existingDefinition.region !== region);

      if (hasNameConflict || hasCurrencyConflict || hasRegionConflict) {
        throw new CityGenerationError(
          `Country id "${derivedCountryId}" was given conflicting details in missing city resolutions.`,
          400
        );
      }

      if (!existingDefinition.region && region) {
        existingDefinition.region = region;
      }
      continue;
    }

    createdCountryDefinitions.set(derivedCountryId, {
      name: countryName,
      currencyCode,
      region,
    });
  }

  for (const [countryId, country] of Array.from(createdCountryDefinitions.entries())) {
    await db.insert(countries).values({
      id: countryId,
      name: country.name,
      currencyCode: country.currencyCode,
      region: country.region,
    });
    knownCountryIds.add(countryId);
    createdCountries.push(countryId);
  }

  for (const resolution of resolutions) {
    const cityId = resolution.cityId.trim();
    const resolvedCountryId = resolution.countryId?.trim() || slugifyId(normalizeCountryName(resolution.countryName));

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
