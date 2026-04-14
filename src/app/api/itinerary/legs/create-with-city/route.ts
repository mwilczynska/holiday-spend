import { asc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { itineraryLegs } from '@/db/schema';
import { error, success, handleError } from '@/lib/api-helpers';
import { deriveLegDates } from '@/lib/itinerary-leg-dates';
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
    const nextSortOrder = (maxOrder?.max ?? 0) + 1;
    const existingLegs = await db.select().from(itineraryLegs).orderBy(asc(itineraryLegs.sortOrder), asc(itineraryLegs.id));
    const derivedNewLeg = deriveLegDates([
      ...existingLegs,
      {
        id: -1,
        cityId: resolvedCity.cityId,
        startDate: null,
        endDate: null,
        nights: data.nights,
        sortOrder: nextSortOrder,
        accomTier: '2star',
        foodTier: 'mid',
        drinksTier: 'moderate',
        activitiesTier: 'mid',
        accomOverride: null,
        foodOverride: null,
        drinksOverride: null,
        activitiesOverride: null,
        transportOverride: null,
        intercityTransportCost: 0,
        intercityTransportNote: null,
        notes: null,
        status: 'planned',
      },
    ])[existingLegs.length];

    const result = await db.insert(itineraryLegs).values({
      cityId: resolvedCity.cityId,
      startDate: derivedNewLeg?.startDate ?? null,
      endDate: derivedNewLeg?.endDate ?? null,
      nights: data.nights,
      accomTier: '2star',
      foodTier: 'mid',
      drinksTier: 'moderate',
      activitiesTier: 'mid',
      intercityTransportCost: 0,
      sortOrder: nextSortOrder,
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
