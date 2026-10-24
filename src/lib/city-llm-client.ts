import {
  CITY_GENERATION_DEFAULT_MODELS,
  CITY_GENERATION_DEFAULT_REASONING_EFFORT,
  getAnthropicThinkingMode,
  getAnthropicWebSearchToolType,
  getCityGenerationThinkingBudget,
  geminiUsesThinkingLevel,
  resolveProviderRequestEffort,
  type CityGenerationProvider,
  type CityGenerationReasoningEffort,
} from '@/lib/city-generation-config';
import { analyticsLlmFetch } from '@/lib/analytics/llm';
import { analyticsContext } from '@/lib/analytics/context';
import { createLlmRequestSignal, waitForLlmRetry } from '@/lib/llm-request-signal';
import { resolveLlmRuntimeDefaults } from '@/lib/llm-request-limits';
import { describeLlmRequestFailure, formatProviderHttpError, summarizeProviderError } from '@/lib/llm-error-messages';
import {
  LLM_PROVIDER_SPECS,
  groqModelSupportsBrowserSearch,
  type LlmProviderSpec,
} from '@/lib/llm-provider-registry';

export interface JsonPromptResult {
  provider: string;
  model: string;
  text: string;
  webSearchUsed: boolean;
  reasoningEffort?: CityGenerationReasoningEffort;
}

function normalizeApiKey(apiKey?: string) {
  const trimmed = apiKey?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeModel(model?: string) {
  const trimmed = model?.trim();
  return trimmed ? trimmed : undefined;
}

async function fetchProvider(url: string, init: RequestInit, provider: string, deadline: number, timeoutMs: number, apiKey: string) {
  init.signal?.throwIfAborted();
  try {
    return await analyticsLlmFetch(url, { ...init, signal: createLlmRequestSignal(deadline - Date.now(), init.signal ?? undefined) });
  } catch (err) {
    init.signal?.throwIfAborted();
    throw new Error(describeLlmRequestFailure(err, provider, timeoutMs, apiKey));
  }
}

function getRetryDelayMsFromHeaders(headers: Headers) {
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds * 1000);
    }
  }

  const resetHeader =
    headers.get('anthropic-ratelimit-input-tokens-reset') ||
    headers.get('anthropic-ratelimit-output-tokens-reset') ||
    headers.get('anthropic-ratelimit-requests-reset') ||
    headers.get('anthropic-ratelimit-tokens-reset');

  if (resetHeader) {
    const resetAt = Date.parse(resetHeader);
    if (Number.isFinite(resetAt)) {
      return Math.max(resetAt - Date.now(), 0);
    }
  }

  return null;
}

type ProviderRunnerParams = {
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  reasoningEffort?: CityGenerationReasoningEffort;
  requireWebSearch?: boolean;
  requestTimeoutMs?: number;
  signal?: AbortSignal;
};

function resolveRunnerBasics(spec: LlmProviderSpec, params: ProviderRunnerParams) {
  const apiKey = normalizeApiKey(params.apiKey) ?? normalizeApiKey(process.env[spec.envKey]);
  const model = normalizeModel(params.model) ?? spec.defaultModel;
  const defaults = resolveLlmRuntimeDefaults();
  const timeoutMs = params.requestTimeoutMs ?? defaults.requestTimeoutMs;
  return {
    apiKey,
    model,
    maxOutputTokens: params.maxTokens ?? defaults.maxOutputTokens,
    timeoutMs,
    deadline: Date.now() + timeoutMs,
  };
}

