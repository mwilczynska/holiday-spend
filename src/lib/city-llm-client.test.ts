import { afterEach, describe, expect, it, vi } from 'vitest';
import { runJsonPromptWithProvider } from '@/lib/city-llm-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenAI city-generation transport', () => {
  it('uses the Responses API reasoning contract for GPT-5.6 Luna max', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: '{"region":"East Asia"}',
      output: [{ type: 'web_search_call' }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runJsonPromptWithProvider({
      systemPrompt: 'Return JSON.',
      userPrompt: 'Estimate Tottori.',
      provider: 'openai',
      apiKey: 'fixture-key',
      model: 'gpt-5.6-luna',
      reasoningEffort: 'max',
      maxTokens: 2500,
      requireWebSearch: true,
    });

    expect(result).toEqual({
      provider: 'openai',
      model: 'gpt-5.6-luna',
      text: '{"region":"East Asia"}',
      webSearchUsed: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(body).toMatchObject({
      model: 'gpt-5.6-luna',
      reasoning: { effort: 'max' },
      max_output_tokens: 12000,
      tools: [{ type: 'web_search' }],
      tool_choice: 'required',
    });
    expect(body).not.toHaveProperty('reasoning_effort');
    expect(body).not.toHaveProperty('messages');
    expect(body).not.toHaveProperty('text');
  });
});
