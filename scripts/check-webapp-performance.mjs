/**
 * Authenticated performance check for the local webapp.
 *
 * History worth keeping in view: this script previously fetched every route with
 * `redirect: 'follow'` and no session cookie. `src/middleware.ts` wraps all of them in
 * `withAuth`, so each route 307'd to `/login` and the script measured the login page seven
 * times. Every route number it recorded described the login screen, which is why a 5-second
 * budget and a 512 KiB shell budget never fired while the app was slow to use.
 *
 * The guard against that is `assertNotRedirectedToLogin`, which fails loudly whenever a
 * response was redirected or lands on `/login`. That assertion runs unconditionally, with or
 * without credentials, because it is the check that makes every other number trustworthy.
 *
 * Environment:
 *   WEBAPP_BASE_URL              default http://localhost:3000
 *   WEBAPP_ROUTE_BUDGET_MS       default 5000
 *   WEBAPP_RESPONSE_BUDGET_BYTES default 512 KiB (the HTML shell, not the JS it references)
 *   WEBAPP_JS_BUDGET_BYTES       default 1.25 MiB of decompressed JavaScript per route; 0 disables
 *   WEBAPP_SAMPLES               default 3; routes are timed this many times and the median kept
 *   WEBAPP_REQUIRE_BUILD         default true; set false to measure `npm run dev`
 *   WEBAPP_AUTH_PIN              development PIN, when the target is a dev server
 *   WEBAPP_AUTH_EMAIL / _PASSWORD  email sign-in, required against a production build
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const baseUrl = (process.env.WEBAPP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

function readPositiveInteger(name, fallback) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    console.error(`[performance] ${name} must be a positive integer.`);
    process.exit(1);
  }
  return value;
}

function readNonNegativeInteger(name, fallback) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    console.error(`[performance] ${name} must be a non-negative integer.`);
    process.exit(1);
  }
  return value;
}

const routeBudgetMs = readPositiveInteger('WEBAPP_ROUTE_BUDGET_MS', 5000);
const responseBudgetBytes = readPositiveInteger('WEBAPP_RESPONSE_BUDGET_BYTES', 512 * 1024);
// Assets are served gzipped but chunked, with no content-length, so what is measured is the
// decompressed size: roughly four times the transferred bytes for JavaScript. That is the
// figure the engine parses and executes, and on localhost it dominates transfer time.
const jsBudgetBytes = readNonNegativeInteger('WEBAPP_JS_BUDGET_BYTES', Math.round(1.25 * 1024 * 1024));
const samples = readPositiveInteger('WEBAPP_SAMPLES', 3);
const requireBuild = process.env.WEBAPP_REQUIRE_BUILD !== 'false';

const routes = ['/', '/plan', '/plan/compare', '/track', '/dataset', '/estimates', '/settings'];

// Measured only when a session is established. An anonymous run cannot reach these at all,
// which is precisely the blind spot that hid the real payload sizes.
const apiEndpoints = [
  // What the dashboard actually calls. The three per-section endpoints remain and are still
  // measured, because they are public API surface even though the page no longer uses them.
  '/api/dashboard',
  '/api/dashboard/summary',
  '/api/dashboard/planned-vs-actual',
  '/api/dashboard/burn-rate',
  '/api/itinerary',
  '/api/countries?includeCities=false',
  '/api/estimates?view=dataset',
  '/api/expenses?view=track&page=0&pageSize=50',
];

const staticAssets = new Set();

if (requireBuild && (!existsSync(resolve('.next', 'BUILD_ID')) || !existsSync(resolve('.next', 'standalone', 'server.js')))) {
  console.error('[performance] No complete production build found. Run `npm run build` before the performance check.');
  process.exit(1);
}

function fail(message) {
  console.error(`[performance] ${message}`);
  process.exitCode = 1;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

/** Minimal cookie jar. Node's fetch does not persist cookies between calls. */
const cookies = new Map();

function storeCookies(response) {
  const raw = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  for (const entry of raw) {
    const [pair] = entry.split(';');
    const index = pair.indexOf('=');
    if (index > 0) cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
}

function cookieHeader() {
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function request(path, init = {}) {
  const headers = { ...(init.headers || {}) };
  const jar = cookieHeader();
  if (jar) headers.cookie = jar;

  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'follow',
    signal: AbortSignal.timeout(routeBudgetMs),
    ...init,
    headers,
  });
  storeCookies(response);
  return response;
}

/**
 * The assertion this script exists for. A redirected response, or one whose final URL is the
 * login page, means the measurement describes `/login` rather than the requested route.
 */
function assertNotRedirectedToLogin(label, response) {
  const finalPath = (() => {
    try {
      return new URL(response.url).pathname;
    } catch {
      return '';
    }
  })();

  if (response.redirected || finalPath === '/login') {
    fail(
      `${label} redirected to ${finalPath || 'another location'}. The measurement would describe the login ` +
        'page, not the route. Provide WEBAPP_AUTH_PIN, or WEBAPP_AUTH_EMAIL and WEBAPP_AUTH_PASSWORD.'
    );
    return false;
  }
  return true;
}