/** Removes `<think>…</think>` blocks that some reasoning models put before their answer. */
function stripThinkBlocks(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/** OpenAI Responses API, also served by xAI with the same request shape and web_search tool. */
async function runResponsesJsonPrompt(spec: LlmProviderSpec, params: ProviderRunnerParams): Promise<JsonPromptResult | null> {
  const basics = resolveRunnerBasics(spec, params);
  const apiKey = basics.apiKey;
  if (!apiKey) return null;

  const model = spec.id === 'openai'
    ? normalizeModel(params.model) ?? (process.env.OPENAI_MODEL || CITY_GENERATION_DEFAULT_MODELS.openai)
    : basics.model;
  const { maxOutputTokens, timeoutMs, deadline } = basics;
  let effort = resolveProviderRequestEffort(spec.id, model, params.reasoningEffort)
    ?? (params.reasoningEffort === undefined && model === CITY_GENERATION_DEFAULT_MODELS[spec.id]
      ? resolveProviderRequestEffort(spec.id, model, CITY_GENERATION_DEFAULT_REASONING_EFFORT)
      : undefined);
  while (true) {
    const requestBody: Record<string, unknown> = {
      model,
      instructions: params.systemPrompt,
      input: params.userPrompt,
      max_output_tokens: maxOutputTokens,
      store: false,
    };

    if (!params.requireWebSearch) {
      requestBody.text = { format: { type: 'json_object' } };
    }

    if (effort) {
      requestBody.reasoning = { effort };
    }
    if (params.requireWebSearch) {
      requestBody.tools = [{ type: 'web_search' }];
      requestBody.tool_choice = 'required';
    }

    const response = await fetchProvider(`${spec.baseUrl}/responses`, {
      method: 'POST',
      signal: params.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }, spec.label, deadline, timeoutMs, apiKey);

    if (!response.ok) {
      throw new Error(formatProviderHttpError(spec.label, response.status, await response.text(), apiKey));
    }

    const data = await response.json();
    console.info(`[city-generation] ${spec.id} model=${model} effort=${effort ?? 'default'} status=${data.status ?? 'unknown'} output_tokens=${data.usage?.output_tokens ?? 'unknown'} reasoning_tokens=${data.usage?.output_tokens_details?.reasoning_tokens ?? 'unknown'}`);
    if (data.status === 'incomplete') {
      if (data.incomplete_details?.reason === 'max_output_tokens') {
        const lowerEffort = effort === 'max' ? 'xhigh' : effort === 'xhigh' ? 'high' : undefined;
        if (lowerEffort && Date.now() < deadline) {
          effort = lowerEffort;
          continue;
        }
        throw new Error(`${spec.label} reached the ${maxOutputTokens}-token output limit before completing its answer. Lower reasoning effort or raise the output limit in Settings → Provider Request Limits. No estimate was saved.`);
      }
      throw new Error(`${spec.label} did not complete its answer (${data.incomplete_details?.reason ?? 'unknown reason'}). No estimate was saved.`);
    }
    if (data.status === 'failed' || data.error) {
      const detail = data.error ? summarizeProviderError(JSON.stringify({ error: data.error }), apiKey) : 'No error details were returned.';
      throw new Error(`${spec.label} failed to complete the generation request: ${detail} Try again. No estimate was saved.`);
    }
    const output = Array.isArray(data.output) ? data.output as Array<{ type?: string; status?: string }> : [];
    // xAI also reports server-side tool use and citations outside the output items.
    const serverToolUsage = data.server_side_tool_usage && typeof data.server_side_tool_usage === 'object'
      ? Object.entries(data.server_side_tool_usage as Record<string, unknown>)
      : [];
    const webSearchUsed = output.some((item) => item.type === 'web_search_call' && (!item.status || item.status === 'completed'))
      || serverToolUsage.some(([name, count]) => /WEB_SEARCH/i.test(name) && Number(count) > 0)
      || (spec.id === 'xai' && Array.isArray(data.citations) && data.citations.length > 0);
    const text = data.output_text || data.output
      ?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
      .map((item: { text?: string }) => item.text || '')
      .join('') || '';
    if (!text.trim()) throw new Error(`${spec.label} returned no answer. No estimate was saved.`);
    return { provider: spec.id, model, text, webSearchUsed, reasoningEffort: effort };
  }
}

/** Anthropic thinking fields: adaptive thinking with `output_config.effort` on Claude 4.6+, a token budget before that. */
export function buildAnthropicThinkingFields(model: string, effort: CityGenerationReasoningEffort | undefined, outputLimit: number) {
  if (!effort) return {};
  if (getAnthropicThinkingMode(model) === 'adaptive') {
    return effort === 'none'
      ? { thinking: { type: 'disabled' } }
      : { thinking: { type: 'adaptive' }, output_config: { effort } };
  }
  const requested = effort === 'none' ? 0 : getCityGenerationThinkingBudget(effort);
  const budget = outputLimit >= 2524 ? Math.min(requested, outputLimit - 1500) : 0;
  return budget > 0 ? { thinking: { type: 'enabled', budget_tokens: budget } } : {};
}

/** Gemini thinking: `thinkingLevel` on Gemini 3 and later, `thinkingBudget` on Gemini 2.5. */
export function buildGeminiThinkingConfig(model: string, effort: CityGenerationReasoningEffort | undefined) {
  if (!effort) return undefined;
  if (geminiUsesThinkingLevel(model)) return effort === 'none' ? undefined : { thinkingLevel: effort };
  return { thinkingBudget: getCityGenerationThinkingBudget(effort) };
}

async function runAnthropicJsonPrompt(params: ProviderRunnerParams): Promise<JsonPromptResult | null> {
  const apiKey = normalizeApiKey(params.apiKey) ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model =
    normalizeModel(params.model) ?? (process.env.ANTHROPIC_MODEL || CITY_GENERATION_DEFAULT_MODELS.anthropic);
  const timeoutMs = params.requestTimeoutMs ?? resolveLlmRuntimeDefaults().requestTimeoutMs;
  const deadline = Date.now() + timeoutMs;
  const effort = resolveProviderRequestEffort('anthropic', model, params.reasoningEffort);
  let data: { content?: Array<{ type?: string; text?: string }> } | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const outputLimit = params.maxTokens ?? resolveLlmRuntimeDefaults().maxOutputTokens;
    const requestBody: Record<string, unknown> = {
      model,
      max_tokens: outputLimit,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userPrompt }],
      ...buildAnthropicThinkingFields(model, effort, outputLimit),
    };
    if (params.requireWebSearch) {
      requestBody.tools = [{ type: getAnthropicWebSearchToolType(model), name: 'web_search', max_uses: 1 }];
    }

    const response = await fetchProvider('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: params.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    }, 'Anthropic', deadline, timeoutMs, apiKey);

    if (response.ok) {
      data = await response.json();
      break;
    }

    const errText = await response.text();
    if (response.status === 429 && attempt < 1) {
      const retryDelayMs = getRetryDelayMsFromHeaders(response.headers) ?? 5000;
      await waitForLlmRetry(Math.min(Math.max(retryDelayMs, 3000), 15000, Math.max(0, deadline - Date.now())), params.signal);
      continue;
    }

    throw new Error(formatProviderHttpError('Anthropic', response.status, errText, apiKey));
  }

  if (!data) {
    throw new Error('Anthropic API returned no response body.');
  }

  const text = data.content?.filter((item) => item.type === 'text').map((item) => item.text || '').join('\n') || '';
  const webSearchUsed = Boolean(data.content?.some((item) => item.type === 'server_tool_use' || item.type === 'web_search_tool_result'));
  return { provider: 'anthropic', model, text, webSearchUsed, reasoningEffort: effort };
}

