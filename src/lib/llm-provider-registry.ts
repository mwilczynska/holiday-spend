/**
 * Every LLM provider the app can call, described as data. Request shapes, web-search mechanisms and
 * endpoints come from each provider's public documentation (checked 23 October 2026); see
 * docs/product/llm-providers.md for sources and what has and has not been exercised with a real key.
 *
 * This module must not import city-generation-config, which builds on it.
 */

export const LLM_PROVIDER_IDS = [
  'anthropic',
  'openai',
  'gemini',
  'xai',
  'openrouter',
  'groq',
  'perplexity',
  'mistral',
  'zai',
  'deepseek',
  'together',
  'fireworks',
  'cerebras',
] as const;

export type LlmProviderId = (typeof LLM_PROVIDER_IDS)[number];

/** How a request reaches the provider. */
export type LlmProviderTransport =
  | 'openai-responses'
  | 'anthropic-messages'
  | 'gemini-generate-content'
  | 'chat-completions'
  | 'perplexity-sonar'
  | 'mistral-conversations';

/**
 * The provider's server-side web search, if it has one. City generation (v1.1 and v1.2) requires a
 * live FX lookup, so a provider without one cannot generate cities; transport estimates fall back to
 * an ungrounded answer labelled as such.
 */
export type LlmProviderWebSearch =
  | 'responses-tool'
  | 'anthropic-tool'
  | 'gemini-grounding'
  | 'openrouter-plugin'
  | 'groq-browser-search'
  | 'sonar-built-in'
  | 'mistral-tool'
  | 'zai-tool'
  | null;

/** How a reasoning effort is expressed in the request body. */
export type LlmProviderEffortParam =
  | 'responses-reasoning'
  | 'anthropic'
  | 'gemini'
  | 'openrouter-reasoning'
  | 'reasoning_effort'
  | 'deepseek-thinking'
  | null;

export interface LlmProviderSpec {
  id: LlmProviderId;
  label: string;
  envKey: string;
  keyUrl: string;
  /** Fallback default; `npm run models:refresh` normally chooses it (see model-default-selection.ts). */
  defaultModel: string;
  transport: LlmProviderTransport;
  /** Base URL for OpenAI-style transports; the transport appends its own path. */
  baseUrl?: string;
  /** Keyed model-list endpoint returning `{ data: [{ id }] }` or a bare array; null when there is none. */
  modelsUrl: string | null;
  webSearch: LlmProviderWebSearch;
  effortParam: LlmProviderEffortParam;
  /** Aggregator lookups for no-key model suggestions, in the order they are tried. */
  openRouterPrefix: string | null;
  modelsDevKey: string | null;
  aggregatorOrder: Array<'openrouter' | 'models.dev'>;
  bulkConcurrency: number;
  /** Request field limiting output length on chat-completions transports; defaults to `max_tokens`. */
  maxTokensField?: 'max_tokens' | 'max_completion_tokens';
}

