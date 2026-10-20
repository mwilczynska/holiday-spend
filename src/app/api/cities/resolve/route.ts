import { instrumentRoute } from '@/lib/analytics/route';
import { requireLibraryAdmin } from '@/lib/library-auth';
import { success, handleError } from '@/lib/api-helpers';
import { resolveMissingCities } from '@/lib/resolve-missing-cities';
import {
  missingCityResolutionSchema,
  snapshotGenerationConfigSchema,
} from '@/lib/snapshot-import';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  missingCityResolutions: z.array(missingCityResolutionSchema).min(1),
  missingCityStrategy: z.enum(['placeholder', 'generate']).default('placeholder'),
  generationConfig: snapshotGenerationConfigSchema.optional(),
});

async function handlePOST(request: Request) {
  try {
    await requireLibraryAdmin();
    const body = await request.json();
    const data = createSchema.parse(body);

    const result = await resolveMissingCities({
      resolutions: data.missingCityResolutions,
      missingCityStrategy: data.missingCityStrategy,
      generationConfig: data.generationConfig,
    });

    return success({
      createdCountries: result.createdCountries,
      createdCities: result.createdCities,
      generatedCities: result.generatedCities,
    });
  } catch (err) {
    return handleError(err);
  }
}

export const POST = instrumentRoute(handlePOST, '/api/cities/resolve', 'POST');
