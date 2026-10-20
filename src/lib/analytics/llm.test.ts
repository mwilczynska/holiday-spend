import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./storage', async importOriginal => {
  const actual = await importOriginal<typeof import('./storage')>();
  const { default: Database } = await import('better-sqlite3');
  const store = new Database(':memory:'); actual.initializeAnalyticsStore(store);
  return { ...actual, getAnalyticsStore: () => store };
});
import { getAnalyticsStore } from './storage';
import { analyticsContext } from './context';
import { analyticsLlmFetch } from './llm';
const context = () => ({ requestId: crypto.randomUUID(), operationId: crypto.randomUUID(), route: '/api/cities/[id]/generate', userId: 'fixture-user', sessionId: null, pageViewId: null, device: 'unknown' as const, llmTimeoutMs: 600000 });
beforeEach(() => getAnalyticsStore().exec('DELETE FROM llm_attempts'));
afterEach(() => vi.unstubAllGlobals());
afterAll(() => getAnalyticsStore().close());
describe('LLM attempt telemetry', () => {
  it('records each retry, effective effort and token usage without retaining prompts or keys', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ status: 'completed', model: 'fixture-model', usage: { input_tokens: 120, output_tokens: 30, output_tokens_details: { reasoning_tokens: 20 } }, output: [{ type: 'web_search_call' }], output_text: 'private response content' }))));
    await analyticsContext.run(context(), async () => {
      for (const effort of ['max', 'high']) {
        const response = await analyticsLlmFetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: 'Bearer sk-fixture-do-not-retain' }, body: JSON.stringify({ model: 'fixture-model', reasoning: { effort }, input: 'private prompt content', tools: [{ type: 'web_search' }], max_output_tokens: 64000 }) });
        await response.json();
      }
    });
    const rows = getAnalyticsStore().prepare('SELECT * FROM llm_attempts ORDER BY attempt_number').all() as Array<Record<string, unknown>>;
    expect(rows.map(row => row.attempt_number)).toEqual([1, 2]);
    expect(rows.map(row => row.effort)).toEqual(['max', 'high']);
    expect(rows[0]).toMatchObject({ input_tokens: 120, output_tokens: 30, reasoning_tokens: 20, search_used: 1, search_count: 1, timeout_ms: 600000 });
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain('private prompt'); expect(serialized).not.toContain('private response'); expect(serialized).not.toContain('sk-fixture');
  });
  it('keeps absent usage unknown and distinguishes provider errors and timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(async () => new Response('{}')).mockImplementationOnce(async () => new Response('provider secret', { status: 429 })).mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError')));
    await analyticsContext.run(context(), async () => {
      const response = await analyticsLlmFetch('https://api.anthropic.com/v1/messages', { method: 'POST', body: JSON.stringify({ model: 'fixture-claude' }) }); await response.json();
      await analyticsLlmFetch('https://api.anthropic.com/v1/messages', { method: 'POST', body: '{}' });
      const abort = new AbortController(); abort.abort(new DOMException('deadline', 'TimeoutError'));
      await expect(analyticsLlmFetch('https://api.anthropic.com/v1/messages', { signal: abort.signal })).rejects.toThrow('timeout');
    });
    const rows = getAnalyticsStore().prepare('SELECT * FROM llm_attempts ORDER BY attempt_number').all() as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({ input_tokens: null, output_tokens: null, search_used: null });
    expect(rows.map(row => row.status)).toEqual(['received', 'provider_error', 'timeout']);
    expect(JSON.stringify(rows)).not.toContain('provider secret');
  });
  it('projects Gemini usage and grounding while excluding API keys embedded in URLs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, thoughtsTokenCount: 3 }, candidates: [{ finishReason: 'STOP', groundingMetadata: { webSearchQueries: ['private search'] } }] }))));
    await analyticsContext.run(context(), async () => {
      const response = await analyticsLlmFetch('https://generativelanguage.googleapis.com/v1beta/models/fixture-gemini:generateContent?key=fixture-private-key', { method: 'POST', body: '{}' }); await response.json();
    });
    const row = getAnalyticsStore().prepare('SELECT * FROM llm_attempts').get();
    expect(row).toMatchObject({ provider: 'gemini', model: 'fixture-gemini', input_tokens: 10, output_tokens: 4, reasoning_tokens: 3, search_used: 1 });
    expect(JSON.stringify(row)).not.toContain('fixture-private-key'); expect(JSON.stringify(row)).not.toContain('private search');
  });
});
