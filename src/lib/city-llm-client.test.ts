import { afterEach, describe, expect, it, vi } from 'vitest';
import { runJsonPromptWithProvider } from '@/lib/city-llm-client';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('OpenAI city-generation transport', () => {
  it('includes provider HTTP details and model-access guidance without echoing a credential', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { message: 'Model fixture-model does not exist. Echoed fixture-key.' } }, { status: 404 })));
    const err = await runJsonPromptWithProvider({ systemPrompt: 'JSON', userPrompt: 'Estimate a city.', provider: 'openai', apiKey: 'fixture-key' }).catch(error => error);
    expect(err.message).toContain('OpenAI API error 404');
    expect(err.message).toContain('fixture-model');
    expect(err.message).toContain('Check the model ID');
    expect(err.message).not.toContain('fixture-key');
  });

  it.each(['anthropic', 'gemini'] as const)('aborts a stalled %s request and explains its configured timeout', async provider => {
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    })));
    await expect(runJsonPromptWithProvider({ systemPrompt: 'JSON', userPrompt: 'Estimate a city.', provider, apiKey: 'fixture-key', requestTimeoutMs: 10 }))
      .rejects.toThrow('request timeout after 0.01 seconds');
  });

  it('uses the Responses API reasoning contract for GPT-6 Luna max and honours the selected cap', async () => {
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
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      maxTokens: 2500,
      requireWebSearch: true,
    });

    expect(result).toEqual({
      provider: 'openai',
      model: 'gpt-6-luna',
      text: '{"region":"East Asia"}',
      webSearchUsed: true,
      reasoningEffort: 'max',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(body).toMatchObject({
      model: 'gpt-6-luna',
      reasoning: { effort: 'max' },
      max_output_tokens: 2500,
      store: false,
      tools: [{ type: 'web_search' }],
      tool_choice: 'required',
    });
    expect(body).not.toHaveProperty('reasoning_effort');
    expect(body).not.toHaveProperty('messages');
    expect(body).not.toHaveProperty('text');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('defaults to GPT-6 Luna max with the full configured output limit', async () => {
    vi.stubEnv('OPENAI_MODEL', '');
    vi.stubEnv('LLM_MAX_OUTPUT_TOKENS', '64000');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'completed', output_text: '{"ok":true}' }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await runJsonPromptWithProvider({
      systemPrompt: 'Return JSON.', userPrompt: 'Estimate Querétaro, Mexico.',
      provider: 'openai', apiKey: 'fixture-key',
    });
    expect(result?.reasoningEffort).toBe('max');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: 'gpt-6-luna', reasoning: { effort: 'max' }, max_output_tokens: 64000,
    });
  });

  it('retries a truncated answer at lower effort while retaining required web search', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' },
        output_text: '{"partial":true}', usage: { output_tokens: 64000 },
      }))
      .mockResolvedValueOnce(Response.json({
        status: 'completed', output: [{ type: 'web_search_call', status: 'completed' }],
        output_text: '{"complete":true}',
      }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await runJsonPromptWithProvider({
      systemPrompt: 'Return JSON.', userPrompt: 'Estimate Querétaro, Mexico.',
      provider: 'openai', apiKey: 'fixture-key', model: 'gpt-6-luna',
      reasoningEffort: 'max', maxTokens: 64000, requireWebSearch: true,
    });
    expect(result).toMatchObject({ text: '{"complete":true}', reasoningEffort: 'xhigh', webSearchUsed: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(bodies.map(body => body.reasoning.effort)).toEqual(['max', 'xhigh']);
    for (const body of bodies) {
      expect(body).toMatchObject({ max_output_tokens: 64000, tool_choice: 'required', tools: [{ type: 'web_search' }] });
    }
  });

  it('rejects incomplete output even if it contains parseable JSON, with bounded retries', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => Response.json({
      status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output_text: '{"partial":true}',
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(runJsonPromptWithProvider({
      systemPrompt: 'Return JSON.', userPrompt: 'Estimate Querétaro.', provider: 'openai',
      apiKey: 'fixture-key', reasoningEffort: 'max', maxTokens: 1000,
    })).rejects.toThrow(/1000-token output limit.*No estimate was saved/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).reasoning.effort)).toEqual(['max', 'xhigh', 'high']);
  });

  it('sends an explicit none effort and does not inflate a user limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'completed', output_text: '{"ok":true}' }));
    vi.stubGlobal('fetch', fetchMock);
    await runJsonPromptWithProvider({
      systemPrompt: 'Return JSON.', userPrompt: 'Estimate Querétaro.', provider: 'openai',
      apiKey: 'fixture-key', reasoningEffort: 'none', maxTokens: 1000,
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      reasoning: { effort: 'none' }, max_output_tokens: 1000,
    });
  });

  it('aborts a stalled provider request at the configured timeout', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    })));
    await expect(runJsonPromptWithProvider({
      systemPrompt: 'Return JSON.', userPrompt: 'Estimate Querétaro.', provider: 'openai',
      apiKey: 'fixture-key', requestTimeoutMs: 10,
    })).rejects.toThrow(/timeout/i);
  });
});
