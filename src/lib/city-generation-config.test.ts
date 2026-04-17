import { describe, expect, it } from 'vitest';
import {
  CITY_GENERATION_DEFAULT_MODELS,
  migrateStoredCityGenerationModels,
  validateCityGenerationModel,
} from '@/lib/city-generation-config';

describe('city-generation-config', () => {
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
    const validation = validateCityGenerationModel('openai', 'GPT-5.4-MINI');

    expect(validation.isKnownModel).toBe(true);
    expect(validation.effectiveModel).toBe('gpt-5.4-mini');
    expect(validation.usesDefaultModel).toBe(true);
    expect(validation.tone).toBe('default');
  });

  it('warns on unknown custom model ids without blocking them', () => {
    const validation = validateCityGenerationModel('gemini', 'gemini-experimental-foo');

    expect(validation.isKnownModel).toBe(false);
    expect(validation.effectiveModel).toBe('gemini-experimental-foo');
    expect(validation.tone).toBe('warning');
  });
});
