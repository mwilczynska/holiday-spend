import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { runJsonPromptWithProvider } from '@/lib/city-llm-client';
import {
  CITY_GENERATION_DEFAULT_MODELS,
  type CityGenerationProvider,
} from '@/lib/city-generation-config';
import type {
  TransportEstimateCitation,
  TransportEstimateMode,
  TransportEstimateOption,
} from '@/types';

const transportEstimateModeSchema = z.enum(['flight', 'train', 'bus', 'ferry', 'drive', 'rental_car']);

const transportEstimateOptionSchema = z.object({
  mode: transportEstimateModeSchema,
  label: z.string().min(1),
  total_aud: z.number().nonnegative(),
  confidence: z.enum(['low', 'medium', 'high']),
  source_basis: z.string().min(1),
  notes: z.string().min(1),
  reasons: z.array(z.string().min(1)).default([]),
  applied_assumptions: z.array(z.string().min(1)).default([]),
  transport_row_draft: z.object({
    mode: z.string().min(1),
    note: z.string().nullable().optional(),
    cost: z.number().nonnegative(),
  }),
});

const transportEstimatePayloadSchema = z.object({
  assumptions: z.array(z.string().min(1)).default([]),
  options: z.array(transportEstimateOptionSchema).max(4).default([]),
});

export interface TransportEstimationRequest {
  originCity: string;
  originCountry: string;
  destinationCity: string;
  destinationCountry: string;
  travelDate: string;
  groupSize: number;
  allowedModes: TransportEstimateMode[];
  referenceDate?: string;
  extraContext?: string;
  provider?: CityGenerationProvider;
  apiKey?: string;
  model?: string;
  routeFacts?: string[];
}

export interface TransportEstimationResult {
  assumptions: string[];
  options: TransportEstimateOption[];
  providerResult: {
    provider: string;
    model: string;
    promptVersion: string;
    usedWebSearch: boolean;
    fallbackReason: string | null;
    searchQueries: string[];
    citations: TransportEstimateCitation[];
  };
}

export class TransportEstimationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'TransportEstimationError';
    this.status = status;
  }
}

interface ProviderTransportResponse {
  provider: CityGenerationProvider;
  model: string;
  text: string;
  usedWebSearch: boolean;
  fallbackReason: string | null;
  searchQueries: string[];
  citations: TransportEstimateCitation[];
}

const BROWSE_TRANSPORT_MAX_TOKENS = 900;
const FALLBACK_TRANSPORT_MAX_TOKENS = 650;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('No JSON object found in model response');
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidates = fencedMatch ? [fencedMatch[1], trimmed] : [trimmed];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Fall through to object extraction.
    }

    const starts: number[] = [];
    for (let index = 0; index < candidate.length; index += 1) {
      if (candidate[index] === '{') starts.push(index);
    }

    for (const start of starts) {
      let depth = 0;
      let inString = false;
      let escaping = false;

      for (let end = start; end < candidate.length; end += 1) {
        const char = candidate[end];

        if (inString) {
          if (escaping) {
            escaping = false;
          } else if (char === '\\') {
            escaping = true;
          } else if (char === '"') {
            inString = false;
          }
          continue;
        }

        if (char === '"') {
          inString = true;
          continue;
        }

        if (char === '{') depth += 1;
        if (char === '}') {
          depth -= 1;

          if (depth === 0) {
            const slice = candidate.slice(start, end + 1);
            try {
              return JSON.parse(slice);
            } catch {
              break;
            }
          }
        }
      }
    }
  }

  throw new Error('No parseable JSON object found in model response');
}

function findRepoFile(fileName: string) {
  const candidates = [path.resolve(process.cwd(), fileName), path.resolve(process.cwd(), '..', fileName)];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`Expected file was not found. Tried: ${candidates.join(', ')}`);
}

function loadPromptTemplate(): string {
  const promptPath = findRepoFile('llm_prompt_intercity_transport_1.md');
  return fs.readFileSync(promptPath, 'utf8');
}

