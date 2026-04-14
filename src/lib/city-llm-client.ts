import {
  CITY_GENERATION_DEFAULT_MODELS,
  type CityGenerationProvider,
} from '@/lib/city-generation-config';

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function isOpenAiMaxCompletionModel(model: string) {
  const normalized = model.toLowerCase();
  return normalized.startsWith('gpt-5') || normalized.startsWith('o1') || normalized.startsWith('o3') || normalized.startsWith('o4');
}

async function runOpenAiJsonPrompt(params: {
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}) {
  const apiKey = normalizeApiKey(params.apiKey) ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = normalizeModel(params.model) ?? (process.env.OPENAI_MODEL || CITY_GENERATION_DEFAULT_MODELS.openai);
  const requestBody: Record<string, unknown> = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: params.systemPrompt,
      },
      {
        role: 'user',
        content: params.userPrompt,
      },
    ],
  };

  if (isOpenAiMaxCompletionModel(model)) {
    requestBody.max_completion_tokens = params.maxTokens ?? 3000;
  } else {
    requestBody.max_tokens = params.maxTokens ?? 3000;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = summarizeProviderError(await response.text());
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return { provider: 'openai', model, text };
}

async function runAnthropicJsonPrompt(params: {
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}) {
  const apiKey = normalizeApiKey(params.apiKey) ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model =
    normalizeModel(params.model) ?? (process.env.ANTHROPIC_MODEL || CITY_GENERATION_DEFAULT_MODELS.anthropic);
  let data: { content?: Array<{ text?: string }> } | null = null;

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
        max_tokens: params.maxTokens ?? 3000,
        system: params.systemPrompt,
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
    throw new Error('Anthropic API returned no response body.');
  }

  const text = data.content?.map((item: { text?: string }) => item.text || '').join('\n') || '';
  return { provider: 'anthropic', model, text };
}

async function runGeminiJsonPrompt(params: {
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}) {
  const apiKey = normalizeApiKey(params.apiKey) ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = normalizeModel(params.model) ?? (process.env.GEMINI_MODEL || CITY_GENERATION_DEFAULT_MODELS.gemini);
  let data: {
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
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
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: params.maxTokens ?? 3000,
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

  return { provider: 'gemini', model, text };
}

export async function runJsonPromptWithProvider(params: {
  systemPrompt: string;
  userPrompt: string;
  provider?: CityGenerationProvider;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}) {
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
    }) => Promise<{ provider: string; model: string; text: string } | null>
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
      maxTokens: params.maxTokens,
    });

    if (result) {
      return result;
    }
  }

  return null;
}