async function signIn() {
  const pin = process.env.WEBAPP_AUTH_PIN;
  const email = process.env.WEBAPP_AUTH_EMAIL;
  const password = process.env.WEBAPP_AUTH_PASSWORD;
  if (!pin && !(email && password)) return { attempted: false, userId: null };

  try {
    const csrfResponse = await request('/api/auth/csrf');
    const { csrfToken } = await csrfResponse.json();
    if (!csrfToken) {
      fail('Could not read a CSRF token from /api/auth/csrf.');
      return { attempted: true, userId: null };
    }

    const body = new URLSearchParams({ csrfToken, json: 'true' });
    if (pin) body.set('pin', pin);
    if (email && password) {
      body.set('email', email);
      body.set('password', password);
    }

    await request('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const session = await (await request('/api/auth/session')).json();
    const userId = session?.user?.id ?? null;
    if (!userId) {
      fail('Sign-in did not establish a session. Check the configured credentials.');
      return { attempted: true, userId: null };
    }
    return { attempted: true, userId };
  } catch (error) {
    fail(`Sign-in failed: ${error instanceof Error ? error.message : String(error)}`);
    return { attempted: true, userId: null };
  }
}

const auth = await signIn();
if (auth.userId) {
  console.log(`[performance] Authenticated as ${auth.userId}.`);
} else if (!auth.attempted) {
  console.log('[performance] No credentials configured; measuring unauthenticated responses only.');
}

for (const route of routes) {
  const timings = [];
  let shellBytes = 0;
  let lastHtml = '';
  let reachable = true;

  for (let attempt = 0; attempt < samples; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await request(route);
      const body = await response.arrayBuffer();
      timings.push(Date.now() - startedAt);
      shellBytes = body.byteLength;
      lastHtml = new TextDecoder().decode(body);

      if (attempt === 0) {
        if (!assertNotRedirectedToLogin(route, response)) reachable = false;
        if (!response.ok) fail(`${route} returned HTTP ${response.status}.`);
      }
    } catch (error) {
      fail(`${route} was not reachable within ${routeBudgetMs}ms: ${error instanceof Error ? error.message : String(error)}`);
      reachable = false;
      break;
    }
  }

  if (!reachable) continue;

  const elapsedMs = median(timings);
  console.log(`[performance] ${route} ${elapsedMs}ms (median of ${timings.length}) ${shellBytes} bytes`);
  if (elapsedMs > routeBudgetMs) fail(`${route} exceeded the ${routeBudgetMs}ms route budget.`);
  if (shellBytes > responseBudgetBytes) {
    fail(`${route} returned ${shellBytes} bytes, above the ${responseBudgetBytes}-byte shell budget.`);
  }

  const routeAssets = new Set();
  for (const match of lastHtml.matchAll(/(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g)) {
    staticAssets.add(match[1]);
    if (match[1].endsWith('.js')) routeAssets.add(match[1]);
  }

  // The shell is ~27 KB on every route; the JavaScript behind it is what actually differs,
  // and the previous script never recorded a single byte of it.
  if (jsBudgetBytes > 0 && routeAssets.size > 0) {
    let routeJsBytes = 0;
    for (const asset of routeAssets) {
      try {
        const response = await request(asset);
        routeJsBytes += (await response.arrayBuffer()).byteLength;
      } catch {
        // Reported by the shared static-asset sweep below.
      }
    }
    console.log(
      `[performance] ${route} javascript ${routeJsBytes} bytes decompressed across ${routeAssets.size} files`
    );
    if (routeJsBytes > jsBudgetBytes) {
      fail(
        `${route} loaded ${routeJsBytes} bytes of decompressed JavaScript, above the ${jsBudgetBytes}-byte budget.`
      );
    }
  }
}

if (auth.userId) {
  for (const endpoint of apiEndpoints) {
    const timings = [];
    let bytes = 0;
    try {
      for (let attempt = 0; attempt < samples; attempt += 1) {
        const startedAt = Date.now();
        const response = await request(endpoint);
        const body = await response.arrayBuffer();
        timings.push(Date.now() - startedAt);
        bytes = body.byteLength;
        if (attempt === 0) {
          if (!assertNotRedirectedToLogin(endpoint, response)) break;
          if (!response.ok) fail(`${endpoint} returned HTTP ${response.status}.`);
        }
      }
      if (timings.length > 0) {
        console.log(`[performance] ${endpoint} ${median(timings)}ms (median of ${timings.length}) ${bytes} bytes`);
      }
    } catch (error) {
      fail(`${endpoint} was not reachable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} else {
  console.log('[performance] API payload checks skipped: no authenticated session.');
}

for (const asset of staticAssets) {
  try {
    const response = await request(asset);
    await response.arrayBuffer();
    if (!response.ok) fail(`${asset} returned HTTP ${response.status}.`);
  } catch (error) {
    fail(`${asset} was not reachable within ${routeBudgetMs}ms: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (staticAssets.size > 0 && !process.exitCode) {
  console.log(`[performance] Static asset check passed (${staticAssets.size} assets).`);
}

if (process.exitCode) {
  console.error('[performance] Route-shell check failed.');
} else if (auth.userId) {
  console.log('[performance] Route-shell check passed, authenticated.');
} else {
  console.log('[performance] Route-shell check passed. No session was configured, so API payloads were not measured.');
}
