export function sanitizeLlmErrorMessage(message: string, apiKey?: string) {
  let safe = message;
  if (apiKey) {
    safe = safe.replaceAll(apiKey, '[redacted]').replaceAll(encodeURIComponent(apiKey), '[redacted]');
  }
  return safe
    .replace(/\bsk-[a-zA-Z0-9_-]{8,}/g, '[redacted]')
    .replace(/\bAIza[a-zA-Z0-9_-]{20,}/g, '[redacted]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
    .replace(/([?&]key=)[^\s&"']+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}

export function summarizeProviderError(rawText: string, apiKey?: string) {
  const text = rawText.trim();
  if (!text) return 'The provider returned no error details.';
  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: unknown } | string; message?: unknown; detail?: unknown;
    };
    const message = typeof parsed.error === 'string' ? parsed.error
      : parsed.error?.message ?? parsed.message ?? parsed.detail;
    if (typeof message === 'string') return sanitizeLlmErrorMessage(message, apiKey);
  } catch {
    // Some providers return plain text rather than JSON.
  }
  if (text.startsWith('<')) return 'The provider returned an unreadable error page.';
  return sanitizeLlmErrorMessage(text, apiKey);
}

export function formatProviderHttpError(provider: string, status: number, rawText: string, apiKey?: string) {
  const advice = status === 401 ? 'Check the provider API key.'
    : status === 403 ? "Check this API key's permissions and account access."
    : status === 404 ? 'Check the model ID and whether your account can use it.'
    : status === 429 ? 'Check provider quota or billing, then retry.'
    : status >= 500 ? 'The provider is temporarily unavailable. Try again shortly.'
    : 'Check the selected model and generation settings, then retry.';
  return `${provider} API error ${status}: ${summarizeProviderError(rawText, apiKey)} ${advice}`;
}

export function describeLlmRequestFailure(err: unknown, provider: string, timeoutMs: number, apiKey?: string, configurableTimeout = true) {
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return `${provider} request timeout after ${timeoutMs / 1000} seconds. ${configurableTimeout ? 'Try again or increase the timeout in Settings → Provider Request Limits.' : 'Try refreshing models again shortly.'}`;
  }
  if (err instanceof TypeError) {
    return `${provider} could not be reached. Check the network connection and try again.`;
  }
  return sanitizeLlmErrorMessage(err instanceof Error ? err.message : `${provider} request failed. Try again.`, apiKey);
}

export function getLlmNetworkErrorMessage(action: 'City generation' | 'Model refresh') {
  return `${action} could not reach the app server. Check your connection and that the app is running, then try again.`;
}

export async function readLlmApiResponse(response: Response, action: 'City generation' | 'Model refresh', apiKey?: string) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${action} failed (HTTP ${response.status}): the app server returned an unreadable response. Try again.`);
  }
  if (!response.ok) {
    const detail = typeof payload?.error === 'string'
      ? sanitizeLlmErrorMessage(payload.error, apiKey)
      : 'The app server returned no error details. Try again.';
    throw new Error(`${action} failed (HTTP ${response.status}): ${detail}`);
  }
  return payload;
}
