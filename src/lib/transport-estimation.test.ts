import { afterEach, describe, expect, it, vi } from 'vitest';
import { runJsonPromptWithWebSearch } from './transport-estimation';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('search-enabled provider transport', () => {
  it('does not combine OpenAI web search with the incompatible JSON mode', async () => {
    let requestBody: Record<string, unknown> | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            model: 'gpt-5.4-mini',
            output: [
              { type: 'web_search_call', queries: ['test query'] },
              {
                type: 'message',
                content: [{ type: 'output_text', text: '{"ok":true}' }],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const result = await runJsonPromptWithWebSearch({
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-5.6-luna',
      reasoningEffort: 'high',
      systemPrompt: 'Return JSON only.',
      userPrompt: 'Search for the source and return JSON.',
    });

    expect(result?.provider).toBe('openai');
    expect(result?.searchesUsed).toBe(1);
    expect(requestBody?.tools).toEqual([
      { type: 'web_search_preview', search_context_size: 'medium' },
    ]);
    expect(requestBody?.reasoning).toEqual({ effort: 'high' });
    expect(requestBody).not.toHaveProperty('text');
  });
});
