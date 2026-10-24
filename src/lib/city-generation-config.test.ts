import { describe, expect, it } from 'vitest';
import {
  CITY_GENERATION_DEFAULT_MODELS,
  CITY_GENERATION_DEFAULT_REASONING_EFFORT,
  CITY_GENERATION_SEARCH_PROVIDER_OPTIONS,
  getAnthropicThinkingMode,
  getModelReasoningEfforts,
  getSupportedCityGenerationReasoningEfforts,
  resolveCityGenerationReasoningEffort,
  resolveProviderRequestEffort,
  migrateStoredCityGenerationModels,
  validateCityGenerationModel,
} from '@/lib/city-generation-config';

describe('city-generation-config', () => {
  it('defaults OpenAI to GPT-6 Luna max and migrates the previous default', () => {
    expect(CITY_GENERATION_DEFAULT_MODELS.openai).toBe('gpt-6-luna');
    expect(CITY_GENERATION_DEFAULT_REASONING_EFFORT).toBe('max');
    expect(migrateStoredCityGenerationModels({ openai: 'gpt-5.6-luna' }).openai).toBe('gpt-6-luna');
    expect(getSupportedCityGenerationReasoningEfforts('openai', 'gpt-6-luna')).toContain('max');
  });
  it('migrates legacy stored defaults back to current defaults', () => {
    expect(
      migrateStoredCityGenerationModels({
        openai: 'gpt-4o',
        anthropic: 'claude-sonnet-4-20250514',
        gemini: 'gemini-2.0-flash',
      })
    ).toEqual(CITY_GENERATION_DEFAULT_MODELS);
  });

  it('preserves non-legacy stored models', () => {
    expect(
      migrateStoredCityGenerationModels({
        openai: 'gpt-5.4',
        anthropic: 'claude-sonnet-4-5',
        gemini: 'gemini-2.5-pro',
      })
    ).toEqual({
      ...CITY_GENERATION_DEFAULT_MODELS,
      openai: 'gpt-5.4',
      anthropic: 'claude-sonnet-4-5',
      gemini: 'gemini-2.5-pro',
    });
  });

  it('canonicalizes known models case-insensitively', () => {
    const validation = validateCityGenerationModel('openai', 'GPT-6-LUNA', ['gpt-6-luna']);

    expect(validation.isKnownModel).toBe(true);
    expect(validation.effectiveModel).toBe('gpt-6-luna');
    expect(validation.usesDefaultModel).toBe(true);
    expect(validation.tone).toBe('default');
  });

  it('warns on unknown custom model ids without blocking them', () => {
    const validation = validateCityGenerationModel('gemini', 'gemini-experimental-foo');

    expect(validation.isKnownModel).toBe(false);
    expect(validation.effectiveModel).toBe('gemini-experimental-foo');
    expect(validation.tone).toBe('warning');
  });

  it('offers only reasoning efforts accepted by the selected OpenAI model family', () => {
    expect(getSupportedCityGenerationReasoningEfforts('openai', 'gpt-5.6-luna')).toEqual([
      'none',
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
    ]);
    expect(getSupportedCityGenerationReasoningEfforts('openai', 'gpt-5.6-sol')).toContain('max');
  });

  it('offers low to max for models that always reason, such as GPT-6.1 Sol', () => {
    expect(getSupportedCityGenerationReasoningEfforts('openai', 'gpt-6.1-sol')).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(getSupportedCityGenerationReasoningEfforts('openai', 'gpt-6-astra')).not.toContain('none');
    // A release newer than the snapshot falls back to the family rule rather than to "none".
    expect(getSupportedCityGenerationReasoningEfforts('openai', 'gpt-6.2-sol')).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(resolveCityGenerationReasoningEffort('openai', 'gpt-6.1-sol', 'none')).toBe('max');
  });

  it('uses each provider family\'s effort rules', () => {
    expect(getSupportedCityGenerationReasoningEfforts('anthropic', 'claude-opus-5-5')).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(getSupportedCityGenerationReasoningEfforts('anthropic', 'claude-haiku-4-5')).toEqual(['none', 'low', 'medium', 'high']);
    expect(getAnthropicThinkingMode('claude-sonnet-4-6')).toBe('adaptive');
    expect(getAnthropicThinkingMode('claude-sonnet-4-20250514')).toBe('budget');
    expect(getSupportedCityGenerationReasoningEfforts('gemini', 'gemini-3.8-flash')).toEqual(['low', 'medium', 'high']);
    expect(getSupportedCityGenerationReasoningEfforts('gemini', 'gemini-2.5-flash')).toEqual(['none', 'low', 'medium', 'high']);
    expect(getSupportedCityGenerationReasoningEfforts('xai', 'grok-4.7')).toEqual(['low', 'medium', 'high', 'xhigh']);
    expect(getSupportedCityGenerationReasoningEfforts('groq', 'openai/gpt-oss-120b')).toEqual(['low', 'medium', 'high']);
    expect(getSupportedCityGenerationReasoningEfforts('openrouter', 'openai/gpt-6.1-sol:free')).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
  });

  it('shows a single disabled option and sends no effort when a model has no configurable effort', () => {
    expect(getSupportedCityGenerationReasoningEfforts('perplexity', 'sonar-pro')).toEqual(['none']);
    expect(getModelReasoningEfforts('openai', 'gpt-4.1')).toEqual([]);
    expect(resolveProviderRequestEffort('openai', 'gpt-4.1', 'none')).toBeUndefined();
    expect(resolveProviderRequestEffort('openai', 'gpt-6-luna', 'none')).toBe('none');
  });

  it('lists only search-capable providers for city generation', () => {
    const searchProviders = CITY_GENERATION_SEARCH_PROVIDER_OPTIONS.map((option) => option.value);
    expect(searchProviders).toEqual(expect.arrayContaining(['openai', 'anthropic', 'gemini', 'xai', 'openrouter', 'perplexity']));
    expect(searchProviders).not.toContain('deepseek');
    expect(searchProviders).not.toContain('cerebras');
  });
});
