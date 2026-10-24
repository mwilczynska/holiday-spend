import { afterEach, describe, expect, it, vi } from 'vitest';
import { runJsonPromptWithProvider } from '@/lib/city-llm-client';
import type { CityGenerationProvider, CityGenerationReasoningEffort } from '@/lib/city-generation-config';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function respondWith(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(body));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentRequest(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, body: JSON.parse(String(init.body)) as Record<string, unknown>, headers: init.headers as Record<string, string> };
}

function run(provider: CityGenerationProvider, model: string, reasoningEffort?: CityGenerationReasoningEffort, requireWebSearch = true) {
  return runJsonPromptWithProvider({
    systemPrompt: 'Return JSON.',
    userPrompt: 'Estimate Tottori.',
    provider,
    model,
    reasoningEffort,
    apiKey: 'fixture-key',
    maxTokens: 4000,
    requireWebSearch,
  });
}

describe('provider transports', () => {
  it('sends Claude 4.6+ adaptive thinking, output_config effort and the dynamic web search tool', async () => {
    const fetchMock = respondWith({ content: [{ type: 'server_tool_use' }, { type: 'text', text: '{"ok":true}' }] });
    const result = await run('anthropic', 'claude-opus-5-5', 'max');
    const { body } = sentRequest(fetchMock);
    expect(body.thinking).toEqual({ type: 'adaptive' });
    expect(body.output_config).toEqual({ effort: 'max' });
    expect(body.tools).toEqual([{ type: 'web_search_20260209', name: 'web_search', max_uses: 1 }]);
    expect(result).toMatchObject({ text: '{"ok":true}', webSearchUsed: true, reasoningEffort: 'max' });
  });

  it('does not send an effort Claude Opus 5.5 rejects', async () => {
    const fetchMock = respondWith({ content: [{ type: 'server_tool_use' }, { type: 'text', text: '{}' }] });
    await run('anthropic', 'claude-opus-5-5', 'none');
    const { body } = sentRequest(fetchMock);
    expect(body.thinking).toBeUndefined();
    expect(body.output_config).toBeUndefined();
  });

  it('sends Gemini 3 and later a thinking level rather than a budget', async () => {
    const fetchMock = respondWith({ candidates: [{ content: { parts: [{ text: '{}' }] }, groundingMetadata: { webSearchQueries: ['fx'] } }] });
    await run('gemini', 'gemini-3.8-flash', 'high');
    const { body } = sentRequest(fetchMock);
    expect((body.generationConfig as { thinkingConfig?: unknown }).thinkingConfig).toEqual({ thinkingLevel: 'high' });
  });

  it('calls xAI through the Responses API with web search and reasoning effort', async () => {
    const fetchMock = respondWith({ output_text: '{}', output: [{ type: 'web_search_call', status: 'completed' }] });
    const result = await run('xai', 'grok-4.7', 'xhigh');
    const { url, body, headers } = sentRequest(fetchMock);
    expect(url).toBe('https://api.x.ai/v1/responses');
    expect(headers.Authorization).toBe('Bearer fixture-key');
    expect(body).toMatchObject({ model: 'grok-4.7', reasoning: { effort: 'xhigh' }, tools: [{ type: 'web_search' }], tool_choice: 'required' });
    expect(result).toMatchObject({ provider: 'xai', webSearchUsed: true });
  });

  it('enables the OpenRouter web plugin and detects its url citations', async () => {
    const fetchMock = respondWith({ choices: [{ message: { content: '{}', annotations: [{ type: 'url_citation' }] } }] });
    const result = await run('openrouter', 'openai/gpt-6.1-sol', 'max');
    const { url, body } = sentRequest(fetchMock);
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(body).toMatchObject({ plugins: [{ id: 'web' }], reasoning: { effort: 'max' }, max_tokens: 4000 });
    expect(result?.webSearchUsed).toBe(true);
  });

  it('reports no search when OpenRouter returns no citations, so city generation fails closed', async () => {
    respondWith({ choices: [{ message: { content: '{}' } }] });
    expect((await run('openrouter', 'openai/gpt-6.1-sol'))!.webSearchUsed).toBe(false);
  });

  it('uses Groq browser search on gpt-oss models and refuses other models', async () => {
    const fetchMock = respondWith({ choices: [{ message: { content: '{}', executed_tools: [{ type: 'search' }] } }] });
    const result = await run('groq', 'openai/gpt-oss-120b', 'high');
    const { url, body } = sentRequest(fetchMock);
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(body).toMatchObject({ tools: [{ type: 'browser_search' }], reasoning_effort: 'high', max_completion_tokens: 4000 });
    expect(result?.webSearchUsed).toBe(true);
    await expect(run('groq', 'llama-3.3-70b-versatile')).rejects.toThrow('only on its openai/gpt-oss models');
  });

  it('refuses a search-required request on a provider without web search', async () => {
    const fetchMock = respondWith({});
    await expect(run('deepseek', 'deepseek-v4-pro')).rejects.toThrow('has no server-side web search');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends DeepSeek thinking and effort on a request without search', async () => {
    const fetchMock = respondWith({ choices: [{ message: { content: '<think>…</think>{"ok":1}' } }] });
    const result = await run('deepseek', 'deepseek-v4-pro', 'high', false);
    expect(sentRequest(fetchMock).body).toMatchObject({ thinking: { type: 'enabled' }, reasoning_effort: 'high' });
    expect(result).toMatchObject({ text: '{"ok":1}', webSearchUsed: false });
  });

  it('calls Perplexity Sonar and treats search results as evidence of search', async () => {
    const fetchMock = respondWith({ choices: [{ message: { content: '{}' } }], search_results: [{ url: 'https://www.rba.gov.au' }] });
    const result = await run('perplexity', 'sonar-pro');
    expect(sentRequest(fetchMock).url).toBe('https://api.perplexity.ai/v1/sonar');
    expect(result?.webSearchUsed).toBe(true);
  });

  it('calls the Mistral Conversations API with web_search and reads message output chunks', async () => {
    const fetchMock = respondWith({
      outputs: [
        { type: 'tool.execution', name: 'web_search' },
        { type: 'message.output', content: [{ type: 'text', text: '{"a":' }, { type: 'tool_reference', url: 'x' }, { type: 'text', text: '1}' }] },
      ],
    });
    const result = await run('mistral', 'mistral-medium-latest');
    const { url, body } = sentRequest(fetchMock);
    expect(url).toBe('https://api.mistral.ai/v1/conversations');
    expect(body).toMatchObject({ tools: [{ type: 'web_search' }], completion_args: { max_tokens: 4000 }, store: false });
    expect(result).toMatchObject({ text: '{"a":1}', webSearchUsed: true });
  });

  it('enables Z.ai web search and reads its top-level search results', async () => {
    const fetchMock = respondWith({ choices: [{ message: { content: '{}' } }], web_search: [{ link: 'https://www.rba.gov.au' }] });
    const result = await run('zai', 'glm-5.3');
    const { url, body } = sentRequest(fetchMock);
    expect(url).toBe('https://api.z.ai/api/paas/v4/chat/completions');
    expect(body.tools).toEqual([{ type: 'web_search', web_search: { enable: true, search_result: true } }]);
    expect(result?.webSearchUsed).toBe(true);
  });

  it('returns null without a key so the caller reports the missing key', async () => {
    vi.stubEnv('TOGETHER_API_KEY', '');
    await expect(runJsonPromptWithProvider({ systemPrompt: 's', userPrompt: 'u', provider: 'together' })).resolves.toBeNull();
  });
});
