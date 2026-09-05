import { error, handleError, success } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';
import {
  LLM_MAX_OUTPUT_TOKENS_MAX,
  LLM_MAX_OUTPUT_TOKENS_MIN,
  LLM_REQUEST_TIMEOUT_MS_MAX,
  LLM_REQUEST_TIMEOUT_MS_MIN,
  getLlmRuntimeSettings,
  resolveLlmRuntimeDefaults,
  setLlmRuntimeSettings,
} from '@/lib/llm-runtime-settings';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/** Null clears an override and returns that field to the configured default. */
const updateSchema = z
  .object({
    maxOutputTokens: z.number().int().min(LLM_MAX_OUTPUT_TOKENS_MIN).max(LLM_MAX_OUTPUT_TOKENS_MAX).nullable(),
    requestTimeoutMs: z.number().int().min(LLM_REQUEST_TIMEOUT_MS_MIN).max(LLM_REQUEST_TIMEOUT_MS_MAX).nullable(),
  })
  .partial()
  .strict();

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    return success({
      ...(await getLlmRuntimeSettings(userId)),
      defaults: resolveLlmRuntimeDefaults(),
      limits: {
        maxOutputTokens: { min: LLM_MAX_OUTPUT_TOKENS_MIN, max: LLM_MAX_OUTPUT_TOKENS_MAX },
        requestTimeoutMs: { min: LLM_REQUEST_TIMEOUT_MS_MIN, max: LLM_REQUEST_TIMEOUT_MS_MAX },
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const data = updateSchema.parse(await request.json());

    if (Object.keys(data).length === 0) {
      return error('No editable provider runtime settings were provided.', 400);
    }

    return success(await setLlmRuntimeSettings(userId, data));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error(err.issues.map((issue) => issue.message).join(', '), 400);
    }
    return handleError(err);
  }
}