function normalizeApiKey(apiKey?: string) {
  const trimmed = apiKey?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeModel(model?: string) {
  const trimmed = model?.trim();
  return trimmed ? trimmed : undefined;
}

function summarizeProviderError(rawText: string) {
  const text = rawText.trim();
  if (!text) return 'Empty error body';

  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    if (typeof parsed.error === 'string') return parsed.error;
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
  } catch {
    // Fall back to plain text when the provider does not return JSON.
  }

  return text.slice(0, 400);
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

function getMissingKeyMessage(provider: CityGenerationProvider) {
  if (provider === 'anthropic') {
    return 'No Anthropic API key provided. Add one in the planner dialog or configure ANTHROPIC_API_KEY on the server.';
  }
  if (provider === 'openai') {
    return 'No OpenAI API key provided. Add one in the planner dialog or configure OPENAI_API_KEY on the server.';
  }
  return 'No Gemini API key provided. Add one in the planner dialog or configure GEMINI_API_KEY on the server.';
}

function toTitleMode(mode: TransportEstimateMode) {
  if (mode === 'rental_car') return 'Rental car';
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function dedupeCitations(citations: TransportEstimateCitation[]) {
  const seen = new Set<string>();
  const normalized: TransportEstimateCitation[] = [];

  for (const citation of citations) {
    const url = citation.url.trim();
    if (!url) continue;

    const title = citation.title?.trim() || null;
    const key = `${url}::${title || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ url, title });
  }

  return normalized;
}

function extractCitationLikeValues(rawValue: unknown): TransportEstimateCitation[] {
  if (!Array.isArray(rawValue)) return [];

  return rawValue.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as { url?: unknown; title?: unknown };
    if (typeof candidate.url !== 'string' || !candidate.url.trim()) return [];

    return [{
      url: candidate.url.trim(),
      title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : null,
    }];
  });
}

function normalizeOptions(options: z.infer<typeof transportEstimateOptionSchema>[]): TransportEstimateOption[] {
  const seenModes = new Set<TransportEstimateMode>();
  const normalized: TransportEstimateOption[] = [];

  for (const option of options) {
    if (seenModes.has(option.mode)) continue;
    seenModes.add(option.mode);

    const totalAud = Math.round(option.total_aud);
    const modeLabel = option.transport_row_draft.mode?.trim() || toTitleMode(option.mode);
    const note = option.transport_row_draft.note?.trim() || option.notes.trim();

    normalized.push({
      mode: option.mode,
      label: option.label.trim(),
      totalAud,
      confidence: option.confidence,
      sourceBasis: option.source_basis.trim(),
      notes: option.notes.trim(),
      reasons: option.reasons.slice(0, 3),
      appliedAssumptions: option.applied_assumptions.slice(0, 4),
      transportRowDraft: {
        mode: modeLabel,
        note: note || null,
        cost: totalAud,
      },
    });
  }

  return normalized.slice(0, 4);
}

function buildTransportSystemPrompt(provider: CityGenerationProvider) {
  const basePrompt = 'Return valid JSON only for intercity transport cost estimation.';

  if (provider === 'openai') {
    return `${basePrompt} Use the built-in web search tool when it is available and relevant.`;
  }
  if (provider === 'anthropic') {
    return `${basePrompt} Use the available web search tool when it is available and relevant.`;
  }
  return `${basePrompt} Use Google Search grounding when it is available and relevant.`;
}

export function buildTransportEstimationPrompt(request: TransportEstimationRequest): {
  prompt: string;
  promptVersion: string;
} {
  const promptVersion = 'llm_prompt_intercity_transport_1.md';
  const basePrompt = loadPromptTemplate();
  const referenceDateLine = request.referenceDate?.trim()
    ? `Reference date or booking context: ${request.referenceDate.trim()}`
    : 'Reference date or booking context: current pricing expectations';
  const extraContextLine = request.extraContext?.trim()
    ? `Additional context: ${request.extraContext.trim()}`
    : 'Additional context: none';
  const routeFacts = request.routeFacts && request.routeFacts.length > 0
    ? request.routeFacts.map((fact) => `- ${fact}`).join('\n')
    : '- No extra route facts supplied.';

  const prompt = `${basePrompt}

Estimate transport options for this route:
- Origin: ${request.originCity}, ${request.originCountry}
- Destination: ${request.destinationCity}, ${request.destinationCountry}
- Travel date: ${request.travelDate}
- Travellers: ${request.groupSize}
- Allowed modes: ${request.allowedModes.join(', ')}
- ${referenceDateLine}
- ${extraContextLine}

Route facts:
${routeFacts}

If browsing, live search, or grounding is available in your runtime, use it.
If it is not available, estimate conservatively and say that clearly in source_basis or notes.

Return JSON only.`;

  return { prompt, promptVersion };
}

async function runOpenAiTransportPromptWithWebSearch(params: {
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}): Promise<ProviderTransportResponse | null> {
  const apiKey = normalizeApiKey(params.apiKey) ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = normalizeModel(params.model) ?? (process.env.OPENAI_MODEL || CITY_GENERATION_DEFAULT_MODELS.openai);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: params.systemPrompt,
      input: params.userPrompt,
      max_output_tokens: params.maxTokens ?? BROWSE_TRANSPORT_MAX_TOKENS,
      store: false,
      text: {
        format: {
          type: 'json_object',
        },
      },
      tools: [
        {
          type: 'web_search_preview',
          search_context_size: 'medium',
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = summarizeProviderError(await response.text());
    throw new Error(`OpenAI Responses API error ${response.status}: ${errText}`);
  }

  const data = await response.json() as {
    model?: string;
    output?: Array<{
      type?: string;
      action?: string;
      queries?: unknown;
      content?: Array<{
        type?: string;
        text?: string;
        annotations?: unknown;
        sources?: unknown;
      }>;
    }>;
  };

  const outputItems = Array.isArray(data.output) ? data.output : [];
  const messageItems = outputItems.filter((item) => item?.type === 'message');
  const textParts = messageItems.flatMap((item) =>
    Array.isArray(item.content) ? item.content.filter((part) => part?.type === 'output_text') : []
  );

  const text = textParts
    .map((part) => part.text || '')
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('OpenAI Responses API returned no text output for the transport estimate.');
  }

  const searchQueries = dedupeStrings(
    outputItems.flatMap((item) => {
      if (item?.type !== 'web_search_call') return [];
      if (!Array.isArray(item.queries)) return [];
      return item.queries.filter((query): query is string => typeof query === 'string');
    })
  );

  const citations = dedupeCitations(
    textParts.flatMap((part) => [
      ...extractCitationLikeValues(part.annotations),
      ...extractCitationLikeValues(part.sources),
    ])
  );

  return {
    provider: 'openai',
    model: typeof data.model === 'string' && data.model.trim() ? data.model : model,
    text,
    usedWebSearch: outputItems.some((item) => item?.type === 'web_search_call'),
    fallbackReason: null,
    searchQueries,
    citations,
  };
}

async function runAnthropicTransportPromptWithWebSearch(params: {
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}): Promise<ProviderTransportResponse | null> {
  const apiKey = normalizeApiKey(params.apiKey) ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model =
    normalizeModel(params.model) ?? (process.env.ANTHROPIC_MODEL || CITY_GENERATION_DEFAULT_MODELS.anthropic);
  let data: {
    model?: string;
    content?: Array<{
      type?: string;
      text?: string;
      citations?: unknown;
      name?: string;
      input?: { query?: unknown };
      error_code?: string;
      content?: unknown;
    }>;
    usage?: {
      server_tool_use?: {
        web_search_requests?: number;
      };
    };
  } | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens ?? BROWSE_TRANSPORT_MAX_TOKENS,
        system: params.systemPrompt,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 2,
          },
        ],
        messages: [{ role: 'user', content: params.userPrompt }],
      }),
    });

    if (response.ok) {
      data = await response.json();
      break;
    }

    const errText = summarizeProviderError(await response.text());
    if (response.status === 429 && attempt < 1) {
      const retryDelayMs = getRetryDelayMsFromHeaders(response.headers) ?? 5000;
      await sleep(Math.min(Math.max(retryDelayMs, 3000), 15000));
      continue;
    }

    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  if (!data) {
    throw new Error('Anthropic returned no response payload for the transport estimate.');
  }

  const contentBlocks = Array.isArray(data.content) ? data.content : [];
  const toolErrors = contentBlocks.flatMap((block) => {
    if (block?.type === 'web_search_tool_result' && block.content && typeof block.content === 'object') {
      const blockContent = block.content as { type?: unknown; error_code?: unknown };
      if (blockContent.type === 'web_search_tool_result_error') {
        return [typeof blockContent.error_code === 'string' ? blockContent.error_code : 'unknown_web_search_error'];
      }
    }

    if (block?.type === 'web_search_tool_result_error') {
      return [typeof block.error_code === 'string' ? block.error_code : 'unknown_web_search_error'];
    }

    return [];
  });

  if (toolErrors.length > 0) {
    throw new Error(`Anthropic web search tool error: ${toolErrors[0]}`);
  }

  const textBlocks = contentBlocks.filter((block) => block?.type === 'text');
  const text = textBlocks
    .map((block) => block.text || '')
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('Anthropic returned no text output for the transport estimate.');
  }

  const searchQueries = dedupeStrings(
    contentBlocks.flatMap((block) => {
      if (block?.type !== 'server_tool_use') return [];
      if (block.name !== 'web_search') return [];
      return typeof block.input?.query === 'string' ? [block.input.query] : [];
    })
  );

  const citations = dedupeCitations([
    ...textBlocks.flatMap((block) => extractCitationLikeValues(block.citations)),
    ...contentBlocks.flatMap((block) => {
      if (block?.type !== 'web_search_tool_result' || !Array.isArray(block.content)) return [];
      return block.content.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const citationEntry = entry as { url?: unknown; title?: unknown };
        if (typeof citationEntry.url !== 'string' || !citationEntry.url.trim()) return [];
        return [{
          url: citationEntry.url.trim(),
          title:
            typeof citationEntry.title === 'string' && citationEntry.title.trim() ? citationEntry.title.trim() : null,
        }];
      });
    }),
  ]);

  return {
    provider: 'anthropic',
    model: typeof data.model === 'string' && data.model.trim() ? data.model : model,
    text,
    usedWebSearch:
      contentBlocks.some((block) => block?.type === 'server_tool_use' && block.name === 'web_search') ||
      Number(data.usage?.server_tool_use?.web_search_requests || 0) > 0,
    fallbackReason: null,
    searchQueries,
    citations,
  };
}

async function runGeminiTransportPromptWithSearch(params: {
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}): Promise<ProviderTransportResponse | null> {
  const apiKey = normalizeApiKey(params.apiKey) ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = normalizeModel(params.model) ?? (process.env.GEMINI_MODEL || CITY_GENERATION_DEFAULT_MODELS.gemini);
  let data: {
    candidates?: Array<{
      finishReason?: string;
      content?: {
        parts?: Array<{ text?: string }>;
      };
      groundingMetadata?: {
        webSearchQueries?: unknown;
        groundingChunks?: Array<{
          web?: {
            uri?: string;
            title?: string;
          };
        }>;
      };
    }>;
    modelVersion?: string;
  } | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
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
          tools: [{ google_search: {} }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: params.maxTokens ?? BROWSE_TRANSPORT_MAX_TOKENS,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      }
    );

    if (response.ok) {
      data = await response.json();
      break;
    }

    const errText = summarizeProviderError(await response.text());
    if ((response.status === 429 || response.status === 503) && attempt < 1) {
      await sleep(4000 * (attempt + 1));
      continue;
    }

    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  if (!data) {
    throw new Error('Gemini returned no response payload for the transport estimate.');
  }

  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason;
  if (finishReason === 'MAX_TOKENS') {
    throw new Error(
      'Gemini stopped before finishing the JSON response. Try the same request again or use a model with a larger output budget.'
    );
  }

  const text =
    candidate?.content?.parts?.map((item) => item.text || '').join('\n').trim() || '';

  if (!text) {
    throw new Error('Gemini returned no text output for the transport estimate.');
  }

  const searchQueries = dedupeStrings(
    Array.isArray(candidate?.groundingMetadata?.webSearchQueries)
      ? candidate.groundingMetadata.webSearchQueries.filter(
          (query): query is string => typeof query === 'string'
        )
      : []
  );

  const citations = dedupeCitations(
    (candidate?.groundingMetadata?.groundingChunks || []).flatMap((chunk) => {
      if (!chunk?.web?.uri?.trim()) return [];
      return [{
        url: chunk.web.uri.trim(),
        title: chunk.web.title?.trim() || null,
      }];
    })
  );

  return {
    provider: 'gemini',
    model: typeof data.modelVersion === 'string' && data.modelVersion.trim() ? data.modelVersion : model,
    text,
    usedWebSearch: searchQueries.length > 0 || citations.length > 0,
    fallbackReason: null,
    searchQueries,
    citations,
  };
}

async function runProviderFallbackPrompt(params: {
  provider: CityGenerationProvider;
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}): Promise<ProviderTransportResponse | null> {
  const fallbackResponse = await runJsonPromptWithProvider({
    systemPrompt: `${params.systemPrompt} Output only a single JSON object with no markdown or commentary.`,
    userPrompt: params.userPrompt,
    provider: params.provider,
    apiKey: params.apiKey,
    model: params.model,
    maxTokens: params.maxTokens ?? FALLBACK_TRANSPORT_MAX_TOKENS,
  });

  if (!fallbackResponse) return null;

  return {
    provider: params.provider,
    model: fallbackResponse.model,
    text: fallbackResponse.text,
    usedWebSearch: false,
    fallbackReason: null,
    searchQueries: [],
    citations: [],
  };
}

async function runTransportPromptForProvider(params: {
  provider: CityGenerationProvider;
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}): Promise<ProviderTransportResponse | null> {
  const browseRunnerByProvider: Record<
    CityGenerationProvider,
    (runnerParams: {
      systemPrompt: string;
      userPrompt: string;
      apiKey?: string;
      model?: string;
      maxTokens?: number;
    }) => Promise<ProviderTransportResponse | null>
  > = {
    openai: runOpenAiTransportPromptWithWebSearch,
    anthropic: runAnthropicTransportPromptWithWebSearch,
    gemini: runGeminiTransportPromptWithSearch,
  };

  try {
    return await browseRunnerByProvider[params.provider](params);
  } catch (browseError) {
    const fallbackReason =
      browseError instanceof Error ? browseError.message : `${params.provider} web search was unavailable.`;
    const fallback = await runProviderFallbackPrompt(params);

    if (!fallback) {
      throw browseError;
    }

    return {
      ...fallback,
      fallbackReason,
    };
  }
}

export async function estimateIntercityTransport(request: TransportEstimationRequest): Promise<TransportEstimationResult> {
  const { prompt, promptVersion } = buildTransportEstimationPrompt(request);
  const providerOrder: CityGenerationProvider[] = request.provider
    ? [request.provider]
    : ['anthropic', 'openai', 'gemini'];

  let providerResponse: ProviderTransportResponse | null = null;

  try {
    for (const provider of providerOrder) {
      const result = await runTransportPromptForProvider({
        provider,
        systemPrompt: buildTransportSystemPrompt(provider),
        userPrompt: prompt,
        apiKey: request.apiKey,
        model: request.model,
        maxTokens: BROWSE_TRANSPORT_MAX_TOKENS,
      });

      if (result) {
        providerResponse = result;
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'LLM request failed.';
    throw new TransportEstimationError(message, 502);
  }

  if (!providerResponse) {
    if (request.provider) {
      throw new TransportEstimationError(getMissingKeyMessage(request.provider), 400);
    }

    throw new TransportEstimationError(
      'No supported LLM provider is configured. Add an API key in the planner dialog or configure ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY on the server.',
      400
    );
  }

  let parsedPayload: z.infer<typeof transportEstimatePayloadSchema>;
  try {
    parsedPayload = transportEstimatePayloadSchema.parse(extractJsonObject(providerResponse.text));
  } catch {
    const strictFallback = await runProviderFallbackPrompt({
      provider: providerResponse.provider,
      systemPrompt: buildTransportSystemPrompt(providerResponse.provider),
      userPrompt: `${prompt}\n\nImportant: output exactly one JSON object and nothing else.`,
      apiKey: request.apiKey,
      model: request.model,
      maxTokens: FALLBACK_TRANSPORT_MAX_TOKENS,
    });

    if (!strictFallback) {
      throw new TransportEstimationError(
        `The ${providerResponse.provider} response did not match the required transport-estimate JSON schema.`,
        502
      );
    }

    try {
      parsedPayload = transportEstimatePayloadSchema.parse(extractJsonObject(strictFallback.text));
      providerResponse = {
        ...strictFallback,
        fallbackReason: providerResponse.usedWebSearch
          ? 'Search response was not valid JSON, so the estimate was retried with a stricter non-search JSON prompt.'
          : (providerResponse.fallbackReason ??
            'The first response was not valid JSON, so the estimate was retried with a stricter JSON prompt.'),
      };
    } catch {
      throw new TransportEstimationError(
        `The ${providerResponse.provider} response did not match the required transport-estimate JSON schema.`,
        502
      );
    }
  }

  return {
    assumptions: parsedPayload.assumptions.slice(0, 6),
    options: normalizeOptions(parsedPayload.options),
    providerResult: {
      provider: providerResponse.provider,
      model: providerResponse.model,
      promptVersion,
      usedWebSearch: providerResponse.usedWebSearch,
      fallbackReason: providerResponse.fallbackReason,
      searchQueries: providerResponse.searchQueries,
      citations: providerResponse.citations,
    },
  };
}
