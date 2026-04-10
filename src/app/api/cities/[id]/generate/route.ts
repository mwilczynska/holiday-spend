import { db } from '@/db';
import { cities } from '@/db/schema';
import { CityGenerationError } from '@/lib/city-generation';
import { CITY_GENERATION_PROVIDERS } from '@/lib/city-generation-config';
import { generateAndPersistCityEstimate } from '@/lib/city-generation-service';
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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const data = requestSchema.parse(body);

    const city = await db.select().from(cities).where(eq(cities.id, params.id)).get();
    if (!city) return error('City not found', 404);
    const generated = await generateAndPersistCityEstimate({
      cityId: city.id,
      referenceDate: data.referenceDate,
      extraContext: data.extraContext,
      provider: data.provider,
      apiKey: data.apiKey,
      model: data.model,
    });

    return success({
      provider: generated.provider,
      model: generated.model,
      promptVersion: generated.promptVersion,
      inferredAudPerUsd: generated.inferredAudPerUsd,
      payload: generated.payload,
      estimate: generated.estimate,
    });
  } catch (err) {
    if (err instanceof CityGenerationError) {
      return error(err.message, err.status);
    }
    return handleError(err);
  }
}
