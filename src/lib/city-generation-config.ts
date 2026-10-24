import curatedModelsSnapshot from '@/lib/data/curated-models.generated.json';
import reasoningEffortsSnapshot from '@/lib/data/model-reasoning-efforts.generated.json';
import {
  LLM_PROVIDER_IDS,
  LLM_PROVIDER_SPECS,
  providerSupportsWebSearch,
  type LlmProviderId,
} from '@/lib/llm-provider-registry';

export const CITY_GENERATION_PROVIDERS = LLM_PROVIDER_IDS;

export type CityGenerationProvider = LlmProviderId;

export const CITY_GENERATION_REASONING_EFFORTS = ['none', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

export type CityGenerationReasoningEffort = (typeof CITY_GENERATION_REASONING_EFFORTS)[number];

const ALL_EFFORTS = [...CITY_GENERATION_REASONING_EFFORTS];
const LOW_TO_MAX = ALL_EFFORTS.filter((effort) => effort !== 'none');
const LOW_TO_HIGH: CityGenerationReasoningEffort[] = ['low', 'medium', 'high'];

function mapProviderIds<T>(build: (provider: CityGenerationProvider) => T): Record<CityGenerationProvider, T> {
  return Object.fromEntries(LLM_PROVIDER_IDS.map((provider) => [provider, build(provider)])) as Record<CityGenerationProvider, T>;
}

export interface ModelReasoningEffortsSnapshot {
  schemaVersion: number;
  generatedAt: string;
  source: string;
  providers: Partial<Record<CityGenerationProvider, Record<string, string[]>>>;
}

const REASONING_EFFORTS_SNAPSHOT = reasoningEffortsSnapshot as ModelReasoningEffortsSnapshot;

function sortEfforts(efforts: readonly string[]) {
  return ALL_EFFORTS.filter((effort) => efforts.includes(effort));
}

/** Claude 4.6 and later (and Fable/Mythos) take adaptive thinking plus `output_config.effort`; older models take a token budget. */
export function getAnthropicThinkingMode(model: string): 'adaptive' | 'budget' {
  const match = /^claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d{1,2})(?!\d))?/.exec(model.trim().toLowerCase());
  if (!match) return 'budget';
  if (match[1] === 'fable' || match[1] === 'mythos') return 'adaptive';
  const version = Number(match[2]) + Number(match[3] ?? 0) / 10;
  return version >= 4.6 ? 'adaptive' : 'budget';
}

/** The dynamic-filtering web search tool needs Opus or Sonnet 4.6 or later; other models keep the basic tool. */
export function getAnthropicWebSearchToolType(model: string) {
  const match = /^claude-(opus|sonnet)-(\d+)(?:-(\d{1,2})(?!\d))?/.exec(model.trim().toLowerCase());
  if (!match) return 'web_search_20250305';
  const version = Number(match[2]) + Number(match[3] ?? 0) / 10;
  return version >= 4.6 ? 'web_search_20260209' : 'web_search_20250305';
}

/** Gemini 3 and later are configured with `thinkingLevel`; Gemini 2.5 with `thinkingBudget`. */
export function geminiUsesThinkingLevel(model: string) {
  return /^gemini-(?:[3-9]|\d{2,})(?:[.-]|$)/.test(model.trim().toLowerCase());
}

function snapshotEfforts(provider: CityGenerationProvider, model: string) {
  const table = REASONING_EFFORTS_SNAPSHOT.providers[provider];
  if (!table) return null;
  // OpenRouter variants such as `:free` share their base model's reasoning options.
  const key = provider === 'openrouter' ? model.split(':')[0]! : model;
  const match = Object.keys(table).find((candidate) => candidate.toLowerCase() === key);
  return match ? sortEfforts(table[match]!) : null;
}

