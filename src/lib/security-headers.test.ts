import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from '../../scripts/lib/security-headers.mjs';

const asMap = (development: boolean) =>
  Object.fromEntries(buildSecurityHeaders({ development }).map(({ key, value }) => [key, value]));

describe('security headers', () => {
  it('forbids framing and sends HSTS in production without dev allowances', () => {
    const headers = asMap(false);
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headers['Content-Security-Policy']).not.toContain('unsafe-eval');
    expect(headers['Content-Security-Policy']).toContain("connect-src 'self';");
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=31536000/);
    expect(headers['Referrer-Policy']).toBe('same-origin');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('allows eval and the HMR websocket only for the development server', () => {
    const headers = asMap(true);
    expect(headers['Content-Security-Policy']).toContain("'unsafe-eval'");
    expect(headers['Content-Security-Policy']).toContain('ws:');
    expect(headers['Strict-Transport-Security']).toBeUndefined();
  });
});
