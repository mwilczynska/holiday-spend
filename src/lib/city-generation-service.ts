import { db } from '@/db';
import { cities, cityEstimates, countries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  CityGenerationError,
  generateCityCostEstimate,
  type GeneratedCityPayload,
  type CityGenerationRequest,
  type V6GeneratedCityPayload,
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

  const isV6 = generated.methodologyVersion === 'v6.0';
  const estimateSource = isV6 ? 'llm_city_generation_v6' : 'llm_city_generation';
  const v6Payload = isV6 ? (generated.payload as V6GeneratedCityPayload) : null;
  const v1Payload = isV6 ? null : (generated.payload as GeneratedCityPayload);
  const v6Materialization = generated.v6Materialization;

  await db
    .update(cityEstimates)
    .set({ isActive: 0 })
    .where(eq(cityEstimates.cityId, city.id));

  const estimatedAt = new Date().toISOString();
  const estimate = await db.insert(cityEstimates).values({
    cityId: city.id,
    estimatedAt,
    source: estimateSource,
    llmProvider: generated.provider,
    llmModel: generated.model,
    promptVersion: generated.promptVersion,
    dataJson: JSON.stringify(generated.mappedEstimate),
    anchorsJson: JSON.stringify(
      isV6 ? generated.v6Collection?.facts ?? generated.v6Materialization?.anchors ?? {} : v1Payload?.anchors_usd ?? {}
    ),
    metadataJson: JSON.stringify({
      region: generated.payload.region,
      confidenceNotes: generated.payload.confidence_notes,
      inferredAudPerUsd: generated.inferredAudPerUsd,
      methodologyVersion: generated.methodologyVersion,
      evidenceGrades: v6Materialization
        ? Object.fromEntries(Object.entries(v6Materialization.tiersAud).map(([tier, value]) => [tier, value.evidenceGrade]))
        : null,
      intervals: v6Materialization
        ? Object.fromEntries(Object.entries(v6Materialization.tiersAud).map(([tier, value]) => [tier, value.interval]))
        : null,
      anchorEvidenceGrades: v6Materialization
        ? Object.fromEntries(Object.entries(v6Materialization.anchors).map(([anchor, value]) => [anchor, value.evidenceGrade]))
        : null,
      anchorIntervals: v6Materialization
        ? Object.fromEntries(
            Object.entries(v6Materialization.anchors).map(([anchor, value]) => [
              anchor,
              value.valueAud === null || value.valueAud === undefined
                ? null
                : {
                    lowerAud: Math.max(0, value.valueAud * (1 - (value.intervalPct ?? 45) / 100)),
                    upperAud: value.valueAud * (1 + (value.intervalPct ?? 45) / 100),
                    widthPct: value.intervalPct ?? 45,
                  },
            ])
          )
        : null,
      v6CollectionTelemetry: generated.v6Collection?.telemetry ?? null,
      v6Missingness: v6Materialization?.missingness ?? null,
      v6PriorBasis: v6Materialization?.priorBasis ?? null,
      referenceDate: referenceDate || null,
      extraContext: extraContext || null,
    }),
    reasoning: generated.payload.confidence_notes,
    confidence: generated.payload.confidence,
    sourcesJson: JSON.stringify(
      isV6
        ? Object.fromEntries((generated.v6Collection?.telemetry ?? []).map((call) => [call.source, call.promptVersion]))
        : buildSourceMap()
    ),
    inputSnapshotJson: JSON.stringify(
      isV6 ? generated.v6Materialization?.anchors ?? {} : v1Payload?.anchors_usd ?? {}
    ),
    fallbackLogJson: JSON.stringify(isV6 ? generated.v6Collection?.telemetry ?? [] : []),
    isActive: 1,
  }).returning();

  await db.update(cities).set({
    ...generated.mappedEstimate,
    estimationSource: estimateSource,
    estimatedAt,
    estimationId: estimate[0]?.id,
    notes: generated.payload.confidence_notes,
  }).where(eq(cities.id, city.id));

  return {
    provider: generated.provider,
    model: generated.model,
    promptVersion: generated.promptVersion,
    inferredAudPerUsd: generated.inferredAudPerUsd,
    methodologyVersion: generated.methodologyVersion,
    payload: generated.payload,
    estimate: generated.mappedEstimate,
    evidenceGrades: v6Payload?.evidence_grades ?? null,
    intervals: v6Payload?.intervals ?? null,
    collectionTelemetry: generated.v6Collection?.telemetry ?? null,
  };
}