async function runGeminiJsonPrompt(params: ProviderRunnerParams): Promise<JsonPromptResult | null> {
  const apiKey = normalizeApiKey(params.apiKey) ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = normalizeModel(params.model) ?? (process.env.GEMINI_MODEL || CITY_GENERATION_DEFAULT_MODELS.gemini);
  const timeoutMs = params.requestTimeoutMs ?? resolveLlmRuntimeDefaults().requestTimeoutMs;
  const deadline = Date.now() + timeoutMs;
  const effort = resolveProviderRequestEffort('gemini', model, params.reasoningEffort);
  const thinkingConfig = buildGeminiThinkingConfig(model, effort);
  let data: {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
      groundingMetadata?: { webSearchQueries?: string[]; groundingChunks?: unknown[] };
    }>;
  } | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchProvider(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        signal: params.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: params.systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: params.userPrompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: params.maxTokens ?? 3000,
            ...(thinkingConfig ? { thinkingConfig } : {}),
          },
          ...(params.requireWebSearch ? { tools: [{ googleSearch: {} }] } : {}),
        }),
      }, 'Gemini', deadline, timeoutMs, apiKey
    );

    if (response.ok) {
      data = await response.json();
      break;
    }

    const errText = await response.text();
    if ((response.status === 429 || response.status === 503) && attempt < 1) {
      await waitForLlmRetry(Math.min(4000 * (attempt + 1), Math.max(0, deadline - Date.now())), params.signal);
      continue;
    }

    throw new Error(formatProviderHttpError('Gemini', response.status, errText, apiKey));
  }

  if (!data) {
    throw new Error('Gemini API returned no response body.');
  }

  const finishReason = data.candidates?.[0]?.finishReason;
  if (finishReason === 'MAX_TOKENS') {
    throw new Error(
      'Gemini stopped before finishing the JSON response. Try the same request again or use a model with a larger output budget.'
    );
  }

  const text =
    data.candidates?.[0]?.content?.parts?.filter((item) => !item.thought).map((item) => item.text || '').join('\n') || '';

  const grounding = data.candidates?.[0]?.groundingMetadata;
  const webSearchUsed = Boolean(grounding?.webSearchQueries?.length || grounding?.groundingChunks?.length);
  return { provider: 'gemini', model, text, webSearchUsed, reasoningEffort: effort };
}

function readChatMessageText(content: unknown) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''))
      .join('');
  }
  return '';
}

/**
 * OpenAI-style Chat Completions: OpenRouter, Groq, Z.ai, DeepSeek, Together, Fireworks and Cerebras.
 * Web search uses each provider's own mechanism; providers without one refuse a request that
 * requires it rather than answering ungrounded.
 */
