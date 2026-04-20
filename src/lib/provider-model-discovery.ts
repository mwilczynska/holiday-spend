import { createHash } from 'node:crypto';
import {
  CITY_GENERATION_DEFAULT_MODELS,
  CITY_GENERATION_KNOWN_MODELS,
  type CityGenerationProvider,
} from '@/lib/city-generation-config';

export type ProviderModelDiscoverySource = 'live' | 'aggregated' | 'fallback';
export type ProviderModelCredentialSource = 'browser' | 'server' | 'none';
export type ProviderModelAggregatorSource = 'openrouter' | 'models.dev';

export interface ProviderModelDiscoveryResult {
  provider: CityGenerationProvider;
  source: ProviderModelDiscoverySource;
  credentialSource: ProviderModelCredentialSource;
  aggregatorSource: ProviderModelAggregatorSource | null;
  defaultModel: string;
  curatedModels: string[];
  liveModels: string[];
  effectiveModels: string[];
  fetchedAt: string;
  cacheHit: boolean;
  warning: string | null;
}

interface DiscoveryCacheEntry {
  expiresAt: number;
  value: Omit<ProviderModelDiscoveryResult, 'cacheHit'>;
}

const MODEL_DISCOVERY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const modelDiscoveryCache = new Map<string, DiscoveryCacheEntry>();

function normalizeApiKey(apiKey?: string) {
  const trimmed = apiKey?.trim();
  return trimmed ? trimmed : undefined;
}

function summarizeProviderError(rawText: string) {
  const text = rawText.trim();
  if (!text) return 'Empty error body';

  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: string } | string;
      message?: string;
      detail?: string;
    };

    if (typeof parsed.error === 'string') return parsed.error;
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
    if (parsed.detail) return parsed.detail;
  } catch {
    // Fall back to plain text.
  }

  return text.slice(0, 400);
}

function getProviderServerApiKey(provider: CityGenerationProvider) {
  if (provider === 'openai') return normalizeApiKey(process.env.OPENAI_API_KEY);
  if (provider === 'anthropic') return normalizeApiKey(process.env.ANTHROPIC_API_KEY);
  return normalizeApiKey(process.env.GEMINI_API_KEY);
}

function resolveProviderCredential(params: {
  provider: CityGenerationProvider;
  browserApiKey?: string;
}) {
  const browserApiKey = normalizeApiKey(params.browserApiKey);
  if (browserApiKey) {
    return {
      apiKey: browserApiKey,
      credentialSource: 'browser' as const,
    };
  }

  const serverApiKey = getProviderServerApiKey(params.provider);
  if (serverApiKey) {
    return {
      apiKey: serverApiKey,
      credentialSource: 'server' as const,
    };
  }

  return {
    apiKey: undefined,
    credentialSource: 'none' as const,
  };
}

function fingerprintCredential(credentialSource: ProviderModelCredentialSource, apiKey?: string) {
  if (!apiKey) return `${credentialSource}:none`;
  const digest = createHash('sha256').update(apiKey).digest('hex').slice(0, 12);
  return `${credentialSource}:${digest}`;
}

function buildDiscoveryCacheKey(params: {
  provider: CityGenerationProvider;
  credentialSource: ProviderModelCredentialSource;
  apiKey?: string;
}) {
  return `${params.provider}:${fingerprintCredential(params.credentialSource, params.apiKey)}`;
}

function dedupeModelIds(modelIds: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const modelId of modelIds) {
    const trimmed = modelId.trim();
    if (!trimmed) continue;

    const normalizedKey = trimmed.toLowerCase();
    if (seen.has(normalizedKey)) continue;

    seen.add(normalizedKey);
    normalized.push(trimmed);
  }

  return normalized;
}

function sortProviderModelIds(provider: CityGenerationProvider, modelIds: string[]) {
  const curatedModels = CITY_GENERATION_KNOWN_MODELS[provider];
  const curatedRank = new Map(
    curatedModels.map((modelId, index) => [modelId.toLowerCase(), index] as const)
  );
  const defaultModel = CITY_GENERATION_DEFAULT_MODELS[provider].toLowerCase();

  return [...modelIds].sort((left, right) => {
    const leftLower = left.toLowerCase();
    const rightLower = right.toLowerCase();

    if (leftLower === defaultModel && rightLower !== defaultModel) return -1;
    if (rightLower === defaultModel && leftLower !== defaultModel) return 1;

    const leftCuratedRank = curatedRank.get(leftLower);
    const rightCuratedRank = curatedRank.get(rightLower);
    const leftIsCurated = leftCuratedRank != null;
    const rightIsCurated = rightCuratedRank != null;

    if (leftIsCurated && rightIsCurated) {
      return leftCuratedRank! - rightCuratedRank!;
    }

    if (leftIsCurated) return -1;
    if (rightIsCurated) return 1;

    return left.localeCompare(right);
  });
}

