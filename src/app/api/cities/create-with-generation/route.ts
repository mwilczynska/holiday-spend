import { z } from 'zod';
import { requireCurrentUserId } from '@/lib/auth';
import { CITY_GENERATION_PROVIDERS } from '@/lib/city-generation-config';
import { error, handleError, success } from '@/lib/api-helpers';
import {
  PlannerCityResolutionError,
  resolveOrCreatePlannerCity,
} from '@/lib/planner-city-resolution';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  cityName: z.string().min(1),
  countryName: z.string().min(1),
  provider: z.enum(CITY_GENERATION_PROVIDERS).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  referenceDate: z.string().optional(),
  extraContext: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await requireCurrentUserId();
    const data = createSchema.parse(await request.json());
    const city = await resolveOrCreatePlannerCity(data);

    return success({ city }, city.createdCity ? 201 : 200);
  } catch (err) {
    if (err instanceof PlannerCityResolutionError) {
      return error(err.message, err.status);
    }
    return handleError(err);
  }
}
