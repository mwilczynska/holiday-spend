import curatedModelsSnapshot from '@/lib/data/curated-models.generated.json';

export const CITY_GENERATION_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;

export type CityGenerationProvider = (typeof CITY_GENERATION_PROVIDERS)[number];

export const CITY_GENERATION_REASONING_EFFORTS = ['none', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

export type CityGenerationReasoningEffort = (typeof CITY_GENERATION_REASONING_EFFORTS)[number];

/**
 * Return the effort values the selected provider/model family is known to
 * accept. Provider model-list APIs expose IDs, not a uniform capability
 * schema, so this is deliberately conservative for unknown custom IDs.
 */
export function getSupportedCityGenerationReasoningEfforts(
  provider: CityGenerationProvider,
  model?: string,
): CityGenerationReasoningEffort[] {
  const normalized = model?.trim().toLowerCase() ?? '';

  if (provider === 'openai') {
    if (/^gpt-5\.6(?:-|$)/.test(normalized)) {
      return [...CITY_GENERATION_REASONING_EFFORTS];
    }
    if (/^(?:gpt-5(?:\.|-)|o1(?:-|$)|o3(?:-|$)|o4(?:-|$))/.test(normalized)) {
      return CITY_GENERATION_REASONING_EFFORTS.filter((effort) => effort !== 'max');
    }
    return ['none'];
  }

  if (provider === 'anthropic') {
    return /^claude-(?:3-7-|(?:opus|sonnet|haiku)-4)/.test(normalized)
      ? ['none', 'low', 'medium', 'high']
      : ['none'];
  }

  return /^(?:gemini-2\.5|gemini-3)(?:-|$)/.test(normalized)
    ? ['none', 'low', 'medium', 'high']
    : ['none'];
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

export const CITY_GENERATION_DEFAULT_MODELS: Record<CityGenerationProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5.6-luna',
  gemini: 'gemini-2.5-flash',
};

export const CITY_GENERATION_DEFAULT_REASONING_EFFORT: CityGenerationReasoningEffort = 'max';

export const CITY_GENERATION_LEGACY_DEFAULT_MODEL_MIGRATIONS: Record<CityGenerationProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-5-mini', 'gpt-5.4-mini'],
  anthropic: ['claude-sonnet-4-20250514'],
  gemini: ['gemini-2.0-flash'],
};

export interface CuratedModelsSnapshot {
  schemaVersion: number;
  generatedAt: string;
  sources: Record<CityGenerationProvider, string>;
  providers: Record<CityGenerationProvider, string[]>;
}

export const CITY_GENERATION_CURATED_SNAPSHOT = curatedModelsSnapshot as CuratedModelsSnapshot;

export const CITY_GENERATION_KNOWN_MODELS: Record<CityGenerationProvider, string[]> = {
  openai: CITY_GENERATION_CURATED_SNAPSHOT.providers.openai,
  anthropic: CITY_GENERATION_CURATED_SNAPSHOT.providers.anthropic,
  gemini: CITY_GENERATION_CURATED_SNAPSHOT.providers.gemini,
};

export const CITY_GENERATION_PROVIDER_OPTIONS: Array<{
  value: CityGenerationProvider;
  label: string;
  help: string;
  defaultModel: string;
  knownModels: string[];
}> = [
  {
    value: 'openai',
    label: 'OpenAI',
    help: 'Uses your OpenAI API key or the server OPENAI_API_KEY.',
    defaultModel: CITY_GENERATION_DEFAULT_MODELS.openai,
    knownModels: CITY_GENERATION_KNOWN_MODELS.openai,
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    help: 'Uses your Anthropic API key or the server ANTHROPIC_API_KEY.',
    defaultModel: CITY_GENERATION_DEFAULT_MODELS.anthropic,
    knownModels: CITY_GENERATION_KNOWN_MODELS.anthropic,
  },
  {
    value: 'gemini',
    label: 'Google Gemini',
    help: 'Uses your Gemini API key or the server GEMINI_API_KEY.',
    defaultModel: CITY_GENERATION_DEFAULT_MODELS.gemini,
    knownModels: CITY_GENERATION_KNOWN_MODELS.gemini,
  },
];

export function getDefaultCityGenerationModels(): Record<CityGenerationProvider, string> {
  return {
    openai: CITY_GENERATION_DEFAULT_MODELS.openai,
    anthropic: CITY_GENERATION_DEFAULT_MODELS.anthropic,
    gemini: CITY_GENERATION_DEFAULT_MODELS.gemini,
  };
}

export function migrateStoredCityGenerationModels(
  parsed: Partial<Record<CityGenerationProvider, string>>
): Record<CityGenerationProvider, string> {
  return {
    openai:
      parsed.openai && !CITY_GENERATION_LEGACY_DEFAULT_MODEL_MIGRATIONS.openai.includes(parsed.openai)
        ? parsed.openai
        : CITY_GENERATION_DEFAULT_MODELS.openai,
    anthropic:
      parsed.anthropic && !CITY_GENERATION_LEGACY_DEFAULT_MODEL_MIGRATIONS.anthropic.includes(parsed.anthropic)
        ? parsed.anthropic
        : CITY_GENERATION_DEFAULT_MODELS.anthropic,
    gemini:
      parsed.gemini && !CITY_GENERATION_LEGACY_DEFAULT_MODEL_MIGRATIONS.gemini.includes(parsed.gemini)
        ? parsed.gemini
        : CITY_GENERATION_DEFAULT_MODELS.gemini,
  };
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
    message: `Custom model id for ${provider}. Double-check spelling and provider support before generating.`,
    tone: 'warning' as const,
  };
}
