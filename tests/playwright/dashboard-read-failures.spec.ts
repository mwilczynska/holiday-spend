import { expect, test } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'node:path';

test('dashboard refresh failures retain the complete prior view and recover with Retry', async ({ page }) => {
  const current = (await (await page.request.get('/api/dashboard')).json()).data;
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const values = await page.getByTestId('dashboard-stat-value').allTextContents();
  expect(values.length).toBeGreaterThan(0);
  await page.route('**/api/dashboard', route => route.fulfill({ status: 503, json: { error: 'QA dashboard unavailable' } }));
  await page.locator('a[href="/estimates"]').filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/estimates$/);
  await page.locator('a[href="/"]').filter({ visible: true }).first().click();
  await expect(page.getByRole('alert').filter({ hasText: 'QA dashboard unavailable' })).toContainText('last loaded dashboard figures');
  expect(await page.getByTestId('dashboard-stat-value').allTextContents()).toEqual(values);
  await page.unroute('**/api/dashboard');
  await page.route('**/api/dashboard', route => route.fulfill({ status: 200, contentType: 'text/plain', body: 'not JSON' }));
  await page.getByRole('button', { name: 'Retry dashboard', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'unreadable dashboard response' })).toBeVisible();
  expect(await page.getByTestId('dashboard-stat-value').allTextContents()).toEqual(values);
  await page.unroute('**/api/dashboard');
  await page.route('**/api/dashboard', route => route.abort());
  await page.getByRole('button', { name: 'Retry dashboard', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /fetch|connection/i })).toBeVisible();
  expect(await page.getByTestId('dashboard-stat-value').allTextContents()).toEqual(values);
  await page.unroute('**/api/dashboard');
  await page.route('**/api/dashboard', route => route.fulfill({ json: { data: { ...current, summary: { ...current.summary, totalSpent: 999999 }, burnRate: { cumulative: [] } } } }));
  await page.getByRole('button', { name: 'Retry dashboard', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'invalid dashboard data: burnRate.countryBands' })).toBeVisible();
  expect(await page.getByTestId('dashboard-stat-value').allTextContents()).toEqual(values);
  await page.unroute('**/api/dashboard');
  await page.getByRole('button', { name: 'Retry dashboard', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry dashboard', exact: true })).toBeHidden();
  expect(await page.getByTestId('dashboard-stat-value').allTextContents()).toEqual(values);
});

test('successful empty dashboard data is distinct from an unavailable read', async ({ page }) => {
  const current = (await (await page.request.get('/api/dashboard')).json()).data;
  const summary = { ...current.summary };
  for (const key of Object.keys(summary)) if (typeof summary[key] === 'number' && key !== 'groupSize') summary[key] = 0;
  summary.burnRate = { tripAvg: 0, plannedAvgSoFar: 0, sevenDayAvg: null, thirtyDayAvg: null, requiredDailyPace: null };
  await page.route('**/api/dashboard', route => route.fulfill({ json: { data: {
    summary, plannedVsActual: { comparison: [], actualCategoryTotals: {}, plannedCategoryTotals: {} },
    burnRate: { cumulative: [], countryBands: [] },
  } } }));
  await page.goto('/estimates');
  await page.waitForLoadState('networkidle');
  await page.locator('a[href="/"]').filter({ visible: true }).first().click();
  await expect(page.getByText('No itinerary or trip expenses yet. Add a destination or record an expense to start.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry dashboard', exact: true })).toBeHidden();
  await expect(page.getByText(/0 trip expenses logged/)).toBeVisible();
});

test('dashboard skips duplicate full-load reads but refreshes on the first client navigation', async ({ page }) => {
  let reads = 0;
  await page.route('**/api/dashboard', async route => { reads += 1; await route.continue(); });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(reads).toBe(0);
  await page.goto('/estimates');
  await page.waitForLoadState('networkidle');
  await page.locator('a[href="/"]').filter({ visible: true }).first().click();
  await expect.poll(() => reads).toBe(1);
  await expect(page.getByText('Actual spent to date', { exact: true })).toBeVisible();
});

test('failed initial dashboard reads show unavailable totals and recover with Retry', async ({ page }) => {
  const fixturePath = process.env.HOLIDAY_SPEND_DB_PATH;
  test.skip(!fixturePath || !path.resolve(fixturePath).replaceAll('\\', '/').includes('/.local/feature-qa/'), 'Requires the isolated feature QA database.');
  const fixture = new Database(fixturePath!);
  let suspended = false;
  try {
    expect(fixture.prepare("SELECT email FROM user WHERE id='dev-local-user'").get()).toEqual({ email: 'feature-qa@example.test' });
    fixture.exec('ALTER TABLE expenses RENAME TO qa_suspended_expenses');
    suspended = true;
    await page.goto('/');
    await expect(page.getByRole('alert').filter({ hasText: 'Dashboard unavailable. Totals and charts could not be loaded.' })).toBeVisible();
    await expect(page.getByText('Actual spent to date', { exact: true })).toBeHidden();
    await expect(page.getByText(/No itinerary or trip expenses yet/)).toBeHidden();
    fixture.exec('ALTER TABLE qa_suspended_expenses RENAME TO expenses');
    suspended = false;
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Retry dashboard', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry dashboard', exact: true })).toBeHidden();
    await expect(page.getByText('Actual spent to date', { exact: true })).toBeVisible();
  } finally {
    if (suspended) fixture.exec('ALTER TABLE qa_suspended_expenses RENAME TO expenses');
    fixture.close();
  }
});