export function mergeProviderModelSuggestions(
  provider: CityGenerationProvider,
  liveModels: string[],
  curatedModels = CITY_GENERATION_KNOWN_MODELS[provider]
) {
  return sortProviderModelIds(
    provider,
    dedupeModelIds([
      CITY_GENERATION_DEFAULT_MODELS[provider],
      ...curatedModels,
      ...liveModels,
    ])
  );
}

function isLikelyOpenAiGenerationModel(modelId: string) {
  const normalized = modelId.toLowerCase();
  const allowedPrefix =
    normalized.startsWith('gpt-') ||
    normalized.startsWith('o1') ||
    normalized.startsWith('o3') ||
    normalized.startsWith('o4');

  if (!allowedPrefix) return false;

  const blockedFragments = [
    'audio',
    'realtime',
    'transcribe',
    'tts',
    'image',
    'embedding',
    'moderation',
    'search-preview',
  ];

  return !blockedFragments.some((fragment) => normalized.includes(fragment));
}

export function normalizeOpenAiModelIds(payload: unknown) {
  const rows = Array.isArray((payload as { data?: unknown[] })?.data)
    ? ((payload as { data: Array<{ id?: string }> }).data)
    : [];

  return dedupeModelIds(
    rows
      .map((row) => row.id?.trim() || '')
      .filter((modelId) => modelId.length > 0 && isLikelyOpenAiGenerationModel(modelId))
  );
}

export function normalizeAnthropicModelIds(payload: unknown) {
  const rows = Array.isArray((payload as { data?: unknown[] })?.data)
    ? ((payload as { data: Array<{ id?: string }> }).data)
    : [];

  return dedupeModelIds(
    rows
      .map((row) => row.id?.trim() || '')
      .filter((modelId) => modelId.toLowerCase().startsWith('claude-'))
  );
}

export function normalizeGeminiModelName(name: string) {
  if (!name.startsWith('models/')) return null;
  return name.slice('models/'.length).trim() || null;
}

export function normalizeGeminiModelIds(payload: unknown) {
  const rows = Array.isArray((payload as { models?: unknown[] })?.models)
    ? ((payload as {
        models: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      }).models)
    : [];

  return dedupeModelIds(
    rows
      .filter((row) => row.supportedGenerationMethods?.includes('generateContent'))
      .map((row) => normalizeGeminiModelName(row.name || ''))
      .filter((modelId): modelId is string => Boolean(modelId && modelId.toLowerCase().startsWith('gemini-')))
  );
}

async function fetchOpenAiModelIds(apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}: ${summarizeProviderError(await response.text())}`);
  }

  return normalizeOpenAiModelIds(await response.json());
}

async function fetchAnthropicModelIds(apiKey: string) {
  const response = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${summarizeProviderError(await response.text())}`);
  }

  return normalizeAnthropicModelIds(await response.json());
}