async function runChatCompletionsJsonPrompt(spec: LlmProviderSpec, params: ProviderRunnerParams): Promise<JsonPromptResult | null> {
  const { apiKey, model, maxOutputTokens, timeoutMs, deadline } = resolveRunnerBasics(spec, params);
  if (!apiKey) return null;

  if (params.requireWebSearch) {
    if (!spec.webSearch) {
      throw new Error(`${spec.label} has no server-side web search, which this request requires. Choose a provider with web search. No estimate was saved.`);
    }
    if (spec.webSearch === 'groq-browser-search' && !groqModelSupportsBrowserSearch(model)) {
      throw new Error(`Groq web search is available only on its openai/gpt-oss models; ${model} cannot perform the required lookup. No estimate was saved.`);
    }
  }

  const effort = resolveProviderRequestEffort(spec.id, model, params.reasoningEffort);
  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
    [spec.maxTokensField ?? 'max_tokens']: maxOutputTokens,
  };

  if (effort) {
    if (spec.effortParam === 'openrouter-reasoning') requestBody.reasoning = { effort };
    if (spec.effortParam === 'reasoning_effort') requestBody.reasoning_effort = effort;
    if (spec.effortParam === 'deepseek-thinking') {
      requestBody.thinking = { type: effort === 'none' ? 'disabled' : 'enabled' };
      if (effort !== 'none') requestBody.reasoning_effort = effort;
    }
  }

  if (params.requireWebSearch) {
    if (spec.webSearch === 'openrouter-plugin') requestBody.plugins = [{ id: 'web' }];
    if (spec.webSearch === 'groq-browser-search') {
      requestBody.tools = [{ type: 'browser_search' }];
      requestBody.tool_choice = 'required';
    }
    if (spec.webSearch === 'zai-tool') {
      requestBody.tools = [{ type: 'web_search', web_search: { enable: true, search_result: true } }];
    }
  }

  const response = await fetchProvider(`${spec.baseUrl}/chat/completions`, {
    method: 'POST',
    signal: params.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  }, spec.label, deadline, timeoutMs, apiKey);

  if (!response.ok) {
    throw new Error(formatProviderHttpError(spec.label, response.status, await response.text(), apiKey));
  }

  const data = await response.json() as {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: unknown; annotations?: Array<{ type?: string }>; executed_tools?: unknown[] };
    }>;
    web_search?: unknown[];
    citations?: unknown[];
    error?: unknown;
  };
  if (data.error) {
    throw new Error(`${spec.label} failed to complete the request: ${summarizeProviderError(JSON.stringify({ error: data.error }), apiKey)} No estimate was saved.`);
  }
  const choice = data.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new Error(`${spec.label} reached the ${maxOutputTokens}-token output limit before completing its answer. Lower reasoning effort or raise the output limit in Settings → Provider Request Limits. No estimate was saved.`);
  }
  const text = stripThinkBlocks(readChatMessageText(choice?.message?.content));
  if (!text) throw new Error(`${spec.label} returned no answer. No estimate was saved.`);

  const annotations = choice?.message?.annotations ?? [];
  const webSearchUsed = Boolean(params.requireWebSearch) && (
    annotations.some((annotation) => annotation?.type === 'url_citation')
    || (Array.isArray(choice?.message?.executed_tools) && choice.message.executed_tools.length > 0)
    || (Array.isArray(data.web_search) && data.web_search.length > 0)
    || (Array.isArray(data.citations) && data.citations.length > 0)
  );
  return { provider: spec.id, model, text, webSearchUsed, reasoningEffort: effort };
}

/** Perplexity Sonar: every request searches; the response lists its sources. */
async function runSonarJsonPrompt(spec: LlmProviderSpec, params: ProviderRunnerParams): Promise<JsonPromptResult | null> {
  const { apiKey, model, maxOutputTokens, timeoutMs, deadline } = resolveRunnerBasics(spec, params);
  if (!apiKey) return null;

  const response = await fetchProvider(`${spec.baseUrl}/sonar`, {
    method: 'POST',
    signal: params.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      max_tokens: maxOutputTokens,
    }),
  }, spec.label, deadline, timeoutMs, apiKey);

  if (!response.ok) {
    throw new Error(formatProviderHttpError(spec.label, response.status, await response.text(), apiKey));
  }

  const data = await response.json() as {
    choices?: Array<{ finish_reason?: string; message?: { content?: unknown } }>;
    citations?: unknown[];
    search_results?: unknown[];
  };
  const choice = data.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new Error(`${spec.label} reached the ${maxOutputTokens}-token output limit before completing its answer. Raise the output limit in Settings → Provider Request Limits. No estimate was saved.`);
  }
  const text = stripThinkBlocks(readChatMessageText(choice?.message?.content));
  if (!text) throw new Error(`${spec.label} returned no answer. No estimate was saved.`);
  const webSearchUsed = (Array.isArray(data.search_results) && data.search_results.length > 0)
    || (Array.isArray(data.citations) && data.citations.length > 0);
  return { provider: spec.id, model, text, webSearchUsed };
}

