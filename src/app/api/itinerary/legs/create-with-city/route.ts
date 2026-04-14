import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { itineraryLegs } from '@/db/schema';
import { error, success, handleError } from '@/lib/api-helpers';
import { resolveOrCreatePlannerCity, PlannerCityResolutionError } from '@/lib/planner-city-resolution';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  cityName: z.string().min(1),
  countryName: z.string().min(1),
  nights: z.number().int().min(1),
  provider: z.enum(['anthropic', 'openai', 'gemini']).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  referenceDate: z.string().optional(),
  extraContext: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const resolvedCity = await resolveOrCreatePlannerCity({
      cityName: data.cityName,
      countryName: data.countryName,
      provider: data.provider,
      apiKey: data.apiKey,
      model: data.model,
      referenceDate: data.referenceDate,
      extraContext: data.extraContext,
    });

    const maxOrder = await db
      .select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
      .from(itineraryLegs)
      .get();

    const result = await db.insert(itineraryLegs).values({
      cityId: resolvedCity.cityId,
      nights: data.nights,
      accomTier: '2star',
      foodTier: 'mid',
      drinksTier: 'moderate',
      activitiesTier: 'mid',
      intercityTransportCost: 0,
      sortOrder: (maxOrder?.max ?? 0) + 1,
      status: 'planned',
    }).returning();

    return success({
      leg: result[0],
      city: resolvedCity,
    }, 201);
  } catch (err) {
    if (err instanceof PlannerCityResolutionError) {
      return error(err.message, err.status);
    }
    return handleError(err);
  }
}
