import { describe, expect, it } from 'vitest';
import { formatProviderModelDiscoveryStatus } from '@/lib/use-provider-model-discovery';
import type { ProviderModelDiscoveryResult } from '@/lib/provider-model-discovery';

function buildResult(overrides: Partial<ProviderModelDiscoveryResult>): ProviderModelDiscoveryResult {
  return {
    provider: 'openai',
    source: 'fallback',
    credentialSource: 'none',
    aggregatorSource: null,
    defaultModel: 'gpt-5.4-mini',
    curatedModels: ['gpt-5.4-mini'],
    liveModels: [],
    effectiveModels: ['gpt-5.4-mini'],
    fetchedAt: new Date().toISOString(),
    cacheHit: false,
    warning: null,
    ...overrides,
  };
}

describe('formatProviderModelDiscoveryStatus', () => {
  it('returns the loading copy when loading is true', () => {
    const status = formatProviderModelDiscoveryStatus({
      result: buildResult({}),
      loading: true,
    });
    expect(status).toContain('Loading');
  });

  it('describes live provider discovery with model count and cache state', () => {
    const status = formatProviderModelDiscoveryStatus({
      result: buildResult({
        source: 'live',
        liveModels: ['gpt-5.4-mini', 'gpt-5.4'],
        cacheHit: true,
      }),
      loading: false,
    });
    expect(status).toContain('Live models');
    expect(status).toContain('2 models');
    expect(status).toContain('(cached)');
  });

  it('names OpenRouter as the aggregator and prompts for an API key when tier 2 is active', () => {
    const status = formatProviderModelDiscoveryStatus({
      result: buildResult({
        source: 'aggregated',
        aggregatorSource: 'openrouter',
        liveModels: ['gpt-5.4-mini', 'gpt-5.4'],
      }),
      loading: false,
    });
    expect(status).toContain('OpenRouter');
    expect(status).toContain('2 models');
    expect(status).toContain('API key');
  });

  it('names models.dev when that aggregator supplied the list', () => {
    const status = formatProviderModelDiscoveryStatus({
      result: buildResult({
        source: 'aggregated',
        aggregatorSource: 'models.dev',
        liveModels: ['claude-sonnet-4-6'],
      }),
      loading: false,
    });
    expect(status).toContain('models.dev');
    expect(status).toContain('1 model');
  });

  it('directs users to npm run models:refresh when the curated snapshot is shown', () => {
    const status = formatProviderModelDiscoveryStatus({
      result: buildResult({ source: 'fallback' }),
      loading: false,
    });
    expect(status).toContain('curated snapshot');
    expect(status).toContain('models:refresh');
  });
});