export const LLM_PROVIDER_SPECS: Record<LlmProviderId, LlmProviderSpec> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    keyUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-6-luna',
    transport: 'openai-responses',
    baseUrl: 'https://api.openai.com/v1',
    modelsUrl: 'https://api.openai.com/v1/models',
    webSearch: 'responses-tool',
    effortParam: 'responses-reasoning',
    openRouterPrefix: 'openai/',
    modelsDevKey: 'openai',
    aggregatorOrder: ['openrouter', 'models.dev'],
    bulkConcurrency: 4,
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    keyUrl: 'https://platform.claude.com/settings/keys',
    defaultModel: 'claude-haiku-5-5',
    transport: 'anthropic-messages',
    modelsUrl: 'https://api.anthropic.com/v1/models',
    webSearch: 'anthropic-tool',
    effortParam: 'anthropic',
    openRouterPrefix: 'anthropic/',
    modelsDevKey: 'anthropic',
    aggregatorOrder: ['openrouter', 'models.dev'],
    bulkConcurrency: 2,
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    keyUrl: 'https://aistudio.google.com/apikey',
    defaultModel: 'gemini-3.5-flash-lite',
    transport: 'gemini-generate-content',
    modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    webSearch: 'gemini-grounding',
    effortParam: 'gemini',
    openRouterPrefix: 'google/',
    modelsDevKey: 'google',
    aggregatorOrder: ['openrouter', 'models.dev'],
    bulkConcurrency: 2,
  },
  xai: {
    id: 'xai',
    label: 'xAI Grok',
    envKey: 'XAI_API_KEY',
    keyUrl: 'https://console.x.ai',
    defaultModel: 'grok-4.3',
    transport: 'openai-responses',
    baseUrl: 'https://api.x.ai/v1',
    modelsUrl: 'https://api.x.ai/v1/models',
    webSearch: 'responses-tool',
    effortParam: 'responses-reasoning',
    openRouterPrefix: 'x-ai/',
    modelsDevKey: 'xai',
    aggregatorOrder: ['models.dev', 'openrouter'],
    bulkConcurrency: 2,
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    keyUrl: 'https://openrouter.ai/settings/keys',
    defaultModel: 'openai/gpt-6-luna',
    transport: 'chat-completions',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelsUrl: 'https://openrouter.ai/api/v1/models',
    webSearch: 'openrouter-plugin',
    effortParam: 'openrouter-reasoning',
    openRouterPrefix: '',
    modelsDevKey: null,
    aggregatorOrder: ['openrouter'],
    bulkConcurrency: 2,
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    envKey: 'GROQ_API_KEY',
    keyUrl: 'https://console.groq.com/keys',
    defaultModel: 'openai/gpt-oss-20b',
    transport: 'chat-completions',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelsUrl: 'https://api.groq.com/openai/v1/models',
    webSearch: 'groq-browser-search',
    effortParam: 'reasoning_effort',
    openRouterPrefix: null,
    modelsDevKey: 'groq',
    aggregatorOrder: ['models.dev'],
    bulkConcurrency: 2,
    maxTokensField: 'max_completion_tokens',
  },
  perplexity: {
    id: 'perplexity',
    label: 'Perplexity Sonar',
    envKey: 'PERPLEXITY_API_KEY',
    keyUrl: 'https://www.perplexity.ai/account/api/keys',
    defaultModel: 'sonar',
    transport: 'perplexity-sonar',
    baseUrl: 'https://api.perplexity.ai/v1',
    modelsUrl: null,
    webSearch: 'sonar-built-in',
    effortParam: null,
    openRouterPrefix: 'perplexity/',
    modelsDevKey: 'perplexity',
    aggregatorOrder: ['models.dev', 'openrouter'],
    bulkConcurrency: 2,
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    envKey: 'MISTRAL_API_KEY',
    keyUrl: 'https://console.mistral.ai/api-keys',
    defaultModel: 'mistral-small-2603',
    transport: 'mistral-conversations',
    baseUrl: 'https://api.mistral.ai/v1',
    modelsUrl: 'https://api.mistral.ai/v1/models',
    webSearch: 'mistral-tool',
    effortParam: null,
    openRouterPrefix: 'mistralai/',
    modelsDevKey: 'mistral',
    aggregatorOrder: ['models.dev', 'openrouter'],
    bulkConcurrency: 2,
  },
  zai: {
    id: 'zai',
    label: 'Z.ai GLM',
    envKey: 'ZAI_API_KEY',
    keyUrl: 'https://z.ai/manage-apikey/apikey-list',
    defaultModel: 'glm-5.3-flash',
    transport: 'chat-completions',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    modelsUrl: 'https://api.z.ai/api/paas/v4/models',
    webSearch: 'zai-tool',
    effortParam: null,
    openRouterPrefix: 'z-ai/',
    modelsDevKey: 'zai',
    aggregatorOrder: ['models.dev', 'openrouter'],
    bulkConcurrency: 2,
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    defaultModel: 'deepseek-flash',
    transport: 'chat-completions',
    baseUrl: 'https://api.deepseek.com',
    modelsUrl: 'https://api.deepseek.com/models',
    webSearch: null,
    effortParam: 'deepseek-thinking',
    openRouterPrefix: 'deepseek/',
    modelsDevKey: 'deepseek',
    aggregatorOrder: ['models.dev', 'openrouter'],
    bulkConcurrency: 2,
  },
  together: {
    id: 'together',
    label: 'Together AI',
    envKey: 'TOGETHER_API_KEY',
    keyUrl: 'https://api.together.ai/settings/api-keys',
    defaultModel: 'deepseek-ai/DeepSeek-V4.1-Flash',
    transport: 'chat-completions',
    baseUrl: 'https://api.together.xyz/v1',
    modelsUrl: 'https://api.together.xyz/v1/models',
    webSearch: null,
    effortParam: 'reasoning_effort',
    openRouterPrefix: null,
    modelsDevKey: 'togetherai',
    aggregatorOrder: ['models.dev'],
    bulkConcurrency: 2,
  },
  fireworks: {
    id: 'fireworks',
    label: 'Fireworks AI',
    envKey: 'FIREWORKS_API_KEY',
    keyUrl: 'https://app.fireworks.ai/settings/users/api-keys',
    defaultModel: 'accounts/fireworks/models/deepseek-v4p1-flash',
    transport: 'chat-completions',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    modelsUrl: 'https://api.fireworks.ai/inference/v1/models',
    webSearch: null,
    effortParam: 'reasoning_effort',
    openRouterPrefix: null,
    modelsDevKey: 'fireworks-ai',
    aggregatorOrder: ['models.dev'],
    bulkConcurrency: 2,
  },
  cerebras: {
    id: 'cerebras',
    label: 'Cerebras',
    envKey: 'CEREBRAS_API_KEY',
    keyUrl: 'https://cloud.cerebras.ai/platform',
    defaultModel: 'gpt-oss-120b',
    transport: 'chat-completions',
    baseUrl: 'https://api.cerebras.ai/v1',
    modelsUrl: 'https://api.cerebras.ai/v1/models',
    webSearch: null,
    effortParam: 'reasoning_effort',
    openRouterPrefix: null,
    modelsDevKey: 'cerebras',
    aggregatorOrder: ['models.dev'],
    bulkConcurrency: 2,
  },
};

