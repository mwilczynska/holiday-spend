/**
 * Runtime limits for provider calls: how many output tokens a single call may produce, and how long
 * it may run before being abandoned.
 *
 * Both defaults are deliberately generous. `max_output_tokens` is a cap, not an allocation — tokens
 * are billed as they are generated, so a high cap costs nothing until a run needs it. A
 * cap that binds during normal operation discards tokens already paid for, which is what
 * a 12,000 cap did here on 5 September 2026 when a route needed 12,259.
 *
 * So these are not budgets. They are stops for a request that has gone wrong, set far above the
 * September sample (about 12,300 output tokens and two minutes). GPT-6 Luna at max reached the
 * old five-minute timeout on 1 October 2026, so the default now allows ten minutes. Stop remains
 * available for an active transport batch.
 *
 * Precedence: an explicit per-user setting, then the environment, then these defaults. Null in the
 * database means "follow the default", so raising the default later reaches everyone who has not
 * deliberately chosen their own value.
 */
export const LLM_MAX_OUTPUT_TOKENS_DEFAULT = 64000;
export const LLM_REQUEST_TIMEOUT_MS_DEFAULT = 600000;

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
