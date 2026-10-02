import { db } from '@/db';
import { cities, cityEstimates, countries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ensureCityClimate } from '@/lib/city-climate-service';
import {
  CityGenerationError,
  generateCityCostEstimate,
  type CityGenerationRequest,
} from '@/lib/city-generation';
import { buildCityEstimatePersistence } from '@/lib/city-generation-persistence';
import { resolveCountryCreationDefaults } from '@/lib/country-metadata';

export type CityClimateStatus = 'ready' | 'stale' | 'unavailable';

export interface GenerateAndPersistCityEstimateInput extends Pick<
  CityGenerationRequest,
  'referenceDate' | 'extraContext' | 'provider' | 'apiKey' | 'model' | 'reasoningEffort' | 'runtimeSettings'
> {
  cityId: string;
}

export async function generateAndPersistCityEstimate({
  cityId,
  referenceDate,
  extraContext,
  provider,
  apiKey,
  model,
  reasoningEffort,
  runtimeSettings,
}: GenerateAndPersistCityEstimateInput) {
  const city = await db.select().from(cities).where(eq(cities.id, cityId)).get();
  if (!city) throw new CityGenerationError('City not found', 404);

  const country = await db.select().from(countries).where(eq(countries.id, city.countryId)).get();
  if (!country) throw new CityGenerationError('Country not found', 404);

  const generated = await generateCityCostEstimate({
    cityName: city.name,
    countryName: country.name,
    referenceDate,
    extraContext,
    provider,
    apiKey,
    model,
    reasoningEffort,
    runtimeSettings,
  });
  const persisted = buildCityEstimatePersistence(generated, {
    cityName: city.name,
    countryName: country.name,
    referenceDate,
    extraContext,
  });

  await db
    .update(cityEstimates)
    .set({ isActive: 0 })
    .where(eq(cityEstimates.cityId, city.id));

  const estimatedAt = new Date().toISOString();
  const estimate = await db.insert(cityEstimates).values({
    cityId: city.id,
    estimatedAt,
    source: persisted.estimateSource,
    llmProvider: generated.provider,
    llmModel: generated.model,
    promptVersion: generated.promptVersion,
    dataJson: JSON.stringify(persisted.data),
    anchorsJson: JSON.stringify(persisted.anchors),
    metadataJson: JSON.stringify(persisted.metadata),
    reasoning: persisted.reasoning,
    confidence: persisted.confidence,
    sourcesJson: JSON.stringify(persisted.sources),
    inputSnapshotJson: JSON.stringify(persisted.inputSnapshot),
    fallbackLogJson: JSON.stringify(persisted.fallbackLog),
    isActive: 1,
  }).returning();

  await db.update(cities).set({
    ...persisted.data,
    estimationSource: persisted.estimateSource,
    estimatedAt,
    estimationId: estimate[0]?.id,
    notes: persisted.reasoning,
  }).where(eq(cities.id, city.id));

  let climateStatus: CityClimateStatus = 'unavailable';
  try {
    const canonicalCountry = resolveCountryCreationDefaults({
      id: country.id,
      name: country.name,
    });
    if (!canonicalCountry) {
      console.warn('[city-climate] No canonical country metadata for ' + city.id + '; climate is unavailable.');
    } else {
      const climate = await ensureCityClimate(
        city.id,
        city.name,
        canonicalCountry.canonical.iso2,
        { refresh: true }
      );
      climateStatus = climate
        ? climate.refreshFailedAt ? 'stale' : 'ready'
        : 'unavailable';
      if (!climate) {
        console.warn('[city-climate] Climate refresh returned no data for ' + city.id + '.');
      } else if (climate.refreshFailedAt) {
        console.warn('[city-climate] Climate refresh failed for ' + city.id + '; keeping the previous result.');
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown climate error.';
    console.warn('[city-climate] Climate refresh failed for ' + city.id + ': ' + message);
  }

  return {
    provider: generated.provider,
    model: generated.model,
    promptVersion: generated.promptVersion,
    methodologyVersion: generated.methodologyVersion,
    reasoningEffort: generated.reasoningEffort,
    inferredAudPerUsd: generated.inferredAudPerUsd,
    payload: generated.payload,
    estimate: persisted.data,
    anchors: persisted.apiSummary.anchors,
    inputSnapshot: persisted.apiSummary.inputSnapshot,
    sources: persisted.apiSummary.sources,
    evidenceBasis: persisted.apiSummary.evidenceBasis,
    formulaVersion: persisted.apiSummary.formulaVersion,
    fx: persisted.apiSummary.fx,
    anchorsAud: generated.v11Materialization?.anchorsAud,
    tiersAud: generated.v11Materialization?.tiersAud,
    climateStatus,
  };
}
