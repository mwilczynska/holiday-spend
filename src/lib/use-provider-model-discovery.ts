'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CITY_GENERATION_DEFAULT_MODELS,
  CITY_GENERATION_KNOWN_MODELS,
  type CityGenerationProvider,
} from '@/lib/city-generation-config';
import type { ProviderModelDiscoveryResult } from '@/lib/provider-model-discovery';

interface UseProviderModelDiscoveryOptions {
  provider: CityGenerationProvider;
  apiKey?: string;
  enabled?: boolean;
}

function buildFallbackState(provider: CityGenerationProvider): ProviderModelDiscoveryResult {
  const curatedModels = CITY_GENERATION_KNOWN_MODELS[provider];

  return {
    provider,
    source: 'fallback',
    credentialSource: 'none',
    aggregatorSource: null,
    defaultModel: CITY_GENERATION_DEFAULT_MODELS[provider],
    curatedModels,
    liveModels: [],
    effectiveModels: curatedModels,
    fetchedAt: new Date(0).toISOString(),
    cacheHit: false,
    warning: null,
  };
}

function pluralizeModels(count: number) {
  return `${count} model${count === 1 ? '' : 's'}`;
}

function formatAggregatorLabel(aggregatorSource: ProviderModelDiscoveryResult['aggregatorSource']) {
  if (aggregatorSource === 'openrouter') return 'OpenRouter';
  if (aggregatorSource === 'models.dev') return 'models.dev';
  return 'an aggregator';
}

export function formatProviderModelDiscoveryStatus(params: {
  result: ProviderModelDiscoveryResult;
  loading: boolean;
}) {
  if (params.loading) {
    return 'Loading live model suggestions...';
  }

  const { result } = params;
  const cachedSuffix = result.cacheHit ? ' (cached)' : '';

  if (result.source === 'live') {
    const discoveredCount = result.liveModels.length;
    return discoveredCount > 0
      ? `Live models loaded from the provider API${cachedSuffix}. ${pluralizeModels(discoveredCount)} discovered.`
      : 'Live model discovery returned no usable generation models. Showing curated snapshot suggestions first.';
  }

  if (result.source === 'aggregated') {
    const aggregatorLabel = formatAggregatorLabel(result.aggregatorSource);
    const discoveredCount = result.liveModels.length;
    return `Showing aggregated suggestions from ${aggregatorLabel}${cachedSuffix}. ${pluralizeModels(discoveredCount)} listed. Add a provider API key for live models straight from the provider.`;
  }

  return 'Showing curated snapshot suggestions. Run `npm run models:refresh` to update them.';
}

export function summarizeProviderModelExamples(modelIds: string[], limit = 4) {
  const preview = modelIds.slice(0, limit);
  if (preview.length === 0) return '';
  if (modelIds.length <= limit) return preview.join(', ');
  return `${preview.join(', ')} +${modelIds.length - limit} more`;
}

export function useProviderModelDiscovery({
  provider,
  apiKey,
  enabled = true,
}: UseProviderModelDiscoveryOptions) {
  const [result, setResult] = useState<ProviderModelDiscoveryResult>(() => buildFallbackState(provider));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedApiKey = apiKey?.trim() || '';

  const load = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(
        `/api/llm/models?provider=${encodeURIComponent(provider)}${forceRefresh ? '&refresh=1' : ''}`,
        {
          cache: 'no-store',
          headers: normalizedApiKey ? { 'x-provider-api-key': normalizedApiKey } : undefined,
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load provider models.');
      }

      setResult(data.data as ProviderModelDiscoveryResult);
    } catch (err) {
      setResult(buildFallbackState(provider));
      setError(err instanceof Error ? err.message : 'Failed to load provider models.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled, normalizedApiKey, provider]);

  useEffect(() => {
    setResult(buildFallbackState(provider));
  }, [provider]);

  useEffect(() => {
    if (!enabled) return;

    const timeoutId = window.setTimeout(() => {
      void load(false);
    }, normalizedApiKey ? 350 : 0);

    return () => window.clearTimeout(timeoutId);
  }, [enabled, load, normalizedApiKey, provider]);

  const statusMessage = useMemo(
    () => formatProviderModelDiscoveryStatus({ result, loading }),
    [loading, result]
  );
  const exampleSummary = useMemo(
    () => summarizeProviderModelExamples(result.effectiveModels),
    [result.effectiveModels]
  );

  return {
    result,
    loading,
    refreshing,
    error,
    statusMessage,
    exampleSummary,
    refresh: useCallback(() => load(true), [load]),
  };
}
