import { describe, expect, it } from 'vitest';
import {
  CITY_GENERATION_DEFAULT_MODELS,
  CITY_GENERATION_DEFAULT_REASONING_EFFORT,
  getSupportedCityGenerationReasoningEfforts,
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
});