/** Family rules for models the generated snapshot does not list (new releases, provider-only IDs). */
function familyEfforts(provider: CityGenerationProvider, model: string): CityGenerationReasoningEffort[] {
  switch (provider) {
    case 'openai':
      if (/^gpt-6-(?:sol|luna)(?:-|$)/.test(model) || /^gpt-5\.6(?:-|$)/.test(model)) return ALL_EFFORTS;
      // GPT-6.1 Sol, GPT-6 Astra and later always reason: none is rejected.
      if (/^gpt-(?:6|[7-9])(?:[.-]|$)/.test(model)) return LOW_TO_MAX;
      if (/^gpt-5\.[1-5](?:-|$)/.test(model)) return ['none', 'low', 'medium', 'high', 'xhigh'];
      if (/^(?:gpt-5(?:-mini|-nano)?$|o1(?:-|$)|o3(?:-|$)|o4(?:-|$))/.test(model)) return LOW_TO_HIGH;
      return [];
    case 'anthropic': {
      if (getAnthropicThinkingMode(model) === 'budget') {
        return /^claude-(?:3-7-|(?:opus|sonnet|haiku)-4)/.test(model) ? ['none', ...LOW_TO_HIGH] : [];
      }
      const match = /^claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d{1,2})(?!\d))?/.exec(model)!;
      const version = Number(match[2]) + Number(match[3] ?? 0) / 10;
      if (match[1] === 'fable' || match[1] === 'mythos' || (version >= 5.5 && match[1] !== 'haiku')) return LOW_TO_MAX;
      if (version >= 4.7) return ALL_EFFORTS;
      return ['none', 'low', 'medium', 'high', 'max'];
    }
    case 'gemini':
      if (/^gemini-3-pro/.test(model)) return ['low', 'high'];
      if (geminiUsesThinkingLevel(model)) return LOW_TO_HIGH;
      if (/^gemini-2\.5-pro/.test(model)) return LOW_TO_HIGH;
      if (/^gemini-2\.5(?:-|$)/.test(model)) return ['none', ...LOW_TO_HIGH];
      return [];
    case 'xai':
      if (/^grok-4\.5(?:-|$)/.test(model)) return LOW_TO_HIGH;
      if (/^grok-(?:4\.(?:[6-9]|\d{2,})|[5-9])(?:[.-]|$)/.test(model)) return ['low', 'medium', 'high', 'xhigh'];
      return [];
    case 'groq':
    case 'together':
    case 'fireworks':
    case 'cerebras':
      return /gpt-oss/.test(model) ? LOW_TO_HIGH : [];
    case 'deepseek':
      // `deepseek-flash` is the current alias for the V4.1 Flash model listed by OpenRouter.
      return /^deepseek-(?:flash|v4)(?:[.-]|$)/.test(model) ? ['none', 'low', 'high', 'max'] : [];
    default:
      return [];
  }
}

/** Remove efforts the provider's request format cannot express for this model. */
function expressibleEfforts(provider: CityGenerationProvider, model: string, efforts: CityGenerationReasoningEffort[]) {
  const spec = LLM_PROVIDER_SPECS[provider];
  if (!spec.effortParam) return [];
  if (provider === 'gemini') {
    return geminiUsesThinkingLevel(model)
      ? efforts.filter((effort) => LOW_TO_HIGH.includes(effort))
      : efforts.filter((effort) => effort === 'none' || LOW_TO_HIGH.includes(effort));
  }
  if (provider === 'anthropic' && getAnthropicThinkingMode(model) === 'budget') {
    return efforts.filter((effort) => effort === 'none' || LOW_TO_HIGH.includes(effort));
  }
  if (provider === 'xai') return efforts.filter((effort) => effort !== 'none');
  if (spec.effortParam === 'reasoning_effort') return efforts.filter((effort) => LOW_TO_HIGH.includes(effort));
  return efforts;
}

/**
 * The reasoning efforts this provider and model accept, from the generated OpenRouter snapshot
 * (`npm run models:refresh`) or, for models it does not list, family rules taken from provider
 * documentation. An empty list means the model exposes no configurable effort through this app.
 */
