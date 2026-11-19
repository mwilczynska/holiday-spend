import { afterEach, describe, expect, it, vi } from 'vitest';
import { runJsonPromptWithProvider } from '@/lib/city-llm-client';
import { anthropicEventStream } from '@/lib/anthropic-message-stream.fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** A streamed Anthropic turn with the given content blocks and stop reason. */
function anthropicTurn(content: Array<Record<string, unknown>>, stopReason: string) {
  const events: unknown[] = [{ type: 'message_start', message: { model: 'claude-haiku-5-5', usage: { input_tokens: 10, output_tokens: 1 } } }];
  content.forEach((block, index) => {
    const { text, ...start } = block;
    events.push({ type: 'content_block_start', index, content_block: text === undefined ? block : { ...start, text: '' } });
    if (typeof text === 'string') events.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text } });
    events.push({ type: 'content_block_stop', index });
  });
  events.push({ type: 'message_delta', delta: { stop_reason: stopReason }, usage: { output_tokens: 100 } });
  events.push({ type: 'message_stop' });
  return new Response(anthropicEventStream(events), { headers: { 'content-type': 'text/event-stream' } });
}

const searchUse = { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'RBA USD AUD' } };
const searchResult = { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] };

function runAnthropic(overrides: Record<string, unknown> = {}) {
  return runJsonPromptWithProvider({
    systemPrompt: 'Return JSON.', userPrompt: 'Estimate Tottori.', provider: 'anthropic', apiKey: 'fixture-key',
    model: 'claude-haiku-5-5', reasoningEffort: 'max', maxTokens: 64000, requireWebSearch: true, maxWebSearches: 6,
    ...overrides,
  });
}

const bodies = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));

describe('Anthropic transport for any Claude model and effort', () => {
  it('streams the request and allows the searches the prompt permits', async () => {
    const fetchMock = vi.fn().mockResolvedValue(anthropicTurn([searchUse, searchResult, { type: 'text', text: '{"ok":true}' }], 'end_turn'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await runAnthropic();
    const [body] = bodies(fetchMock);
    expect(body).toMatchObject({ stream: true, model: 'claude-haiku-5-5', max_tokens: 64000, output_config: { effort: 'max' } });
    expect(body.tools).toEqual([{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }]);
    expect(result).toMatchObject({ text: '{"ok":true}', webSearchUsed: true, reasoningEffort: 'max' });
  });

  it('resumes a paused search turn by sending the paused content back unchanged', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(anthropicTurn([searchUse, searchResult], 'pause_turn'))
      .mockResolvedValueOnce(anthropicTurn([{ type: 'text', text: '{"done":true}' }], 'end_turn'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await runAnthropic();
    const [, second] = bodies(fetchMock);
    expect(second.messages).toEqual([
      { role: 'user', content: 'Estimate Tottori.' },
      { role: 'assistant', content: [searchUse, searchResult] },
    ]);
    expect(result).toMatchObject({ text: '{"done":true}', webSearchUsed: true });
  });

  it('retries a truncated answer one effort rung lower and records the effort that finished', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(anthropicTurn([searchUse, searchResult, { type: 'text', text: '{"partial":' }], 'max_tokens'))
      .mockResolvedValueOnce(anthropicTurn([searchUse, searchResult, { type: 'text', text: '{"ok":true}' }], 'end_turn'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await runAnthropic();
    expect(bodies(fetchMock).map((body) => body.output_config.effort)).toEqual(['max', 'xhigh']);
    expect(result).toMatchObject({ text: '{"ok":true}', reasoningEffort: 'xhigh' });
  });

  it('reports truncation at the lowest rung instead of parsing a partial answer', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => anthropicTurn([{ type: 'text', text: '{"partial":' }], 'max_tokens'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(runAnthropic({ maxTokens: 20000 })).rejects.toThrow(/20000-token output limit.*No estimate was saved/);
    expect(bodies(fetchMock).map((body) => body.output_config.effort)).toEqual(['max', 'xhigh', 'high']);
  });

  it('reports a refusal rather than an unreadable answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicTurn([], 'refusal')));
    await expect(runAnthropic()).rejects.toThrow(/declined to answer.*No estimate was saved/);
  });

  it('clamps the configured limit to the model ceiling so the request is not rejected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(anthropicTurn([searchUse, { type: 'text', text: '{}' }], 'end_turn'));
    vi.stubGlobal('fetch', fetchMock);
    await runAnthropic({ model: 'claude-haiku-4-5', reasoningEffort: 'high', maxTokens: 128000 });
    expect(bodies(fetchMock)[0].max_tokens).toBe(64000);
  });

  it('gives Fable the dynamic-filtering search tool', async () => {
    const fetchMock = vi.fn().mockResolvedValue(anthropicTurn([searchUse, { type: 'text', text: '{}' }], 'end_turn'));
    vi.stubGlobal('fetch', fetchMock);
    await runAnthropic({ model: 'claude-fable-5-2', reasoningEffort: 'high' });
    expect(bodies(fetchMock)[0].tools[0].type).toBe('web_search_20260209');
  });
});

describe('effort ladder on other transports', () => {
  it('sends Gemini the configured output limit rather than a small fixed one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      candidates: [{ content: { parts: [{ text: '{}' }] }, groundingMetadata: { webSearchQueries: ['fx'] } }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    await runJsonPromptWithProvider({ systemPrompt: 's', userPrompt: 'u', provider: 'gemini', apiKey: 'fixture-key', model: 'gemini-3.8-flash', requireWebSearch: true });
    // No limit passed: the runtime default (64,000), within Gemini's 65,536-token ceiling.
    expect(bodies(fetchMock)[0].generationConfig.maxOutputTokens).toBe(64000);
  });

  it('reports Gemini truncation with the limit it hit; high is already the lowest rung', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{' }] } }] }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(runJsonPromptWithProvider({
      systemPrompt: 's', userPrompt: 'u', provider: 'gemini', apiKey: 'fixture-key', model: 'gemini-3.8-flash',
      reasoningEffort: 'high', maxTokens: 30000, requireWebSearch: true,
    })).rejects.toThrow(/30000-token output limit.*No estimate was saved/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('steps a truncated chat-completions answer down a rung', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: 'length', message: { content: '{' } }] }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: '{}', annotations: [{ type: 'url_citation' }] } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await runJsonPromptWithProvider({
      systemPrompt: 's', userPrompt: 'u', provider: 'openrouter', apiKey: 'fixture-key', model: 'openai/gpt-6.1-sol',
      reasoningEffort: 'max', maxTokens: 64000, requireWebSearch: true,
    });
    expect(bodies(fetchMock).map((body) => body.reasoning.effort)).toEqual(['max', 'xhigh']);
    expect(result).toMatchObject({ text: '{}', reasoningEffort: 'xhigh' });
  });
});
