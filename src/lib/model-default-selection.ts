import type { LlmProviderId } from '@/lib/llm-provider-registry';

/**
 * Each provider's default is its cheap, fast model family, re-chosen by `npm run models:refresh` from
 * models.dev release dates and prices, so a new Haiku, Luna or Flash-Lite becomes the default without
 * a code change. `newest` takes the latest release in the family; `cheapest` takes the lowest price
 * and breaks ties by release date, for families whose newest member is a dearer tier.
 */
export interface DefaultModelRule {
  pattern: RegExp;
  prefer: 'newest' | 'cheapest';
}

export const DEFAULT_MODEL_RULES: Partial<Record<LlmProviderId, DefaultModelRule>> = {
  openai: { pattern: /^gpt-\d+(?:\.\d+)?-luna$/, prefer: 'newest' },
  anthropic: { pattern: /^claude-haiku-\d+-\d+$/, prefer: 'newest' },
  gemini: { pattern: /^gemini-\d+(?:\.\d+)?-flash-lite$/, prefer: 'newest' },
  xai: { pattern: /^grok-\d+(?:\.\d+)?$/, prefer: 'cheapest' },
  // Groq's web search runs only on its gpt-oss models.
  groq: { pattern: /^openai\/gpt-oss-\d+b$/, prefer: 'cheapest' },
  perplexity: { pattern: /^sonar$/, prefer: 'newest' },
  mistral: { pattern: /^mistral-small-\d{4}$/, prefer: 'newest' },
  zai: { pattern: /^glm-\d+(?:\.\d+)?-flash$/, prefer: 'newest' },
  deepseek: { pattern: /^deepseek-flash$/, prefer: 'newest' },
  together: { pattern: /^deepseek-ai\/DeepSeek-V[\d.]+-Flash$/, prefer: 'newest' },
  fireworks: { pattern: /^accounts\/fireworks\/models\/deepseek-v\d+(?:p\d+)?-flash$/, prefer: 'newest' },
  cerebras: { pattern: /^gpt-oss-\d+b$/, prefer: 'cheapest' },
};

export interface ModelCatalogueEntry {
  id: string;
  releaseDate: string | null;
  inputCost: number | null;
  outputCost: number | null;
}

/** Reads one provider's block of models.dev `api.json` into catalogue entries. */
export function readModelsDevCatalogue(payload: unknown, providerKey: string): ModelCatalogueEntry[] {
  const models = (payload as Record<string, { models?: Record<string, unknown> }>)?.[providerKey]?.models;
  if (!models || typeof models !== 'object') return [];
  return Object.entries(models).map(([key, value]) => {
    const row = (value ?? {}) as { id?: unknown; release_date?: unknown; cost?: { input?: unknown; output?: unknown } };
    const number = (input: unknown) => (typeof input === 'number' && Number.isFinite(input) ? input : null);
    return {
      id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : key,
      releaseDate: typeof row.release_date === 'string' ? row.release_date : null,
      inputCost: number(row.cost?.input),
      outputCost: number(row.cost?.output),
    };
  });
}

/** The default for one provider, or null when nothing in the catalogue matches its rule. */
export function chooseDefaultModel(rule: DefaultModelRule, catalogue: ModelCatalogueEntry[]): string | null {
  const candidates = catalogue.filter((entry) => rule.pattern.test(entry.id) && entry.releaseDate);
  if (candidates.length === 0) return null;
  const price = (entry: ModelCatalogueEntry) =>
    entry.inputCost == null || entry.outputCost == null ? Number.POSITIVE_INFINITY : entry.inputCost + entry.outputCost;
  const newer = (left: ModelCatalogueEntry, right: ModelCatalogueEntry) => right.releaseDate!.localeCompare(left.releaseDate!);
  const sorted = [...candidates].sort((left, right) =>
    rule.prefer === 'newest'
      ? newer(left, right) || price(left) - price(right) || left.id.localeCompare(right.id)
      : price(left) - price(right) || newer(left, right) || left.id.localeCompare(right.id)
  );
  return sorted[0]!.id;
}

/**
 * Carries forward the defaults that a refresh replaced, so a browser that saved the previous default
 * moves to the new one instead of staying pinned to an older model.
 */
export function mergeRetiredDefaults(
  previousDefaults: Partial<Record<LlmProviderId, string>>,
  nextDefaults: Partial<Record<LlmProviderId, string>>,
  previousRetired: Partial<Record<LlmProviderId, string[]>>,
) {
  const retired: Partial<Record<LlmProviderId, string[]>> = {};
  const providers = new Set([...Object.keys(previousRetired), ...Object.keys(previousDefaults)]) as Set<LlmProviderId>;
  for (const provider of providers) {
    const list = [...(previousRetired[provider] ?? [])];
    const previous = previousDefaults[provider];
    if (previous && previous !== nextDefaults[provider] && !list.includes(previous)) list.push(previous);
    const next = nextDefaults[provider];
    const kept = list.filter((model) => model !== next);
    if (kept.length > 0) retired[provider] = kept;
  }
  return retired;
}