/** Mistral Conversations API, the only Mistral endpoint with the built-in web_search tool. */
async function runMistralJsonPrompt(spec: LlmProviderSpec, params: ProviderRunnerParams): Promise<JsonPromptResult | null> {
  const { apiKey, model, maxOutputTokens, timeoutMs, deadline } = resolveRunnerBasics(spec, params);
  if (!apiKey) return null;

  const response = await fetchProvider(`${spec.baseUrl}/conversations`, {
    method: 'POST',
    signal: params.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: params.systemPrompt,
      inputs: params.userPrompt,
      tools: params.requireWebSearch ? [{ type: 'web_search' }] : [],
      completion_args: { max_tokens: maxOutputTokens },
      store: false,
    }),
  }, spec.label, deadline, timeoutMs, apiKey);

  if (!response.ok) {
    throw new Error(formatProviderHttpError(spec.label, response.status, await response.text(), apiKey));
  }

  const data = await response.json() as {
    outputs?: Array<{ type?: string; name?: string; content?: unknown }>;
  };
  const outputs = data.outputs ?? [];
  const text = stripThinkBlocks(
    outputs
      .filter((entry) => entry.type === 'message.output')
      .map((entry) => readChatMessageText(entry.content))
      .join('')
  );
  if (!text) throw new Error(`${spec.label} returned no answer. No estimate was saved.`);
  const webSearchUsed = outputs.some((entry) => entry.type === 'tool.execution' && /^web_search/.test(entry.name ?? ''));
  return { provider: spec.id, model, text, webSearchUsed };
}

function runProviderJsonPrompt(provider: CityGenerationProvider, params: ProviderRunnerParams) {
  const spec = LLM_PROVIDER_SPECS[provider];
  switch (spec.transport) {
    case 'openai-responses': return runResponsesJsonPrompt(spec, params);
    case 'anthropic-messages': return runAnthropicJsonPrompt(params);
    case 'gemini-generate-content': return runGeminiJsonPrompt(params);
    case 'chat-completions': return runChatCompletionsJsonPrompt(spec, params);
    case 'perplexity-sonar': return runSonarJsonPrompt(spec, params);
    case 'mistral-conversations': return runMistralJsonPrompt(spec, params);
  }
}

export type JsonPromptParams = {
  systemPrompt: string;
  userPrompt: string;
  provider?: CityGenerationProvider;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  reasoningEffort?: CityGenerationReasoningEffort;
  requireWebSearch?: boolean;
  requestTimeoutMs?: number;
  signal?: AbortSignal;
};

let externalRunner: ((params: JsonPromptParams) => Promise<JsonPromptResult | null>) | null = null;

/**
 * For offline scripts only: answer provider calls with responses produced outside the app (for
 * example by a Claude Code subagent given the identical prompt), while everything around the call
 * (identity, validation, formulas, persistence, climate and photo) runs unchanged. The app never
 * sets this. Pass null to restore normal provider calls.
 */
export function setExternalJsonPromptRunner(runner: typeof externalRunner) {
  externalRunner = runner;
}

export async function runJsonPromptWithProvider(params: JsonPromptParams) {
  const context = analyticsContext.getStore();
  if (context) { context.llmRequestedEffort = params.reasoningEffort; context.llmTimeoutMs = params.requestTimeoutMs ?? context.llmTimeoutMs; }
  if (externalRunner) return externalRunner(params);
  // Without an explicit provider, try the three original server-key providers in their historical order.
  const providerOrder: CityGenerationProvider[] = params.provider
    ? [params.provider]
    : ['anthropic', 'openai', 'gemini'];

  for (const provider of providerOrder) {
    const result = await runProviderJsonPrompt(provider, {
      systemPrompt: params.systemPrompt,
      userPrompt: params.userPrompt,
      apiKey: params.apiKey,
      model: params.model,
      reasoningEffort: params.reasoningEffort,
      maxTokens: params.maxTokens,
      requireWebSearch: params.requireWebSearch,
      requestTimeoutMs: params.requestTimeoutMs,
      signal: params.signal,
    });

    if (result) {
      return result;
    }
  }

  return null;
}
