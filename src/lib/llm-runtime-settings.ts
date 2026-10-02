import { db } from '@/db';
import { userPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';

import { normalizeMaxOutputTokens, normalizeRequestTimeoutMs, resolveLlmRuntimeDefaults, type LlmRuntimeSettings } from '@/lib/llm-request-limits';
export * from '@/lib/llm-request-limits';

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
