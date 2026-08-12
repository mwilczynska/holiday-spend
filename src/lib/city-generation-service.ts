import { db } from '@/db';
import { cities, cityEstimates, countries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  CityGenerationError,
  generateCityCostEstimate,
  type CityGenerationRequest,
} from '@/lib/city-generation';
import { buildCityEstimatePersistence } from '@/lib/city-generation-persistence';

export interface GenerateAndPersistCityEstimateInput extends Pick<
  CityGenerationRequest,
  'referenceDate' | 'extraContext' | 'provider' | 'apiKey' | 'model' | 'region'
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
    region: country.region,
  });

  const persisted = buildCityEstimatePersistence(generated, { referenceDate, extraContext });

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
    ...generated.mappedEstimate,
    estimationSource: persisted.estimateSource,
    estimatedAt,
    estimationId: estimate[0]?.id,
    notes: generated.payload.confidence_notes,
  }).where(eq(cities.id, city.id));

  return {
    provider: generated.provider,
    model: generated.model,
    promptVersion: generated.promptVersion,
    inferredAudPerUsd: generated.inferredAudPerUsd,
    payload: generated.payload,
    estimate: generated.mappedEstimate,
    ...persisted.apiSummary,
  };
}