export function getModelReasoningEfforts(provider: CityGenerationProvider, model?: string): CityGenerationReasoningEffort[] {
  const normalized = model?.trim().toLowerCase() ?? '';
  const efforts = snapshotEfforts(provider, normalized) ?? familyEfforts(provider, normalized);
  return expressibleEfforts(provider, normalized, efforts);
}

/**
 * Effort options for the picker. A model without configurable effort shows the single disabled
 * "None" option.
 */
export function getSupportedCityGenerationReasoningEfforts(
  provider: CityGenerationProvider,
  model?: string,
): CityGenerationReasoningEffort[] {
  const efforts = getModelReasoningEfforts(provider, model);
  return efforts.length > 0 ? efforts : ['none'];
}

/** The saved effort when the model accepts it, otherwise the default (maximum), otherwise the model's highest. */
export function resolveCityGenerationReasoningEffort(
  provider: CityGenerationProvider,
  model: string | undefined,
  requested: CityGenerationReasoningEffort,
): CityGenerationReasoningEffort {
  const supported = getSupportedCityGenerationReasoningEfforts(provider, model);
  if (supported.includes(requested)) return requested;
  if (supported.includes(CITY_GENERATION_DEFAULT_REASONING_EFFORT)) return CITY_GENERATION_DEFAULT_REASONING_EFFORT;
  return supported[supported.length - 1]!;
}

/** Server side: the effort to send, or undefined when the model would reject or ignore it. */
export function resolveProviderRequestEffort(
  provider: CityGenerationProvider,
  model: string,
  requested?: CityGenerationReasoningEffort,
): CityGenerationReasoningEffort | undefined {
  if (!requested) return undefined;
  return getModelReasoningEfforts(provider, model).includes(requested) ? requested : undefined;
}

export const CITY_GENERATION_REASONING_EFFORT_LABELS: Record<CityGenerationReasoningEffort, string> = {
  none: 'None (fastest)',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Maximum',
};

export function getCityGenerationThinkingBudget(effort?: CityGenerationReasoningEffort) {
  if (!effort || effort === 'none') return 0;
  return {
    low: 1024,
    medium: 4096,
    high: 8192,
    xhigh: 16384,
    max: 32768,
  }[effort];
}

export interface CuratedModelsSnapshot {
  schemaVersion: number;
  generatedAt: string;
  sources: Partial<Record<CityGenerationProvider, string>>;
  providers: Partial<Record<CityGenerationProvider, string[]>>;
  /** Cheap, fast defaults chosen by the refresh (see model-default-selection.ts). */
  defaults?: Partial<Record<CityGenerationProvider, string>>;
  /** Earlier defaults a refresh replaced; saved selections of them migrate to the current default. */
  retiredDefaults?: Partial<Record<CityGenerationProvider, string[]>>;
}

export const CITY_GENERATION_CURATED_SNAPSHOT = curatedModelsSnapshot as CuratedModelsSnapshot;

export const CITY_GENERATION_DEFAULT_MODELS: Record<CityGenerationProvider, string> = mapProviderIds(
  (provider) => CITY_GENERATION_CURATED_SNAPSHOT.defaults?.[provider] ?? LLM_PROVIDER_SPECS[provider].defaultModel,
);

export const CITY_GENERATION_DEFAULT_REASONING_EFFORT: CityGenerationReasoningEffort = 'max';

