import { afterEach, describe, expect, it } from 'vitest';
import {
  LLM_MAX_OUTPUT_TOKENS_DEFAULT,
  LLM_MAX_OUTPUT_TOKENS_MAX,
  LLM_MAX_OUTPUT_TOKENS_MIN,
  LLM_REQUEST_TIMEOUT_MS_DEFAULT,
  normalizeMaxOutputTokens,
  normalizeRequestTimeoutMs,
  resolveLlmRuntimeDefaults,
} from '@/lib/llm-runtime-settings';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('llm runtime settings', () => {
  it('falls back to the built-in defaults when nothing is configured', () => {
    delete process.env.LLM_MAX_OUTPUT_TOKENS;
    delete process.env.LLM_REQUEST_TIMEOUT_MS;

    expect(resolveLlmRuntimeDefaults()).toEqual({
      maxOutputTokens: LLM_MAX_OUTPUT_TOKENS_DEFAULT,
      requestTimeoutMs: LLM_REQUEST_TIMEOUT_MS_DEFAULT,
    });
  });

  it('prefers the environment over the built-in defaults', () => {
    process.env.LLM_MAX_OUTPUT_TOKENS = '120000';
    process.env.LLM_REQUEST_TIMEOUT_MS = '90000';

    expect(resolveLlmRuntimeDefaults()).toEqual({
      maxOutputTokens: 120000,
      requestTimeoutMs: 90000,
    });
  });

  it('ignores an unparseable environment value rather than sending garbage to a provider', () => {
    process.env.LLM_MAX_OUTPUT_TOKENS = 'lots';

    expect(resolveLlmRuntimeDefaults().maxOutputTokens).toBe(LLM_MAX_OUTPUT_TOKENS_DEFAULT);
  });

  it('clamps values to a range a provider will accept', () => {
    // The cap is a stop for a runaway request, so an absurd value in either direction is a
    // configuration mistake rather than an instruction worth honouring.
    expect(normalizeMaxOutputTokens(1)).toBe(LLM_MAX_OUTPUT_TOKENS_MIN);
    expect(normalizeMaxOutputTokens(99_999_999)).toBe(LLM_MAX_OUTPUT_TOKENS_MAX);
    expect(normalizeRequestTimeoutMs(1)).toBeGreaterThanOrEqual(10000);
  });

  it('defaults generously enough to clear the observed working range', () => {
    // Measured 5 September 2026: the heaviest of three live routes used 12,259 output tokens and
    // ran for around two minutes. A cap that binds during normal use is worse than none, because
    // the tokens are paid for and the answer is thrown away.
    expect(LLM_MAX_OUTPUT_TOKENS_DEFAULT).toBeGreaterThan(12259 * 3);
    expect(LLM_REQUEST_TIMEOUT_MS_DEFAULT).toBeGreaterThan(120000);
  });
});
