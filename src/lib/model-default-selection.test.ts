import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL_RULES,
  chooseDefaultModel,
  mergeRetiredDefaults,
  readModelsDevCatalogue,
} from '@/lib/model-default-selection';
import { CITY_GENERATION_DEFAULT_MODELS, migrateStoredCityGenerationModels } from '@/lib/city-generation-config';

function catalogue(models: Array<[string, string, number, number]>) {
  return readModelsDevCatalogue({
    fixture: {
      models: Object.fromEntries(models.map(([id, release_date, input, output]) => [id, { id, release_date, cost: { input, output } }])),
    },
  }, 'fixture');
}

describe('default model selection', () => {
  it('moves the default to a newly released model in the cheap, fast family', () => {
    const before = catalogue([
      ['claude-haiku-4-5', '2025-10-15', 1, 5],
      ['claude-haiku-5-5', '2026-10-07', 0.1, 0.5],
      ['claude-sonnet-5-5', '2026-09-28', 2, 10],
    ]);
    expect(chooseDefaultModel(DEFAULT_MODEL_RULES.anthropic!, before)).toBe('claude-haiku-5-5');

    const after = catalogue([...before.map((m) => [m.id, m.releaseDate!, m.inputCost!, m.outputCost!] as [string, string, number, number]),
      ['claude-haiku-6-0', '2027-02-01', 0.1, 0.5]]);
    expect(chooseDefaultModel(DEFAULT_MODEL_RULES.anthropic!, after)).toBe('claude-haiku-6-0');
  });

  it('ignores dated snapshots, aliases and other tiers', () => {
    const models = catalogue([
      ['gpt-6-luna', '2026-09-22', 0.1, 0.5],
      ['gpt-6-luna-pro', '2026-09-30', 0.1, 0.5],
      ['gpt-6.1-sol', '2026-09-29', 2, 10],
      ['gemini-flash-lite-latest', '2026-07-21', 0.3, 2.5],
    ]);
    expect(chooseDefaultModel(DEFAULT_MODEL_RULES.openai!, models)).toBe('gpt-6-luna');
    expect(chooseDefaultModel(DEFAULT_MODEL_RULES.gemini!, models)).toBeNull();
  });

  it('picks the cheapest member where the newest is a dearer tier', () => {
    const grok = catalogue([
      ['grok-4.3', '2026-04-17', 1.25, 2.5],
      ['grok-4.7', '2026-09-21', 2, 6],
      ['grok-build-0.1', '2026-04-16', 1, 2],
    ]);
    expect(chooseDefaultModel(DEFAULT_MODEL_RULES.xai!, grok)).toBe('grok-4.3');
    const groq = catalogue([['openai/gpt-oss-120b', '2025-08-05', 0.15, 0.6], ['openai/gpt-oss-20b', '2025-08-05', 0.075, 0.3]]);
    expect(chooseDefaultModel(DEFAULT_MODEL_RULES.groq!, groq)).toBe('openai/gpt-oss-20b');
  });

  it('retires a replaced default so a saved selection of it follows the new default', () => {
    expect(mergeRetiredDefaults(
      { anthropic: 'claude-haiku-5-5', openai: 'gpt-6-luna' },
      { anthropic: 'claude-haiku-6-0', openai: 'gpt-6-luna' },
      { anthropic: ['claude-haiku-4-5'] },
    )).toEqual({ anthropic: ['claude-haiku-4-5', 'claude-haiku-5-5'] });
    // A default that comes back is no longer retired.
    expect(mergeRetiredDefaults({ openai: 'gpt-7-luna' }, { openai: 'gpt-6-luna' }, { openai: ['gpt-6-luna'] }))
      .toEqual({ openai: ['gpt-7-luna'] });
  });

  it('moves saved selections of earlier defaults to the current ones and keeps deliberate choices', () => {
    const migrated = migrateStoredCityGenerationModels({ anthropic: 'claude-sonnet-4-6', gemini: 'gemini-2.5-flash', openai: 'gpt-6.1-sol' });
    expect(migrated.anthropic).toBe(CITY_GENERATION_DEFAULT_MODELS.anthropic);
    expect(migrated.gemini).toBe(CITY_GENERATION_DEFAULT_MODELS.gemini);
    expect(migrated.openai).toBe('gpt-6.1-sol');
  });

  it('ships cheap, fast defaults for every provider', () => {
    expect(CITY_GENERATION_DEFAULT_MODELS).toMatchObject({
      anthropic: 'claude-haiku-5-5',
      openai: 'gpt-6-luna',
      openrouter: 'openai/gpt-6-luna',
      groq: 'openai/gpt-oss-20b',
      perplexity: 'sonar',
    });
  });
});
