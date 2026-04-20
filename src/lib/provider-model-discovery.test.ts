import { describe, expect, it } from 'vitest';
import {
  CITY_GENERATION_CURATED_SNAPSHOT,
  CITY_GENERATION_PROVIDERS,
} from '@/lib/city-generation-config';
import {
  discoverProviderModels,
  mergeProviderModelSuggestions,
  normalizeAnthropicModelIds,
  normalizeGeminiModelIds,
  normalizeGeminiModelName,
  normalizeModelsDevModelIds,
  normalizeOpenAiModelIds,
  normalizeOpenRouterModelIds,
} from '@/lib/provider-model-discovery';

describe('provider-model-discovery', () => {
  it('keeps the provider default first and ranks curated snapshot entries above alphabetical', () => {
    const merged = mergeProviderModelSuggestions('openai', ['gpt-5.4', 'gpt-5.4-mini', 'gpt-4.1', 'gpt-4.1-mini']);

    // default model always first; remaining non-snapshot ids fall back to alphabetical sort
    expect(merged[0]).toBe('gpt-5.4-mini');
    expect(merged).toContain('gpt-5.4');
    expect(merged).toContain('gpt-4.1');
    expect(merged).toContain('gpt-4.1-mini');
    expect(merged.indexOf('gpt-4.1')).toBeLessThan(merged.indexOf('gpt-4.1-mini'));
  });

  it('filters OpenAI models down to likely text-generation ids', () => {
    const result = normalizeOpenAiModelIds({
      data: [
        { id: 'gpt-5.4-mini' },
        { id: 'gpt-image-1' },
        { id: 'gpt-4o-audio-preview' },
        { id: 'o3' },
        { id: 'text-embedding-3-large' },
      ],
    });

    expect(result).toEqual(['gpt-5.4-mini', 'o3']);
  });

  it('keeps Anthropic Claude model ids only', () => {
    const result = normalizeAnthropicModelIds({
      data: [
        { id: 'claude-sonnet-4-6' },
        { id: 'claude-3-5-sonnet-latest' },
        { id: 'not-a-claude-model' },
      ],
    });

    expect(result).toEqual(['claude-sonnet-4-6', 'claude-3-5-sonnet-latest']);
  });

  it('normalizes Gemini model ids from model resource names', () => {
    expect(normalizeGeminiModelName('models/gemini-2.5-flash')).toBe('gemini-2.5-flash');
    expect(normalizeGeminiModelName('gemini-2.5-flash')).toBeNull();
  });

  it('keeps only Gemini models that support generateContent', () => {
    const result = normalizeGeminiModelIds({
      models: [
        {
          name: 'models/gemini-2.5-flash',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/text-embedding-004',
          supportedGenerationMethods: ['embedContent'],
        },
        {
          name: 'models/gemini-1.5-pro',
          supportedGenerationMethods: ['countTokens'],
        },
      ],
    });

    expect(result).toEqual(['gemini-2.5-flash']);
  });

  it('splits OpenRouter responses by provider prefix and strips vendor namespaces plus suffixes', () => {
    const payload = {
      data: [
        { id: 'openai/gpt-5.4-mini' },
        { id: 'openai/gpt-image-1' },
        { id: 'openai/gpt-5.4:free' },
        { id: 'anthropic/claude-sonnet-4-6' },
        { id: 'anthropic/claude-opus-4-7' },
        { id: 'google/gemini-2.5-flash' },
        { id: 'google/gemini-embedding-2' },
        { id: 'meta/llama-4' },
      ],
    };

    expect(normalizeOpenRouterModelIds('openai', payload)).toEqual(['gpt-5.4-mini', 'gpt-5.4']);
    expect(normalizeOpenRouterModelIds('anthropic', payload)).toEqual([
      'claude-sonnet-4-6',
      'claude-opus-4-7',
    ]);
    expect(normalizeOpenRouterModelIds('gemini', payload)).toEqual(['gemini-2.5-flash']);
  });

  it('translates OpenRouter dotted Anthropic ids into dash-separated API format', () => {
    const payload = {
      data: [
        { id: 'anthropic/claude-opus-4.7' },
        { id: 'anthropic/claude-sonnet-4.6' },
        { id: 'anthropic/claude-haiku-4.5:beta' },
      ],
    };

    expect(normalizeOpenRouterModelIds('anthropic', payload)).toEqual([
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-haiku-4-5',
    ]);
  });

  it('extracts per-provider models from the models.dev shape and applies provider filters', () => {
    const payload = {
      openai: {
        models: {
          'gpt-5.4-mini': { id: 'gpt-5.4-mini' },
          'gpt-image-1': { id: 'gpt-image-1' },
          'o3': { id: 'o3' },
        },
      },
      anthropic: {
        models: {
          'claude-sonnet-4-6': {},
          'claude-opus-4-7': { id: 'claude-opus-4-7' },
          'not-claude': { id: 'not-claude' },
        },
      },
      google: {
        models: {
          'gemini-2.5-pro': { id: 'gemini-2.5-pro' },
          'gemini-embedding-2': { id: 'gemini-embedding-2' },
        },
      },
    };

    expect(normalizeModelsDevModelIds('openai', payload)).toEqual(['gpt-5.4-mini', 'o3']);
    expect(normalizeModelsDevModelIds('anthropic', payload)).toEqual([
      'claude-sonnet-4-6',
      'claude-opus-4-7',
    ]);
    expect(normalizeModelsDevModelIds('gemini', payload)).toEqual(['gemini-2.5-pro']);
  });

  it('falls through to models.dev when OpenRouter fails, returning aggregated source', async () => {
    const originalFetch = global.fetch;
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    global.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('openrouter.ai')) {
        return new Response('upstream unavailable', { status: 503 });
      }
      if (url.includes('models.dev')) {
        return new Response(
          JSON.stringify({
            openai: {
              models: {
                'gpt-5.4-mini': { id: 'gpt-5.4-mini' },
                'gpt-5.4': { id: 'gpt-5.4' },
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    }) as typeof fetch;

    try {
      const result = await discoverProviderModels({
        provider: 'openai',
        forceRefresh: true,
      });

      expect(result.source).toBe('aggregated');
      expect(result.aggregatorSource).toBe('models.dev');
      expect(result.credentialSource).toBe('none');
      expect(result.liveModels).toContain('gpt-5.4-mini');
      expect(result.warning).toBeNull();
    } finally {
      global.fetch = originalFetch;
      if (originalOpenAiKey !== undefined) process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
  });

  it('returns curated fallback when both aggregators fail and no credential is present', async () => {
    const originalFetch = global.fetch;
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    global.fetch = (async () => new Response('upstream down', { status: 503 })) as typeof fetch;

    try {
      const result = await discoverProviderModels({
        provider: 'anthropic',
        forceRefresh: true,
      });

      expect(result.source).toBe('fallback');
      expect(result.aggregatorSource).toBeNull();
      expect(result.credentialSource).toBe('none');
      expect(result.liveModels).toEqual([]);
      expect(result.effectiveModels.length).toBeGreaterThan(0);
      expect(result.warning).toMatch(/curated snapshot/i);
    } finally {
      global.fetch = originalFetch;
      if (originalOpenAiKey !== undefined) process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
  });

  it('ships a curated-models snapshot that is well-formed and passes runtime filters', () => {
    expect(CITY_GENERATION_CURATED_SNAPSHOT.schemaVersion).toBe(1);

    for (const provider of CITY_GENERATION_PROVIDERS) {
      const modelIds = CITY_GENERATION_CURATED_SNAPSHOT.providers[provider];
      expect(modelIds.length).toBeGreaterThan(0);

      // Every id in the shipped snapshot must pass the aggregator normalizer's filter.
      const payload = { data: modelIds.map((id) => ({ id: `${provider === 'gemini' ? 'google' : provider}/${id}` })) };
      expect(normalizeOpenRouterModelIds(provider, payload)).toEqual(modelIds);
    }
  });

  it('reuses the cached provider response until force refresh is requested', async () => {
    const originalFetch = global.fetch;
    let fetchCount = 0;

    global.fetch = (async () => {
      fetchCount += 1;
      return new Response(
        JSON.stringify({
          data: [
            { id: 'gpt-5.4-mini' },
            { id: 'gpt-5.4' },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    }) as typeof fetch;

    try {
      const first = await discoverProviderModels({
        provider: 'openai',
        browserApiKey: 'test-cache-key',
      });
      const second = await discoverProviderModels({
        provider: 'openai',
        browserApiKey: 'test-cache-key',
      });
      const refreshed = await discoverProviderModels({
        provider: 'openai',
        browserApiKey: 'test-cache-key',
        forceRefresh: true,
      });

      expect(first.cacheHit).toBe(false);
      expect(second.cacheHit).toBe(true);
      expect(refreshed.cacheHit).toBe(false);
      expect(fetchCount).toBe(2);
      expect(second.effectiveModels[0]).toBe('gpt-5.4-mini');
      expect(second.liveModels).toContain('gpt-5.4-mini');
      expect(second.liveModels).toContain('gpt-5.4');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
