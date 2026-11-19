import {
  CITY_GENERATION_REASONING_EFFORTS,
  getModelReasoningEfforts,
  type CityGenerationProvider,
  type CityGenerationReasoningEffort,
} from '@/lib/city-generation-config';

/**
 * The most output tokens one request to this model may ask for, where the provider documents a hard ceiling. Requests
 * above it are rejected outright, so the configured limit is clamped to it. Undefined means no known ceiling: the
 * configured limit is sent unchanged and the provider decides.
 */
export function getModelMaxOutputTokens(provider: CityGenerationProvider, model: string): number | undefined {
  const id = model.trim().toLowerCase();
  if (provider === 'anthropic') {
    if (/^claude-(?:fable|mythos)-/.test(id)) return 128_000;
    const match = /^claude-(opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/.exec(id);
    if (match) {
      const version = Number(match[2]) + Number(match[3] ?? 0) / 10;
      if (version >= 4.6) return 128_000;
      if (match[1] === 'opus' && version < 4.5) return 32_000;
      return 64_000;
    }
    if (/^claude-3-7-sonnet/.test(id)) return 64_000;
    return undefined;
  }
  if (provider === 'gemini' && /^gemini-(?:2\.5|[3-9]|\d{2,})(?:[.-]|$)/.test(id)) return 65_536;
  return undefined;
}

/** The configured output limit, lowered to the model's documented ceiling when it has one. */
export function clampOutputTokens(provider: CityGenerationProvider, model: string, requested: number) {
  const ceiling = getModelMaxOutputTokens(provider, model);
  return ceiling !== undefined ? Math.min(requested, ceiling) : requested;
}

const LADDER_FLOOR: CityGenerationReasoningEffort = 'high';
const rank = (effort: CityGenerationReasoningEffort) => CITY_GENERATION_REASONING_EFFORTS.indexOf(effort);

/**
 * The effort to retry with after a model ran out of output room: the next lower effort this model accepts, but never
 * below `high`. Running out of room to answer is a reason to think less, not to give up the required search, so every
 * transport retries the same request one rung down instead of failing outright. Undefined means there is no lower rung.
 */
export function nextLowerReasoningEffort(
  provider: CityGenerationProvider,
  model: string,
  effort: CityGenerationReasoningEffort | undefined,
): CityGenerationReasoningEffort | undefined {
  if (!effort || rank(effort) <= rank(LADDER_FLOOR)) return undefined;
  const lower = getModelReasoningEfforts(provider, model)
    .filter((candidate) => rank(candidate) < rank(effort) && rank(candidate) >= rank(LADDER_FLOOR))
    .sort((a, b) => rank(b) - rank(a));
  return lower[0];
}
