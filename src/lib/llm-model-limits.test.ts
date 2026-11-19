import { describe, expect, it } from 'vitest';
import { clampOutputTokens, getModelMaxOutputTokens, nextLowerReasoningEffort } from '@/lib/llm-model-limits';

describe('model output ceilings', () => {
  it('knows the documented Claude and Gemini ceilings and leaves other models to the provider', () => {
    expect(getModelMaxOutputTokens('anthropic', 'claude-haiku-5-5')).toBe(128_000);
    expect(getModelMaxOutputTokens('anthropic', 'claude-fable-5-2')).toBe(128_000);
    expect(getModelMaxOutputTokens('anthropic', 'claude-opus-4-6')).toBe(128_000);
    expect(getModelMaxOutputTokens('anthropic', 'claude-haiku-4-5')).toBe(64_000);
    expect(getModelMaxOutputTokens('anthropic', 'claude-opus-4-1')).toBe(32_000);
    expect(getModelMaxOutputTokens('gemini', 'gemini-3.8-flash')).toBe(65_536);
    expect(getModelMaxOutputTokens('openai', 'gpt-6-luna')).toBeUndefined();
  });

  it('lowers a configured limit to the ceiling but never raises it', () => {
    expect(clampOutputTokens('anthropic', 'claude-haiku-4-5', 128_000)).toBe(64_000);
    expect(clampOutputTokens('anthropic', 'claude-haiku-5-5', 20_000)).toBe(20_000);
    expect(clampOutputTokens('openai', 'gpt-6-luna', 200_000)).toBe(200_000);
  });
});

describe('effort ladder after truncation', () => {
  it('steps through the efforts each model accepts, never below high', () => {
    expect(nextLowerReasoningEffort('anthropic', 'claude-haiku-5-5', 'max')).toBe('xhigh');
    expect(nextLowerReasoningEffort('anthropic', 'claude-haiku-5-5', 'xhigh')).toBe('high');
    expect(nextLowerReasoningEffort('anthropic', 'claude-haiku-5-5', 'high')).toBeUndefined();
    // Opus 4.6 has no xhigh, so max steps straight to high.
    expect(nextLowerReasoningEffort('anthropic', 'claude-opus-4-6', 'max')).toBe('high');
    expect(nextLowerReasoningEffort('openai', 'gpt-6-luna', 'max')).toBe('xhigh');
  });

  it('has no rung below an effort the model does not exceed', () => {
    expect(nextLowerReasoningEffort('gemini', 'gemini-3.8-flash', 'high')).toBeUndefined();
    expect(nextLowerReasoningEffort('anthropic', 'claude-haiku-5-5', undefined)).toBeUndefined();
  });
});
