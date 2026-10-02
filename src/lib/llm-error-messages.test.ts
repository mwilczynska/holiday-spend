import { describe, expect, it } from 'vitest';
import { describeLlmRequestFailure, formatProviderHttpError, readLlmApiResponse, summarizeProviderError } from '@/lib/llm-error-messages';

describe('LLM failure messages', () => {
  it.each([
    [401, 'API key'], [403, 'permissions'], [404, 'model ID'], [429, 'quota or billing'], [503, 'temporarily unavailable'],
  ])('preserves HTTP %s details and actionable advice without the credential', (status, advice) => {
    const message = formatProviderHttpError('OpenAI', status, JSON.stringify({ error: { message: 'Rejected fixture/secret key.' } }), 'fixture/secret');
    expect(message).toContain(`API error ${status}`);
    expect(message).toContain(advice);
    expect(message).toContain('[redacted]');
    expect(message).not.toContain('fixture/secret');
  });

  it('redacts echoed encoded keys and common provider token formats', () => {
    const message = summarizeProviderError('Rejected fixture%2Fsecret, sk-proj-fixture123456789 and https://provider.invalid/?key=fixture/secret', 'fixture/secret');
    expect(message).not.toContain('fixture');
    expect(message).not.toContain('sk-proj');
  });

  it('does not show proxy HTML as an error detail', () => {
    expect(formatProviderHttpError('OpenAI', 502, '<html>Proxy configuration</html>')).toContain('unreadable error page');
    expect(formatProviderHttpError('OpenAI', 502, '<html>Proxy configuration</html>')).not.toContain('Proxy configuration');
  });

  it('explains the configured timeout and where to change it', () => {
    const message = describeLlmRequestFailure(new DOMException('aborted', 'TimeoutError'), 'OpenAI', 90000);
    expect(message).toContain('90 seconds');
    expect(message).toContain('Settings → Provider Request Limits');
    expect(describeLlmRequestFailure(new DOMException('aborted', 'TimeoutError'), 'Model refresh', 15000, undefined, false)).not.toContain('Settings');
  });

  it('preserves server failure details and HTTP status in the UI', async () => {
    await expect(readLlmApiResponse(Response.json({ error: 'OpenAI API error 404: model not found.' }, { status: 502 }), 'City generation'))
      .rejects.toThrow('City generation failed (HTTP 502): OpenAI API error 404: model not found.');
  });

  it('explains an unreadable response instead of exposing a JSON parser error', async () => {
    await expect(readLlmApiResponse(new Response('<html>bad gateway</html>', { status: 502 }), 'Model refresh'))
      .rejects.toThrow('Model refresh failed (HTTP 502): the app server returned an unreadable response. Try again.');
  });
});
