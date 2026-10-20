/**
 * Response headers for every route, set by the app so they do not depend on the proxy.
 *
 * Next.js renders inline bootstrap scripts without nonces unless every page is rendered per
 * request with a nonce, so script-src keeps 'unsafe-inline'; the remaining directives still stop
 * framing, plugin content, foreign form targets and requests to other origins. React's
 * development build needs eval and the dev server's websocket, so those are allowed only there.
 * Google sign-in redirects a form submission to accounts.google.com, which form-action covers.
 */
export function buildSecurityHeaders({ development = false } = {}) {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${development ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
  ].join('; ');

  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Reset and verification pages carry their token in the query string; never send it onward.
    { key: 'Referrer-Policy', value: 'same-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    // Browsers ignore HSTS over plain HTTP, but a development server should not send it at all.
    ...(development ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
  ];
}
