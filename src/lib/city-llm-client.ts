import {
  CITY_GENERATION_DEFAULT_MODELS,
  CITY_GENERATION_DEFAULT_REASONING_EFFORT,
  getCityGenerationThinkingBudget,
  type CityGenerationProvider,
  type CityGenerationReasoningEffort,
} from '@/lib/city-generation-config';
import { createLlmRequestSignal, waitForLlmRetry } from '@/lib/llm-request-signal';
import { resolveLlmRuntimeDefaults } from '@/lib/llm-request-limits';
import { describeLlmRequestFailure, formatProviderHttpError, summarizeProviderError } from '@/lib/llm-error-messages';

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
    return await fetch(url, { ...init, signal: createLlmRequestSignal(deadline - Date.now(), init.signal ?? undefined) });
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

async function runOpenAiJsonPrompt(params: {
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  reasoningEffort?: CityGenerationReasoningEffort;
  requireWebSearch?: boolean;
  requestTimeoutMs?: number;
  signal?: AbortSignal;
}): Promise<JsonPromptResult | null> {
  const apiKey = normalizeApiKey(params.apiKey) ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = normalizeModel(params.model) ?? (process.env.OPENAI_MODEL || CITY_GENERATION_DEFAULT_MODELS.openai);
  const defaults = resolveLlmRuntimeDefaults();
  const maxOutputTokens = params.maxTokens ?? defaults.maxOutputTokens;
  const timeoutMs = params.requestTimeoutMs ?? defaults.requestTimeoutMs;
  const deadline = Date.now() + timeoutMs;
  let effort = params.reasoningEffort ?? (model === CITY_GENERATION_DEFAULT_MODELS.openai
    ? CITY_GENERATION_DEFAULT_REASONING_EFFORT
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

    const response = await fetchProvider('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: params.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }, 'OpenAI', deadline, timeoutMs, apiKey);

    if (!response.ok) {
      throw new Error(formatProviderHttpError('OpenAI', response.status, await response.text(), apiKey));
    }

    const data = await response.json();
    console.info(`[city-generation] openai model=${model} effort=${effort ?? 'default'} status=${data.status ?? 'unknown'} output_tokens=${data.usage?.output_tokens ?? 'unknown'} reasoning_tokens=${data.usage?.output_tokens_details?.reasoning_tokens ?? 'unknown'}`);
    if (data.status === 'incomplete') {
      if (data.incomplete_details?.reason === 'max_output_tokens') {
        const lowerEffort = effort === 'max' ? 'xhigh' : effort === 'xhigh' ? 'high' : undefined;
        if (lowerEffort && Date.now() < deadline) {
          effort = lowerEffort;
          continue;
        }
        throw new Error(`OpenAI reached the ${maxOutputTokens}-token output limit before completing its answer. Lower reasoning effort or raise the output limit in Settings → Provider Request Limits. No estimate was saved.`);
      }
      throw new Error(`OpenAI did not complete its answer (${data.incomplete_details?.reason ?? 'unknown reason'}). No estimate was saved.`);
    }
    if (data.status === 'failed' || data.error) {
      const detail = data.error ? summarizeProviderError(JSON.stringify({ error: data.error }), apiKey) : 'No error details were returned.';
      throw new Error(`OpenAI failed to complete the generation request: ${detail} Try again. No estimate was saved.`);
    }
    const webSearchUsed = Array.isArray(data.output) && data.output.some((item: { type?: string; status?: string }) => item.type === 'web_search_call' && (!item.status || item.status === 'completed'));
    const text = data.output_text || data.output
      ?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
      .map((item: { text?: string }) => item.text || '')
      .join('') || '';
    if (!text.trim()) throw new Error('OpenAI returned no answer. No estimate was saved.');
    return { provider: 'openai', model, text, webSearchUsed, reasoningEffort: effort };
  }
}

async function runAnthropicJsonPrompt(params: {
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  reasoningEffort?: CityGenerationReasoningEffort;
  requireWebSearch?: boolean;
  requestTimeoutMs?: number;
  signal?: AbortSignal;
}) {
  const apiKey = normalizeApiKey(params.apiKey) ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model =
    normalizeModel(params.model) ?? (process.env.ANTHROPIC_MODEL || CITY_GENERATION_DEFAULT_MODELS.anthropic);
  const timeoutMs = params.requestTimeoutMs ?? resolveLlmRuntimeDefaults().requestTimeoutMs;
  const deadline = Date.now() + timeoutMs;
  let data: { content?: Array<{ type?: string; text?: string }> } | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const outputLimit = params.maxTokens ?? resolveLlmRuntimeDefaults().maxOutputTokens;
    const requestedThinkingBudget = params.reasoningEffort && params.reasoningEffort !== 'none'
      ? getCityGenerationThinkingBudget(params.reasoningEffort)
      : 0;
    const thinkingBudget = outputLimit >= 2524 ? Math.min(requestedThinkingBudget, outputLimit - 1500) : 0;
    const requestBody: Record<string, unknown> = {
      model,
      max_tokens: outputLimit,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userPrompt }],
    };
    if (thinkingBudget > 0) {
      requestBody.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
    }
    if (params.requireWebSearch) {
      requestBody.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }];
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

  const text = data.content?.map((item: { text?: string }) => item.text || '').join('\n') || '';
  const webSearchUsed = Boolean(data.content?.some((item) => item.type === 'server_tool_use' || item.type === 'web_search_tool_result'));
  return { provider: 'anthropic', model, text, webSearchUsed };
}

async function runGeminiJsonPrompt(params: {
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  reasoningEffort?: CityGenerationReasoningEffort;
  requireWebSearch?: boolean;
  requestTimeoutMs?: number;
      signal?: AbortSignal;
}) {
  const apiKey = normalizeApiKey(params.apiKey) ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = normalizeModel(params.model) ?? (process.env.GEMINI_MODEL || CITY_GENERATION_DEFAULT_MODELS.gemini);
  const timeoutMs = params.requestTimeoutMs ?? resolveLlmRuntimeDefaults().requestTimeoutMs;
  const deadline = Date.now() + timeoutMs;
  let data: {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
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
            thinkingConfig: {
              thinkingBudget: getCityGenerationThinkingBudget(params.reasoningEffort),
            },
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
    data.candidates?.[0]?.content?.parts?.map((item: { text?: string }) => item.text || '').join('\n') || '';

  const grounding = data.candidates?.[0]?.groundingMetadata;
  const webSearchUsed = Boolean(grounding?.webSearchQueries?.length || grounding?.groundingChunks?.length);
  return { provider: 'gemini', model, text, webSearchUsed };
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
  if (externalRunner) return externalRunner(params);
  const providerOrder: CityGenerationProvider[] = params.provider
    ? [params.provider]
    : ['anthropic', 'openai', 'gemini'];

  const runners: Record<
    CityGenerationProvider,
    (runnerParams: {
      systemPrompt: string;
      userPrompt: string;
      apiKey?: string;
      model?: string;
      maxTokens?: number;
      reasoningEffort?: CityGenerationReasoningEffort;
      requireWebSearch?: boolean;
      requestTimeoutMs?: number;
      signal?: AbortSignal;
    }) => Promise<JsonPromptResult | null>
  > = {
    anthropic: runAnthropicJsonPrompt,
    openai: runOpenAiJsonPrompt,
    gemini: runGeminiJsonPrompt,
  };

  for (const provider of providerOrder) {
    const result = await runners[provider]({
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
