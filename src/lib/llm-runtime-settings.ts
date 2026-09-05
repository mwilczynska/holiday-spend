import { db } from '@/db';
import { userPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Runtime limits for provider calls: how many output tokens a single call may produce, and how long
 * it may run before being abandoned.
 *
 * Both defaults are deliberately generous. `max_output_tokens` is a cap, not an allocation — tokens
 * are billed as they are generated, so a high cap costs nothing until a run genuinely needs it. A
 * cap that binds during normal operation is worse than no cap at all: the tokens are paid for and
 * the answer is discarded, which is exactly what a 12,000 cap did here on 5 September 2026 when a
 * route needed 12,259.
 *
 * So these are not budgets. They are stops for a request that has gone wrong, set far above the
 * observed working range (about 12,300 output tokens and two minutes) with room for models that
 * reason harder than today's.
 *
 * Precedence: an explicit per-user setting, then the environment, then these defaults. Null in the
 * database means "follow the default", so raising the default later reaches everyone who has not
 * deliberately chosen their own value.
 */
export const LLM_MAX_OUTPUT_TOKENS_DEFAULT = 64000;
export const LLM_REQUEST_TIMEOUT_MS_DEFAULT = 300000;

export const LLM_MAX_OUTPUT_TOKENS_MIN = 1000;
export const LLM_MAX_OUTPUT_TOKENS_MAX = 400000;
export const LLM_REQUEST_TIMEOUT_MS_MIN = 10000;
export const LLM_REQUEST_TIMEOUT_MS_MAX = 1800000;

export interface LlmRuntimeSettings {
  maxOutputTokens: number;
  requestTimeoutMs: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function fromEnv(name: string, min: number, max: number): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return clamp(parsed, min, max);
}

export function normalizeMaxOutputTokens(value: number) {
  return clamp(value, LLM_MAX_OUTPUT_TOKENS_MIN, LLM_MAX_OUTPUT_TOKENS_MAX);
}

export function normalizeRequestTimeoutMs(value: number) {
  return clamp(value, LLM_REQUEST_TIMEOUT_MS_MIN, LLM_REQUEST_TIMEOUT_MS_MAX);
}

export function resolveLlmRuntimeDefaults(): LlmRuntimeSettings {
  return {
    maxOutputTokens:
      fromEnv('LLM_MAX_OUTPUT_TOKENS', LLM_MAX_OUTPUT_TOKENS_MIN, LLM_MAX_OUTPUT_TOKENS_MAX)
      ?? LLM_MAX_OUTPUT_TOKENS_DEFAULT,
    requestTimeoutMs:
      fromEnv('LLM_REQUEST_TIMEOUT_MS', LLM_REQUEST_TIMEOUT_MS_MIN, LLM_REQUEST_TIMEOUT_MS_MAX)
      ?? LLM_REQUEST_TIMEOUT_MS_DEFAULT,
  };
}

export async function getLlmRuntimeSettings(userId: string): Promise<LlmRuntimeSettings> {
  const defaults = resolveLlmRuntimeDefaults();

  const row = await db
    .select({
      maxOutputTokens: userPreferences.llmMaxOutputTokens,
      requestTimeoutMs: userPreferences.llmRequestTimeoutMs,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .get();

  return {
    maxOutputTokens: row?.maxOutputTokens != null
      ? normalizeMaxOutputTokens(row.maxOutputTokens)
      : defaults.maxOutputTokens,
    requestTimeoutMs: row?.requestTimeoutMs != null
      ? normalizeRequestTimeoutMs(row.requestTimeoutMs)
      : defaults.requestTimeoutMs,
  };
}

/** Passing null for a field clears the override and returns that field to the default. */
export async function setLlmRuntimeSettings(
  userId: string,
  update: { maxOutputTokens?: number | null; requestTimeoutMs?: number | null }
): Promise<LlmRuntimeSettings> {
  const values = {
    ...(update.maxOutputTokens !== undefined
      ? { llmMaxOutputTokens: update.maxOutputTokens === null ? null : normalizeMaxOutputTokens(update.maxOutputTokens) }
      : {}),
    ...(update.requestTimeoutMs !== undefined
      ? { llmRequestTimeoutMs: update.requestTimeoutMs === null ? null : normalizeRequestTimeoutMs(update.requestTimeoutMs) }
      : {}),
  };

  await db
    .insert(userPreferences)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { ...values, updatedAt: new Date().toISOString() },
    });

  return getLlmRuntimeSettings(userId);
}
