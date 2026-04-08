import { db } from '@/db';
import { cities, cityEstimates, countries } from '@/db/schema';
import { CityGenerationError, generateCityCostEstimate } from '@/lib/city-generation';
import { CITY_GENERATION_PROVIDERS } from '@/lib/city-generation-config';
import { error, handleError, success } from '@/lib/api-helpers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const requestSchema = z.object({
  referenceDate: z.string().optional(),
  extraContext: z.string().optional(),
  provider: z.enum(CITY_GENERATION_PROVIDERS).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

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
    drinksLight: source,
    drinksModerate: source,
    drinksHeavy: source,
    activitiesFree: source,
    activitiesBudget: source,
    activitiesMid: source,
    activitiesHigh: source,
  };
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const data = requestSchema.parse(body);

    const city = await db.select().from(cities).where(eq(cities.id, params.id)).get();
    if (!city) return error('City not found', 404);

    const country = await db.select().from(countries).where(eq(countries.id, city.countryId)).get();
    if (!country) return error('Country not found', 404);

    const generated = await generateCityCostEstimate({
      cityName: city.name,
      countryName: country.name,
      referenceDate: data.referenceDate,
      extraContext: data.extraContext,
      provider: data.provider,
      apiKey: data.apiKey,
      model: data.model,
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
        referenceDate: data.referenceDate || null,
        extraContext: data.extraContext || null,
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

    return success({
      provider: generated.provider,
      model: generated.model,
      promptVersion: generated.promptVersion,
      inferredAudPerUsd: generated.inferredAudPerUsd,
      payload: generated.payload,
      estimate: generated.mappedEstimate,
    });
  } catch (err) {
    if (err instanceof CityGenerationError) {
      return error(err.message, err.status);
    }
    return handleError(err);
  }
}
