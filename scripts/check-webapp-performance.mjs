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

const routeBudgetMs = readPositiveInteger('WEBAPP_ROUTE_BUDGET_MS', 5000);
const responseBudgetBytes = readPositiveInteger('WEBAPP_RESPONSE_BUDGET_BYTES', 512 * 1024);
const routes = ['/', '/plan', '/plan/compare', '/track', '/dataset', '/estimates', '/settings'];
const staticAssets = new Set();

if (!existsSync(resolve('.next', 'BUILD_ID')) || !existsSync(resolve('.next', 'standalone', 'server.js'))) {
  console.error('[performance] No complete production build found. Run `npm run build` before the performance check.');
  process.exit(1);
}

function fail(message) {
  console.error(`[performance] ${message}`);
  process.exitCode = 1;
}

for (const route of routes) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(routeBudgetMs),
    });
    const body = await response.arrayBuffer();
    const elapsedMs = Date.now() - startedAt;
    const bytes = body.byteLength;

    console.log(`[performance] ${route} ${response.status} ${elapsedMs}ms ${bytes} bytes`);
    if (!response.ok) fail(`${route} returned HTTP ${response.status}.`);
    if (elapsedMs > routeBudgetMs) fail(`${route} exceeded the ${routeBudgetMs}ms route budget.`);
    if (bytes > responseBudgetBytes) {
      fail(`${route} returned ${bytes} bytes, above the ${responseBudgetBytes}-byte shell budget.`);
    }

    const html = new TextDecoder().decode(body);
    for (const match of html.matchAll(/(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g)) {
      staticAssets.add(match[1]);
    }
  } catch (error) {
    fail(`${route} was not reachable within ${routeBudgetMs}ms: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const asset of staticAssets) {
  try {
    const response = await fetch(`${baseUrl}${asset}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(routeBudgetMs),
    });
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
  console.error('[performance] Route-shell check failed. Authenticated API payload and RSS checks require the local smoke session.');
} else {
  console.log('[performance] Route-shell check passed. Record authenticated API payloads and steady-state RSS in the Phase 7A evidence.');
}
