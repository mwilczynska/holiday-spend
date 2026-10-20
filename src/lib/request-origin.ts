import { isEmailAllowed } from './auth-policy';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * True when a state-changing request was sent by a page on another origin.
 *
 * The session cookie is SameSite=Lax, which only stops other *sites*. Every subdomain of the
 * registrable domain (for example the landing page on projectinfinitesummer.com) counts as the
 * same site, so the browser would attach the cookie to a POST from there. Browsers always send
 * Origin on cross-origin writes; a request with neither Origin nor Sec-Fetch-Site comes from a
 * non-browser client, which cannot borrow a visitor's cookie, and is allowed.
 */
export function isCrossOriginWrite(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return false;

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return true;

  const origin = request.headers.get('origin');
  if (!origin) return false;
  if (origin === 'null') return true;

  const allowed = new Set(
    [process.env.APP_URL, process.env.NEXTAUTH_URL].map(originOf).filter((value): value is string => Boolean(value))
  );
  if (allowed.has(origin)) return false;

  // Development servers run on several ports and LAN addresses; the Host header is set by the
  // browser from the address it opened and cannot be chosen by another page.
  const host = request.headers.get('host');
  try {
    return !host || new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/** The proxy can read the signed token but not the database, so it checks only the allowlist. */
export function isTokenAllowed(token: { sub?: string | null; email?: string | null } | null): boolean {
  return Boolean(token?.sub && isEmailAllowed(token.email));
}
