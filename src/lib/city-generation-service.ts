import { db } from '@/db';
import { cities, cityEstimates, countries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  CityGenerationError,
  generateCityCostEstimate,
  type CityGenerationRequest,
} from '@/lib/city-generation';

function buildSourceMap() {
  const source = 'llm_city_generation';
  return {
    accomHostel: source,
    accomPrivateRoom: source,
    accom1star: source,
    accom2star: source,
    accom3star: source,
    accom4star: source,
    foodStreet: source,
    foodBudget: source,
    foodMid: source,
    foodHigh: source,
    drinksNone: source,
    drinksLight: source,
    drinksModerate: source,
    drinksHeavy: source,
    activitiesFree: source,
    activitiesBudget: source,
    activitiesMid: source,
    activitiesHigh: source,
  };
}

export interface GenerateAndPersistCityEstimateInput extends Pick<
  CityGenerationRequest,
  'referenceDate' | 'extraContext' | 'provider' | 'apiKey' | 'model'
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
  });

  await db
    .update(cityEstimates)
    .set({ isActive: 0 })
    .where(eq(cityEstimates.cityId, city.id));

  const estimatedAt = new Date().toISOString();
  const estimate = await db.insert(cityEstimates).values({
    cityId: city.id,
    estimatedAt,
    source: 'llm_city_generation',
    llmProvider: generated.provider,
    llmModel: generated.model,
    promptVersion: generated.promptVersion,
    dataJson: JSON.stringify(generated.mappedEstimate),
    anchorsJson: JSON.stringify(generated.payload.anchors_usd),
    metadataJson: JSON.stringify({
      region: generated.payload.region,
      confidenceNotes: generated.payload.confidence_notes,
      inferredAudPerUsd: generated.inferredAudPerUsd,
      referenceDate: referenceDate || null,
      extraContext: extraContext || null,
    }),
    reasoning: generated.payload.confidence_notes,
    confidence: generated.payload.confidence,
    sourcesJson: JSON.stringify(buildSourceMap()),
    inputSnapshotJson: JSON.stringify(generated.payload.anchors_usd),
    fallbackLogJson: JSON.stringify([]),
    isActive: 1,
  }).returning();

  await db.update(cities).set({
    ...generated.mappedEstimate,
    estimationSource: 'llm_city_generation',
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
  };
}