async function fetchGeminiModelIds(apiKey: string) {
  const modelIds: string[] = [];
  let pageToken: string | null = null;
  let pageCount = 0;

  do {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('pageSize', '1000');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await fetch(url.toString(), {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Gemini API error ${response.status}: ${summarizeProviderError(await response.text())}`);
    }

    const payload = await response.json();
    modelIds.push(...normalizeGeminiModelIds(payload));
    pageToken = typeof payload.nextPageToken === 'string' && payload.nextPageToken.trim()
      ? payload.nextPageToken
      : null;
    pageCount += 1;
  } while (pageToken && pageCount < 10);

  return dedupeModelIds(modelIds);
}

async function fetchProviderLiveModelIds(provider: CityGenerationProvider, apiKey: string) {
  if (provider === 'openai') return fetchOpenAiModelIds(apiKey);
  if (provider === 'anthropic') return fetchAnthropicModelIds(apiKey);
  return fetchGeminiModelIds(apiKey);
}

const OPENROUTER_PROVIDER_PREFIX: Record<CityGenerationProvider, string> = {
  openai: 'openai/',
  anthropic: 'anthropic/',
  gemini: 'google/',
};

const MODELS_DEV_PROVIDER_KEY: Record<CityGenerationProvider, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  gemini: 'google',
};

const NON_GENERATION_FRAGMENTS = [
  'embedding',
  'embed',
  'audio',
  'realtime',
  'transcribe',
  'tts',
  'image',
  'moderation',
  'search-preview',
];

function hasNonGenerationFragment(modelId: string) {
  const normalized = modelId.toLowerCase();
  return NON_GENERATION_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function applyProviderIdFilter(provider: CityGenerationProvider, modelId: string) {
  if (provider === 'openai') return isLikelyOpenAiGenerationModel(modelId);
  const normalized = modelId.toLowerCase();
  if (provider === 'anthropic') {
    return normalized.startsWith('claude-') && !hasNonGenerationFragment(normalized);
  }
  return normalized.startsWith('gemini-') && !hasNonGenerationFragment(normalized);
}

function translateAggregatorModelId(provider: CityGenerationProvider, modelId: string) {
  // OpenRouter uses dot separators for Anthropic ids (`claude-opus-4.7`) while the
  // Anthropic API itself uses dashes (`claude-opus-4-7`). OpenAI and Gemini agree
  // between aggregators and their own APIs, so only Anthropic needs translation.
  if (provider === 'anthropic') return modelId.replace(/\./g, '-');
  return modelId;
}

export function normalizeOpenRouterModelIds(provider: CityGenerationProvider, payload: unknown) {
  const rows = Array.isArray((payload as { data?: unknown[] })?.data)
    ? ((payload as { data: Array<{ id?: string }> }).data)
    : [];

  const prefix = OPENROUTER_PROVIDER_PREFIX[provider];

  return dedupeModelIds(
    rows
      .map((row) => row.id?.trim() || '')
      .filter((rawId) => rawId.toLowerCase().startsWith(prefix))
      .map((rawId) => rawId.slice(prefix.length))
      // OpenRouter sometimes appends `:free`, `:beta`, or other suffixes — strip them.
      .map((modelId) => modelId.split(':')[0]!.trim())
      .map((modelId) => translateAggregatorModelId(provider, modelId))
      .filter((modelId) => modelId.length > 0 && applyProviderIdFilter(provider, modelId))
  );
}

export function normalizeModelsDevModelIds(provider: CityGenerationProvider, payload: unknown) {
  const providerKey = MODELS_DEV_PROVIDER_KEY[provider];
  const providerBlock = (payload as Record<string, unknown>)?.[providerKey];
  if (!providerBlock || typeof providerBlock !== 'object') return [];

  const modelsBlock = (providerBlock as { models?: unknown }).models;
  if (!modelsBlock || typeof modelsBlock !== 'object') return [];

  const rawIds: string[] = [];
  for (const [key, value] of Object.entries(modelsBlock as Record<string, unknown>)) {
    const explicitId = typeof value === 'object' && value !== null
      ? (value as { id?: unknown }).id
      : undefined;
    const id = typeof explicitId === 'string' && explicitId.trim()
      ? explicitId.trim()
      : key.trim();
    if (id) rawIds.push(id);
  }

  return dedupeModelIds(
    rawIds
      .map((modelId) => translateAggregatorModelId(provider, modelId))
      .filter((modelId) => applyProviderIdFilter(provider, modelId))
  );
}

async function fetchOpenRouterProviderModelIds(provider: CityGenerationProvider) {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `OpenRouter aggregator error ${response.status}: ${summarizeProviderError(await response.text())}`
    );
  }

  return normalizeOpenRouterModelIds(provider, await response.json());
}

async function fetchModelsDevProviderModelIds(provider: CityGenerationProvider) {
  const response = await fetch('https://models.dev/api.json', {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `models.dev aggregator error ${response.status}: ${summarizeProviderError(await response.text())}`
    );
  }

  return normalizeModelsDevModelIds(provider, await response.json());
}

export interface AggregatedProviderModelResult {
  aggregatorSource: ProviderModelAggregatorSource;
  modelIds: string[];
}

export async function fetchAggregatedProviderModelIds(
  provider: CityGenerationProvider
): Promise<AggregatedProviderModelResult> {
  const errors: string[] = [];

  try {
    const modelIds = await fetchOpenRouterProviderModelIds(provider);
    if (modelIds.length > 0) {
      return { aggregatorSource: 'openrouter', modelIds };
    }
    errors.push('OpenRouter returned no usable models for this provider.');
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'OpenRouter aggregator failed.');
  }

  try {
    const modelIds = await fetchModelsDevProviderModelIds(provider);
    if (modelIds.length > 0) {
      return { aggregatorSource: 'models.dev', modelIds };
    }
    errors.push('models.dev returned no usable models for this provider.');
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'models.dev aggregator failed.');
  }

  throw new Error(errors.join(' '));
}

function buildFallbackDiscoveryResult(params: {
  provider: CityGenerationProvider;
  credentialSource: ProviderModelCredentialSource;
  warning: string;
}) {
  const curatedModels = CITY_GENERATION_KNOWN_MODELS[params.provider];
  const effectiveModels = mergeProviderModelSuggestions(params.provider, [], curatedModels);

  return {
    provider: params.provider,
    source: 'fallback' as const,
    credentialSource: params.credentialSource,
    aggregatorSource: null,
    defaultModel: CITY_GENERATION_DEFAULT_MODELS[params.provider],
    curatedModels,
    liveModels: [],
    effectiveModels,
    fetchedAt: new Date().toISOString(),
    cacheHit: false,
    warning: params.warning,
  };
}

async function buildAggregatedDiscoveryResult(params: {
  provider: CityGenerationProvider;
}): Promise<Omit<ProviderModelDiscoveryResult, 'cacheHit'>> {
  const aggregated = await fetchAggregatedProviderModelIds(params.provider);
  const liveModels = sortProviderModelIds(params.provider, aggregated.modelIds);

  return {
    provider: params.provider,
    source: 'aggregated',
    credentialSource: 'none',
    aggregatorSource: aggregated.aggregatorSource,
    defaultModel: CITY_GENERATION_DEFAULT_MODELS[params.provider],
    curatedModels: CITY_GENERATION_KNOWN_MODELS[params.provider],
    liveModels,
    effectiveModels: mergeProviderModelSuggestions(params.provider, liveModels),
    fetchedAt: new Date().toISOString(),
    warning: null,
  };
}

export async function discoverProviderModels(params: {
  provider: CityGenerationProvider;
  browserApiKey?: string;
  forceRefresh?: boolean;
}): Promise<ProviderModelDiscoveryResult> {
  const credential = resolveProviderCredential({
    provider: params.provider,
    browserApiKey: params.browserApiKey,
  });

  const cacheKey = buildDiscoveryCacheKey({
    provider: params.provider,
    credentialSource: credential.credentialSource,
    apiKey: credential.apiKey,
  });
  const cached = modelDiscoveryCache.get(cacheKey);

  if (!params.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.value,
      cacheHit: true,
    };
  }

  if (!credential.apiKey) {
    try {
      const value = await buildAggregatedDiscoveryResult({ provider: params.provider });
      modelDiscoveryCache.set(cacheKey, {
        expiresAt: Date.now() + MODEL_DISCOVERY_CACHE_TTL_MS,
        value,
      });
      return { ...value, cacheHit: false };
    } catch (err) {
      return buildFallbackDiscoveryResult({
        provider: params.provider,
        credentialSource: credential.credentialSource,
        warning: err instanceof Error
          ? `${err.message} Showing curated fallback suggestions.`
          : 'Live model discovery is unavailable without a provider API key, and aggregated sources could not be reached. Showing curated fallback suggestions.',
      });
    }
  }

  try {
    const liveModels = sortProviderModelIds(
      params.provider,
      await fetchProviderLiveModelIds(params.provider, credential.apiKey)
    );
    const value: Omit<ProviderModelDiscoveryResult, 'cacheHit'> = {
      provider: params.provider,
      source: 'live',
      credentialSource: credential.credentialSource,
      aggregatorSource: null,
      defaultModel: CITY_GENERATION_DEFAULT_MODELS[params.provider],
      curatedModels: CITY_GENERATION_KNOWN_MODELS[params.provider],
      liveModels,
      effectiveModels: mergeProviderModelSuggestions(params.provider, liveModels),
      fetchedAt: new Date().toISOString(),
      warning: liveModels.length === 0
        ? 'The provider returned no usable generation models. Showing curated fallback suggestions first.'
        : null,
    };

    modelDiscoveryCache.set(cacheKey, {
      expiresAt: Date.now() + MODEL_DISCOVERY_CACHE_TTL_MS,
      value,
    });

    return {
      ...value,
      cacheHit: false,
    };
  } catch (err) {
    return buildFallbackDiscoveryResult({
      provider: params.provider,
      credentialSource: credential.credentialSource,
      warning: err instanceof Error
        ? `${err.message} Showing curated fallback suggestions.`
        : 'Live model discovery failed. Showing curated fallback suggestions.',
    });
  }
}
