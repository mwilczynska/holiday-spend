import { db } from '@/db';
import { fixedCosts, countries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getPlannerGroupSize } from './planner-settings';
import {
  getLlmRuntimeSettings, resolveLlmRuntimeDefaults, LLM_MAX_OUTPUT_TOKENS_MIN, LLM_MAX_OUTPUT_TOKENS_MAX,
  LLM_REQUEST_TIMEOUT_MS_MIN, LLM_REQUEST_TIMEOUT_MS_MAX,
} from './llm-runtime-settings';

export async function loadSettingsData(userId: string) {
  const [costs, countryRows, groupSize, llmSettings] = await Promise.all([
    db.select().from(fixedCosts).where(eq(fixedCosts.userId, userId)),
    db.select({ id: countries.id, name: countries.name }).from(countries),
    getPlannerGroupSize(userId), getLlmRuntimeSettings(userId),
  ]);
  return {
    costs, countries: countryRows.sort((a,b) => a.name.localeCompare(b.name)), groupSize,
    llm: { ...llmSettings, defaults: resolveLlmRuntimeDefaults(), limits: {
      maxOutputTokens: { min: LLM_MAX_OUTPUT_TOKENS_MIN, max: LLM_MAX_OUTPUT_TOKENS_MAX },
      requestTimeoutMs: { min: LLM_REQUEST_TIMEOUT_MS_MIN, max: LLM_REQUEST_TIMEOUT_MS_MAX },
    } },
  };
}
