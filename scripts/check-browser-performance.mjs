/**
 * Production browser timings against a running server, using a test-account login.
 * WEBAPP_BASE_URL, WEBAPP_AUTH_EMAIL, WEBAPP_AUTH_PASSWORD and WEBAPP_SAMPLES match the HTTP harness.
 * WEBAPP_BROWSER_BUDGET_MS bounds content and dialog readiness (default 5000).
 * WEBAPP_BROWSER_ROUTES filters routes; WEBAPP_BROWSER_REPORT writes timings without credentials.
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const baseURL = process.env.WEBAPP_BASE_URL || 'http://localhost:3000';
const email = process.env.WEBAPP_AUTH_EMAIL;
const password = process.env.WEBAPP_AUTH_PASSWORD;
if (!email || !password) throw new Error('Set WEBAPP_AUTH_EMAIL and WEBAPP_AUTH_PASSWORD for the test account.');
const samples = Number(process.env.WEBAPP_SAMPLES || 5);
if (!Number.isInteger(samples) || samples < 1) throw new Error('WEBAPP_SAMPLES must be a positive integer.');
const browserBudgetMs = Number(process.env.WEBAPP_BROWSER_BUDGET_MS || 5000);
if (!Number.isInteger(browserBudgetMs) || browserBudgetMs < 1) throw new Error('WEBAPP_BROWSER_BUDGET_MS must be a positive integer.');
const routes = [
  ['/', 'main h1', 'Holiday Spend'],
  ['/plan', '[data-testid="planner-leg-card"]', ''],
  ['/plan/compare', 'h1', 'Compare'],
  ['/track', '[data-testid="expense-table"] tbody tr', ''],
  ['/dataset', '[data-testid="dataset-city-table"] tbody tr', ''],
  ['/settings', 'h1', 'Settings'],
];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } });
  const csrf = await (await context.request.get('/api/auth/csrf')).json();
  await context.request.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, json: 'true', email, password } });
  const session = await (await context.request.get('/api/auth/session')).json();
  if (!session.user?.id) throw new Error('Test-account sign-in failed.');
  const results = [];
  const requestedRoutes = process.env.WEBAPP_BROWSER_ROUTES?.split(',');
  for (const [route, selector, text] of routes) {
    if (requestedRoutes && !requestedRoutes.includes(route)) continue;
    const runs = [];
    for (let sample = 0; sample < samples; sample++) {
      const page = await context.newPage();
      page.setDefaultTimeout(browserBudgetMs);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ selector, text }) => {
        window.__pageReady = null;
        const observer = new MutationObserver(() => {
          const element = Array.from(document.querySelectorAll(selector)).find(node => !text || node.textContent?.includes(text));
          if (element) {
            window.__pageReady ??= performance.now();
            observer.disconnect();
          }
        });
        observer.observe(document, { childList: true, subtree: true });
      }, { selector, text });
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      if (!response?.ok() || new URL(page.url()).pathname === '/login') throw new Error(`${route} did not load authenticated.`);
      await page.waitForFunction(() => window.__pageReady !== null);
      let interactionMs;
      if (route === '/plan') {
        await page.getByRole('button', { name: 'Add Leg', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'visible' });
        interactionMs = Math.round(await page.evaluate(() => performance.now()));
        await page.keyboard.press('Escape');
      }
      // Allow mount-time API calls and chart loading to settle before inspecting their timings.
      await page.waitForLoadState('networkidle');
      const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        return {
          readyMs: Math.round(window.__pageReady),
          responseMs: Math.round(nav.responseEnd),
          domMs: Math.round(nav.domContentLoadedEventEnd),
          htmlTransferredBytes: nav.encodedBodySize,
          htmlDecodedBytes: nav.decodedBodySize,
          apis: performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname.startsWith('/api/') && !entry.name.includes('/api/auth/')).map(entry => ({ path: new URL(entry.name).pathname, startMs: Math.round(entry.startTime), endMs: Math.round(entry.responseEnd) })),
        };
      });
      if (errors.length) throw new Error(`${route} browser errors: ${errors.join('; ')}`);
      runs.push({ ...timing, ...(interactionMs === undefined ? {} : { interactionMs }) });
      await page.close();
    }
    const middleRun = { ...[...runs].sort((a, b) => a.readyMs - b.readyMs)[Math.floor(runs.length / 2)] };
    for (const field of ['readyMs', 'responseMs', 'domMs', 'interactionMs', 'htmlTransferredBytes', 'htmlDecodedBytes']) {
      const values = runs.map(run => run[field]).filter(Number.isFinite).sort((a,b) => a - b);
      if (values.length) middleRun[field] = Math.round((values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2);
    }
    results.push({ route, median: middleRun, runs });
    console.log(JSON.stringify({ route, samples, ...middleRun }));
    if (process.env.WEBAPP_BROWSER_REPORT) writeFileSync(process.env.WEBAPP_BROWSER_REPORT, JSON.stringify({ baseURL, results }, null, 2) + '\n');
    if (middleRun.readyMs > browserBudgetMs || (middleRun.interactionMs ?? 0) > browserBudgetMs) {
      throw new Error(`${route} exceeded the ${browserBudgetMs}ms browser-readiness budget.`);
    }
  }
  if (process.env.WEBAPP_BROWSER_REPORT) writeFileSync(process.env.WEBAPP_BROWSER_REPORT, JSON.stringify({ baseURL, results }, null, 2) + '\n');
  await context.close();
} finally {
  await browser.close();
}
