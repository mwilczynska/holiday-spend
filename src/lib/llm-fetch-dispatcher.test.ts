import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Agent } from 'undici';
import { getLlmFetchDispatcher } from '@/lib/llm-fetch-dispatcher';
import { runJsonPromptWithProvider } from '@/lib/city-llm-client';

let server: Server | undefined;
afterEach(async () => {
  vi.unstubAllGlobals();
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

/** A local server that sends its headers only after `delayMs`, like a non-streamed provider still generating. */
async function slowServer(delayMs: number) {
  server = createServer((_req, res) => setTimeout(() => res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}'), delayMs));
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
}

describe('provider fetch dispatcher', () => {
  it('works with Node fetch and waits for late headers where a short header timeout fails', { timeout: 15_000 }, async () => {
    const url = await slowServer(2_500);
    // The same delay fails under an agent with a 1-second header timeout, standing in for Node's 300-second default.
    // (undici's timeout timers tick about once a second, so shorter limits are not enforced precisely.)
    const strict = new Agent({ headersTimeout: 1_000 });
    await expect(fetch(url, { dispatcher: strict } as RequestInit)).rejects.toThrow();
    await strict.close();
    const response = await fetch(url, { dispatcher: getLlmFetchDispatcher() } as RequestInit);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('is used for every provider request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ output_text: '{}', output: [{ type: 'web_search_call', status: 'completed' }] }));
    vi.stubGlobal('fetch', fetchMock);
    await runJsonPromptWithProvider({ systemPrompt: 's', userPrompt: 'u', provider: 'xai', apiKey: 'fixture-key', model: 'grok-4.7', requireWebSearch: true });
    expect((fetchMock.mock.calls[0]![1] as { dispatcher?: unknown }).dispatcher).toBe(getLlmFetchDispatcher());
  });
});
