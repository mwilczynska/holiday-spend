import { describe, expect, it } from 'vitest';
import {
  discoverProviderModels,
  mergeProviderModelSuggestions,
  normalizeAnthropicModelIds,
  normalizeGeminiModelIds,
  normalizeGeminiModelName,
  normalizeOpenAiModelIds,
} from '@/lib/provider-model-discovery';

describe('provider-model-discovery', () => {
  it('keeps the provider default first when merging curated and live suggestions', () => {
    expect(
      mergeProviderModelSuggestions('openai', ['gpt-5.4', 'gpt-5.4-mini', 'gpt-4.1', 'gpt-4.1-mini'])
    ).toEqual([
      'gpt-5.4-mini',
      'gpt-5.4',
      'gpt-4.1-mini',
      'gpt-4.1',
    ]);
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
      expect(second.effectiveModels.slice(0, 2)).toEqual(['gpt-5.4-mini', 'gpt-5.4']);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
