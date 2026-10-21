import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCrossOriginWrite, isTokenAllowed } from './request-origin';

function request(method: string, headers: Record<string, string>) {
  return new Request('http://127.0.0.1:3000/api/expenses', { method, headers });
}

describe('cross-origin write detection', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('allows reads and same-origin writes', () => {
    vi.stubEnv('APP_URL', 'https://spend.projectinfinitesummer.com');
    expect(isCrossOriginWrite(request('GET', { origin: 'https://evil.example' }))).toBe(false);
    expect(isCrossOriginWrite(request('POST', {
      origin: 'https://spend.projectinfinitesummer.com',
      host: '127.0.0.1:3000',
      'sec-fetch-site': 'same-origin',
    }))).toBe(false);
    expect(isCrossOriginWrite(request('PUT', { origin: 'http://192.168.0.10:3000', host: '192.168.0.10:3000' }))).toBe(false);
  });

  it('refuses writes from sibling subdomains and other sites', () => {
    vi.stubEnv('APP_URL', 'https://spend.projectinfinitesummer.com');
    expect(isCrossOriginWrite(request('POST', {
      origin: 'https://projectinfinitesummer.com',
      host: 'spend.projectinfinitesummer.com',
    }))).toBe(true);
    expect(isCrossOriginWrite(request('DELETE', { 'sec-fetch-site': 'same-site' }))).toBe(true);
    expect(isCrossOriginWrite(request('POST', { 'sec-fetch-site': 'cross-site' }))).toBe(true);
    expect(isCrossOriginWrite(request('POST', { origin: 'null', host: 'spend.projectinfinitesummer.com' }))).toBe(true);
  });

  it('allows non-browser clients that send neither Origin nor Sec-Fetch-Site', () => {
    expect(isCrossOriginWrite(request('POST', { host: '127.0.0.1:3000' }))).toBe(false);
  });

  it('accepts any token that identifies a user', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isTokenAllowed({ sub: 'u1' })).toBe(true);
    expect(isTokenAllowed({})).toBe(false);
    expect(isTokenAllowed(null)).toBe(false);
  });
});
