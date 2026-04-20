import { z } from 'zod';
import { requireCurrentUserId } from '@/lib/auth';
import { error, handleError, success } from '@/lib/api-helpers';
import { discoverProviderModels } from '@/lib/provider-model-discovery';
import { type CityGenerationProvider } from '@/lib/city-generation-config';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini']),
  refresh: z.enum(['0', '1']).optional(),
});

export async function GET(request: Request) {
  try {
    await requireCurrentUserId();

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      provider: url.searchParams.get('provider'),
      refresh: url.searchParams.get('refresh') ?? undefined,
    });

    if (!parsed.success) {
      return error(parsed.error.issues.map((issue) => issue.message).join(', '), 400);
    }

    const provider = parsed.data.provider as CityGenerationProvider;
    const browserApiKey = request.headers.get('x-provider-api-key') ?? undefined;

    const result = await discoverProviderModels({
      provider,
      browserApiKey,
      forceRefresh: parsed.data.refresh === '1',
    });

    return success(result);
  } catch (err) {
    return handleError(err);
  }
}
