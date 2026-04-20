import { createHash } from 'node:crypto';
import {
  CITY_GENERATION_DEFAULT_MODELS,
  CITY_GENERATION_KNOWN_MODELS,
  type CityGenerationProvider,
} from '@/lib/city-generation-config';

export type ProviderModelDiscoverySource = 'live' | 'fallback';
export type ProviderModelCredentialSource = 'browser' | 'server' | 'none';

export interface ProviderModelDiscoveryResult {
  provider: CityGenerationProvider;
  source: ProviderModelDiscoverySource;
  credentialSource: ProviderModelCredentialSource;
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
    defaultModel: CITY_GENERATION_DEFAULT_MODELS[params.provider],
    curatedModels,
    liveModels: [],
    effectiveModels,
    fetchedAt: new Date().toISOString(),
    cacheHit: false,
    warning: params.warning,
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

  if (!credential.apiKey) {
    return buildFallbackDiscoveryResult({
      provider: params.provider,
      credentialSource: credential.credentialSource,
      warning: `No ${params.provider === 'gemini' ? 'Gemini' : params.provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key is available for live model discovery. Showing curated fallback suggestions.`,
    });
  }

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

  try {
    const liveModels = sortProviderModelIds(
      params.provider,
      await fetchProviderLiveModelIds(params.provider, credential.apiKey)
    );
    const value: Omit<ProviderModelDiscoveryResult, 'cacheHit'> = {
      provider: params.provider,
      source: 'live',
      credentialSource: credential.credentialSource,
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
