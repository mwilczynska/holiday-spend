import { afterEach, describe, expect, it, vi } from 'vitest';
import { estimateIntercityTransport } from '@/lib/transport-estimation';

const transportPayload = {
  assumptions: ['One-way fare for two travellers.'],
  options: [{
    mode: 'flight',
    label: 'Flight',
    total_aud: 240,
    confidence: 'medium',
    source_basis: 'Illustrative provider estimate',
    notes: 'Allow for baggage.',
    reasons: [],
    applied_assumptions: [],
    transport_row_draft: { mode: 'Flight', note: 'Allow for baggage.', cost: 240 },
  }],
};

const requestBase = {
  originCity: 'Origin',
  originCountry: 'Country A',
  destinationCity: 'Destination',
  destinationCountry: 'Country B',
  travelDate: '2026-09-01',
  groupSize: 2,
  allowedModes: ['flight'] as ['flight'],
  apiKey: 'test-key',
};

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('transport reasoning effort', () => {
  it('passes max effort to the OpenAI Responses transport request', async () => {
    let requestBody: Record<string, unknown> | null = null;
    global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        model: 'gpt-5.6-luna',
        output: [{
          type: 'message',
          content: [{ type: 'output_text', text: JSON.stringify(transportPayload) }],
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    await estimateIntercityTransport({
      ...requestBase,
      provider: 'openai',
      model: 'gpt-5.6-luna',
      reasoningEffort: 'max',
    });

    // Raised from 12,000 on 5 September 2026. Reasoning tokens are billed against this budget, and
    // at maximum effort a live multi-leg route consumed all of it and returned no answer at all.
    expect(requestBody).toMatchObject({
      model: 'gpt-5.6-luna',
      reasoning: { effort: 'max' },
      max_output_tokens: 32000,
    });
    const sentBody = requestBody as unknown as Record<string, unknown>;
    expect(sentBody.text).toBeUndefined();
    expect(sentBody.tools).toEqual([{
      type: 'web_search_preview',
      search_context_size: 'medium',
    }]);
  });

  it('maps Anthropic effort to the same thinking budget used by city generation', async () => {
    let requestBody: Record<string, unknown> | null = null;
    global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        model: 'claude-sonnet-4-6',
        content: [{ type: 'text', text: JSON.stringify(transportPayload) }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    await estimateIntercityTransport({
      ...requestBase,
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reasoningEffort: 'high',
    });

    expect(requestBody).toMatchObject({
      model: 'claude-sonnet-4-6',
      thinking: { type: 'enabled', budget_tokens: 8192 },
      max_tokens: 9692,
    });
  });

  it('maps Gemini effort to the provider thinking budget', async () => {
    let requestBody: Record<string, unknown> | null = null;
    global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        modelVersion: 'gemini-2.5-flash',
        candidates: [{
          content: { parts: [{ text: JSON.stringify(transportPayload) }] },
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    await estimateIntercityTransport({
      ...requestBase,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      reasoningEffort: 'low',
    });

    expect(requestBody).toMatchObject({
      generationConfig: {
        thinkingConfig: { thinkingBudget: 1024 },
      },
    });
  });
});
