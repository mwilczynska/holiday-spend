import { instrumentRoute } from '@/lib/analytics/route';
import { requireLibraryAdmin } from '@/lib/library-auth';
import { withPlanRevision } from '@/lib/analytics/history';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { itineraryLegs } from '@/db/schema';
import { requireCurrentUserId } from '@/lib/auth';
import { getLlmRuntimeSettings } from '@/lib/llm-runtime-settings';
import { error, success, handleError } from '@/lib/api-helpers';
import { deriveLegDates } from '@/lib/itinerary-leg-dates';
import { reserveLegSortOrder } from '@/lib/itinerary-leg-placement';
import { validateLegDates } from '@/lib/itinerary-validation';
import { resolveOrCreatePlannerCity, PlannerCityResolutionError } from '@/lib/planner-city-resolution';
import { CITY_GENERATION_REASONING_EFFORTS } from '@/lib/city-generation-config';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  cityName: z.string().min(1),
  countryName: z.string().min(1),
  nights: z.number().int().min(1),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  provider: z.enum(['anthropic', 'openai', 'gemini']).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  reasoningEffort: z.enum(CITY_GENERATION_REASONING_EFFORTS).optional(),
  referenceDate: z.string().optional(),
  extraContext: z.string().optional(),
});

async function handlePOST(request: Request) {
  try {
    await requireLibraryAdmin();
    const userId = await requireCurrentUserId();
    const body = await request.json();
    const data = createSchema.parse(body);
    // Checked before generation so an invalid date never costs a model call.
    const dateError = validateLegDates(data);
    if (dateError) return error(dateError, 400);

    const resolvedCity = await resolveOrCreatePlannerCity({
      runtimeSettings: await getLlmRuntimeSettings(userId),
      cityName: data.cityName,
      countryName: data.countryName,
      provider: data.provider,
      apiKey: data.apiKey,
      model: data.model,
      reasoningEffort: data.reasoningEffort,
      referenceDate: data.referenceDate,
      extraContext: data.extraContext,
    });

    const leg = withPlanRevision(userId, 'leg_created_with_city', (tx) => {
      // Without dates the new leg follows the last one, as before; with a start date it goes into date order.
      let startDate = data.startDate ?? null;
      let endDate = data.endDate ?? null;
      if (!startDate && !endDate) {
        const existingLegs = tx
          .select()
          .from(itineraryLegs)
          .where(eq(itineraryLegs.userId, userId))
          .orderBy(asc(itineraryLegs.sortOrder), asc(itineraryLegs.id))
          .all();
        const derived = deriveLegDates([...existingLegs, { startDate: null, endDate: null, nights: data.nights }]);
        startDate = derived[existingLegs.length]?.startDate ?? null;
        endDate = derived[existingLegs.length]?.endDate ?? null;
      }
      const sortOrder = reserveLegSortOrder(tx, userId, data.startDate ?? null);
      return tx.insert(itineraryLegs).values({
        userId,
        cityId: resolvedCity.cityId,
        startDate,
        endDate,
        nights: data.nights,
        accomTier: '2star',
        foodTier: 'mid',
        drinksTier: 'moderate',
        activitiesTier: 'mid',
        intercityTransportCost: 0,
        sortOrder,
        status: 'planned',
      }).returning().get();
    });

    return success({
      leg,
      city: resolvedCity,
    }, 201);
  } catch (err) {
    if (err instanceof PlannerCityResolutionError) {
      return error(err.message, err.status);
    }
    return handleError(err);
  }
}

export const POST = instrumentRoute(handlePOST, '/api/itinerary/legs/create-with-city', 'POST');
