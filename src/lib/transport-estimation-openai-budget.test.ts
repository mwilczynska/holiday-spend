import { afterEach, describe, expect, it, vi } from 'vitest';
import { estimateIntercityTransport } from '@/lib/transport-estimation';
import { LLM_MAX_OUTPUT_TOKENS_DEFAULT } from '@/lib/llm-runtime-settings';

/**
 * Observed live on 5 September 2026: a maximum-effort estimate for Koh Lanta to Bangkok returned
 * `OpenAI Responses API returned no text output for the transport estimate.` and silently fell
 * back to the non-search path, which produced the least accurate of the three routes checked that
 * day. Reasoning tokens are billed against `max_output_tokens`, so the run had spent its whole
 * budget thinking and never emitted a message. The old error named the symptom and hid that.
 */

const baseRequest = {
  provider: 'openai' as const,
  apiKey: 'test-key-not-a-real-credential',
  model: 'gpt-5.6-luna',
  originCity: 'Koh Lanta',
  originCountry: 'Thailand',
  destinationCity: 'Bangkok',
  destinationCountry: 'Thailand',
  travelDate: '2026-12-20',
  groupSize: 2,
  allowedModes: ['bus', 'flight'] as const,
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/** A schema-valid answer, so the fallback call succeeds and the browse failure surfaces as a reason. */
const VALID_ANSWER = {
  model: 'gpt-5.6-luna',
  status: 'completed',
  output: [{
    type: 'message',
    content: [{
      type: 'output_text',
      text: JSON.stringify({ assumptions: ['fallback'], options: [] }),
    }],
  }],
};

/** First call is the web-search attempt, second is the strict non-search fallback. */
function respondInOrder(...bodies: unknown[]) {
  let call = 0;
  // Rest args rather than named ones: the third test reads `calls[0][1].body`, so the tuple has to
  // be typed, but neither parameter is used inside.
  return vi.fn(async (...args: [unknown, RequestInit?]) => {
    void args;
    return json(bodies[Math.min(call++, bodies.length - 1)]);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenAI transport estimate output budget', () => {
  const TRUNCATED = {
    model: 'gpt-5.6-luna',
    status: 'incomplete',
    incomplete_details: { reason: 'max_output_tokens' },
    usage: { input_tokens: 1200, output_tokens: 32000, output_tokens_details: { reasoning_tokens: 32000 } },
    output: [{ type: 'reasoning' }],
  };

  const effortsOf = (mock: { mock: { calls: Array<[unknown, RequestInit?]> } }) =>
    mock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).reasoning?.effort ?? null);

  it('retries the grounded call at a lower effort instead of abandoning web search', async () => {
    // Budget exhaustion means the model reasoned until it had no room to answer. That is a reason
    // to think less, not to stop searching.
    const fetchMock = respondInOrder(TRUNCATED, VALID_ANSWER);
    vi.stubGlobal('fetch', fetchMock);

    const result = await estimateIntercityTransport({ ...baseRequest, reasoningEffort: 'max' } as never);

    expect(effortsOf(fetchMock)).toEqual(['max', 'xhigh']);
    // The retry answered, so no fallback reason is recorded.
    expect(result.providerResult.fallbackReason).toBeNull();
  });

  it('gives up the grounding only after the ladder is exhausted', async () => {
    const fetchMock = respondInOrder(TRUNCATED, TRUNCATED, TRUNCATED, VALID_ANSWER);
    vi.stubGlobal('fetch', fetchMock);

    const result = await estimateIntercityTransport({ ...baseRequest, reasoningEffort: 'max' } as never);

    expect(effortsOf(fetchMock).slice(0, 3)).toEqual(['max', 'xhigh', 'high']);
    expect(result.providerResult.usedWebSearch).toBe(false);
    expect(result.providerResult.fallbackReason).toMatch(/Retried at lower effort without success/);
    expect(result.providerResult.fallbackReason).toMatch(/32000 reasoning tokens/);
  });

  it('still reports an empty response without a truncation reason plainly', async () => {
    vi.stubGlobal('fetch', respondInOrder(
      { model: 'gpt-5.6-luna', status: 'completed', output: [] },
      VALID_ANSWER,
    ));

    const result = await estimateIntercityTransport({ ...baseRequest, reasoningEffort: 'max' } as never);

    expect(result.providerResult.fallbackReason).toMatch(/returned no text output[\s\S]*status completed/);
  });

  it('asks for a budget that leaves room for an answer at maximum effort', async () => {
    // The budget covers reasoning and the answer together, so at maximum effort it has to exceed
    // what the reasoning alone can consume — 12,000 did not.
    const fetchMock = respondInOrder(VALID_ANSWER);
    vi.stubGlobal('fetch', fetchMock);

    await estimateIntercityTransport({ ...baseRequest, reasoningEffort: 'max' } as never).catch(() => undefined);

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.max_output_tokens).toBe(LLM_MAX_OUTPUT_TOKENS_DEFAULT);
    expect(body.reasoning).toEqual({ effort: 'max' });
  });

  it('uses the caller-supplied ceiling and timeout instead of the defaults', async () => {
    const fetchMock = respondInOrder(VALID_ANSWER);
    vi.stubGlobal('fetch', fetchMock);

    await estimateIntercityTransport({
      ...baseRequest,
      reasoningEffort: 'max',
      maxOutputTokens: 111000,
      requestTimeoutMs: 45000,
    } as never);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body)).max_output_tokens).toBe(111000);
    // A timeout is the honest stop for a runaway request; nothing bounded one before.
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});