export function getLlmProviderSpec(provider: LlmProviderId) {
  return LLM_PROVIDER_SPECS[provider];
}

/** Groq offers browser search only on its hosted gpt-oss models. */
export function groqModelSupportsBrowserSearch(model: string) {
  return /^openai\/gpt-oss-/i.test(model.trim());
}

/** Whether a city-generation request (which requires a live web lookup) can run on this provider and model. */
export function providerSupportsWebSearch(provider: LlmProviderId, model?: string) {
  const spec = LLM_PROVIDER_SPECS[provider];
  if (!spec.webSearch) return false;
  if (spec.webSearch === 'groq-browser-search' && model) return groqModelSupportsBrowserSearch(model);
  return true;
}

const PROVIDER_HOSTS: Array<[string, LlmProviderId]> = [
  ['openai.com', 'openai'],
  ['anthropic.com', 'anthropic'],
  ['googleapis.com', 'gemini'],
  ['x.ai', 'xai'],
  ['openrouter.ai', 'openrouter'],
  ['groq.com', 'groq'],
  ['perplexity.ai', 'perplexity'],
  ['mistral.ai', 'mistral'],
  ['z.ai', 'zai'],
  ['deepseek.com', 'deepseek'],
  ['together.xyz', 'together'],
  ['fireworks.ai', 'fireworks'],
  ['cerebras.ai', 'cerebras'],
];

/** The provider an outbound request URL belongs to, for attempt metadata. */
export function providerForHostname(hostname: string): LlmProviderId | null {
  return PROVIDER_HOSTS.find(([host]) => hostname === host || hostname.endsWith(`.${host}`))?.[1] ?? null;
}

export function getLlmProviderServerApiKeyNames() {
  return LLM_PROVIDER_IDS.map((provider) => LLM_PROVIDER_SPECS[provider].envKey);
}

export function getMissingProviderKeyMessage(provider: LlmProviderId, where = 'in the UI') {
  const spec = LLM_PROVIDER_SPECS[provider];
  return `No ${spec.label} API key provided. Add one ${where} or configure ${spec.envKey} on the server.`;
}

export function getNoProviderConfiguredMessage(where = 'in the UI') {
  return `No supported LLM provider is configured. Add an API key ${where} or configure ${getLlmProviderServerApiKeyNames().join(', ')} on the server.`;
}
