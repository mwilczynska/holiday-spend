export const CITY_GENERATION_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;

export type CityGenerationProvider = (typeof CITY_GENERATION_PROVIDERS)[number];

export const CITY_GENERATION_DEFAULT_MODELS: Record<CityGenerationProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5.4-mini',
  gemini: 'gemini-2.5-flash',
};