const HISTORICAL_DEFAULT_MODELS: Partial<Record<CityGenerationProvider, string[]>> = {
  openai: ['gpt-4o', 'gpt-5-mini', 'gpt-5.4-mini', 'gpt-5.6-luna'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-sonnet-4-6'],
  gemini: ['gemini-2.0-flash', 'gemini-2.5-flash'],
};

export const CITY_GENERATION_LEGACY_DEFAULT_MODEL_MIGRATIONS: Partial<Record<CityGenerationProvider, string[]>> = mapProviderIds(
  (provider) => [
    ...(HISTORICAL_DEFAULT_MODELS[provider] ?? []),
    ...(CITY_GENERATION_CURATED_SNAPSHOT.retiredDefaults?.[provider] ?? []),
  ].filter((model) => model !== CITY_GENERATION_DEFAULT_MODELS[provider]),
);

export const CITY_GENERATION_KNOWN_MODELS: Record<CityGenerationProvider, string[]> = mapProviderIds(
  (provider) => CITY_GENERATION_CURATED_SNAPSHOT.providers[provider] ?? [],
);

export interface CityGenerationProviderOption {
  value: CityGenerationProvider;
  label: string;
  help: string;
  defaultModel: string;
  knownModels: string[];
  /** Whether the provider has a server-side web search, which city generation requires. */
  webSearch: boolean;
}

export const CITY_GENERATION_PROVIDER_OPTIONS: CityGenerationProviderOption[] = LLM_PROVIDER_IDS.map((provider) => {
  const spec = LLM_PROVIDER_SPECS[provider];
  const searchNote = spec.webSearch
    ? spec.webSearch === 'groq-browser-search'
      ? ' Web search is available on its openai/gpt-oss models only.'
      : ''
    : ' No server-side web search: it cannot generate cities, and transport estimates are ungrounded.';
  return {
    value: provider,
    label: spec.label,
    help: `Uses your ${spec.label} API key or the server ${spec.envKey}.${searchNote}`,
    defaultModel: spec.defaultModel,
    knownModels: CITY_GENERATION_KNOWN_MODELS[provider],
    webSearch: Boolean(spec.webSearch),
  };
});

/** City generation requires a live web lookup, so its pickers list only providers that can search. */
export const CITY_GENERATION_SEARCH_PROVIDER_OPTIONS = CITY_GENERATION_PROVIDER_OPTIONS.filter((option) => option.webSearch);

export { providerSupportsWebSearch };

export function getDefaultCityGenerationModels(): Record<CityGenerationProvider, string> {
  return { ...CITY_GENERATION_DEFAULT_MODELS };
}

export function migrateStoredCityGenerationModels(
  parsed: Partial<Record<CityGenerationProvider, string>>
): Record<CityGenerationProvider, string> {
  return mapProviderIds((provider) => {
    const stored = parsed[provider];
    return stored && !(CITY_GENERATION_LEGACY_DEFAULT_MODEL_MIGRATIONS[provider] ?? []).includes(stored)
      ? stored
      : CITY_GENERATION_DEFAULT_MODELS[provider];
  });
}

export function validateCityGenerationModel(
  provider: CityGenerationProvider,
  model?: string,
  availableModels = CITY_GENERATION_KNOWN_MODELS[provider],
) {
  const inputModel = model?.trim() || '';
  const defaultModel = CITY_GENERATION_DEFAULT_MODELS[provider];
  const knownModels = availableModels;
  const canonicalKnownModel = knownModels.find(
    (knownModel) => knownModel.toLowerCase() === inputModel.toLowerCase()
  );

  if (!inputModel) {
    return {
      effectiveModel: defaultModel,
      defaultModel,
      knownModels,
      isKnownModel: true,
      usesDefaultModel: true,
      message: `Using the default model for ${provider}: ${defaultModel}.`,
      tone: 'default' as const,
    };
  }

  if (canonicalKnownModel) {
    return {
      effectiveModel: canonicalKnownModel,
      defaultModel,
      knownModels,
      isKnownModel: true,
      usesDefaultModel: canonicalKnownModel === defaultModel,
      message:
        canonicalKnownModel === defaultModel
          ? `Recommended default model for ${provider}: ${canonicalKnownModel}.`
          : `Known model for ${provider}: ${canonicalKnownModel}.`,
      tone: 'default' as const,
    };
  }

  return {
    effectiveModel: inputModel,
    defaultModel,
    knownModels,
    isKnownModel: false,
    usesDefaultModel: false,
    message: `This saved model is not in the current list for ${provider}. Choose a listed model or refresh models.`,
    tone: 'warning' as const,
  };
}
