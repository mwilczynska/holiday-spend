import { expect, test } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'node:path';
import { gotoClientPage } from './client-navigation';

test('dataset failures retain library and history together until a valid retry', async ({ page }) => {
  await page.goto('/dataset');
  await page.waitForLoadState('networkidle');
  const counters = await page.locator('main .text-2xl.font-semibold').allTextContents();
  const rows = await page.getByTestId('dataset-city-table').locator('tbody tr').allTextContents();
  const history = await page.getByTestId('dataset-history-table').locator('tbody tr').allTextContents();
  await page.route('**/api/countries', route => route.fulfill({ status: 503, json: { error: 'QA city library unavailable' } }));
  await gotoClientPage(page, '/dataset');
  await expect(page.getByRole('alert').filter({ hasText: 'QA city library unavailable' })).toContainText('last loaded dataset and history');
  expect(await page.locator('main .text-2xl.font-semibold').allTextContents()).toEqual(counters);
  expect(await page.getByTestId('dataset-city-table').locator('tbody tr').allTextContents()).toEqual(rows);
  expect(await page.getByTestId('dataset-history-table').locator('tbody tr').allTextContents()).toEqual(history);
  await page.unroute('**/api/countries');
  await page.route('**/api/estimates?view=dataset', route => route.fulfill({ status: 503, json: { error: 'QA history unavailable' } }));
  await page.getByRole('button', { name: 'Retry dataset', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'QA history unavailable' })).toBeVisible();
  expect(await page.locator('main .text-2xl.font-semibold').allTextContents()).toEqual(counters);
  expect(await page.getByTestId('dataset-history-table').locator('tbody tr').allTextContents()).toEqual(history);
  await page.unroute('**/api/estimates?view=dataset');
  await page.route('**/api/countries', route => route.fulfill({ contentType: 'text/plain', body: 'not JSON' }));
  await page.getByRole('button', { name: 'Retry dataset', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'unreadable city library response' })).toBeVisible();
  await page.unroute('**/api/countries');
  await page.route('**/api/countries', route => route.abort());
  await page.getByRole('button', { name: 'Retry dataset', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /fetch|connection/i })).toBeVisible();
  await page.unroute('**/api/countries');
  await page.route('**/api/countries', route => route.fulfill({ json: { data: [{ id: 'invalid', name: 'Invalid', currencyCode: 'AUD', cities: {} }] } }));
  await page.getByRole('button', { name: 'Retry dataset', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'invalid city library data' })).toBeVisible();
  await page.unroute('**/api/countries');
  await page.route('**/api/estimates?view=dataset', route => route.fulfill({ json: { data: { rows: [], history: [], summary: { historyCount: -1 } } } }));
  await page.getByRole('button', { name: 'Retry dataset', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'invalid generation history data' })).toBeVisible();
  expect(await page.getByTestId('dataset-city-table').locator('tbody tr').allTextContents()).toEqual(rows);
  await page.unroute('**/api/estimates?view=dataset');
  await page.getByRole('button', { name: 'Retry dataset', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry dataset', exact: true })).toBeHidden();
  expect(await page.locator('main .text-2xl.font-semibold').allTextContents()).toEqual(counters);
});

test('provenance failures expose Retry and keep unsaved city costs', async ({ page }) => {
  await page.route('**/api/estimates?cityId=agra', route => route.fulfill({ status: 503, json: { error: 'QA provenance unavailable' } }));
  await page.goto('/dataset?cityId=agra');
  await expect(page.getByRole('alert').filter({ hasText: 'QA provenance unavailable' })).toContainText('Provenance unavailable');
  const hostel = page.getByLabel('Shared Hostel Dorm', { exact: true });
  await hostel.fill('8.75');
  await page.unroute('**/api/estimates?cityId=agra');
  await page.getByRole('button', { name: 'Retry provenance', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry provenance', exact: true })).toBeHidden();
  await expect(hostel).toHaveValue('8.75');
});

test('a successful city save followed by failed reads stays saved with refresh Retry', async ({ page, request }) => {
  const city = (await (await request.get('/api/cities')).json()).data.find((row: { id: string }) => row.id === 'agra');
  try {
    await page.goto('/dataset?cityId=agra');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Shared Hostel Dorm', { exact: true }).fill('8.75');
    await page.route('**/api/countries', route => route.fulfill({ status: 503, json: { error: 'QA saved city refresh unavailable' } }));
    await page.getByRole('button', { name: 'Save City', exact: true }).click();
    await expect(page.getByText('City saved.', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'QA saved city refresh unavailable' })).toBeVisible();
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeHidden();
    await expect(page.getByLabel('Shared Hostel Dorm', { exact: true })).toHaveValue('8.75');
    const saved = (await (await request.get('/api/cities')).json()).data.find((row: { id: string }) => row.id === 'agra');
    expect(saved.accomHostel).toBe(8.75);
    await page.getByLabel('Shared Hostel Dorm', { exact: true }).fill('9.25');
    await page.unroute('**/api/countries');
    await page.getByRole('button', { name: 'Retry dataset', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry dataset', exact: true })).toBeHidden();
    await expect(page.getByLabel('Shared Hostel Dorm', { exact: true })).toHaveValue('9.25');
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  } finally {
    expect((await request.put('/api/cities/agra', { data: { accomHostel: city.accomHostel } })).ok()).toBeTruthy();
  }
});

test('a valid empty dataset is distinct from failed initial reads', async ({ page }) => {
  await page.route('**/api/countries', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/estimates?view=dataset', route => route.fulfill({ json: { data: { rows: [], history: [], summary: { historyCount: 0 } } } }));
  await gotoClientPage(page, '/dataset');
  await expect(page.getByText('No city rows match the current search.', { exact: true })).toBeVisible();
  expect(await page.locator('main .text-2xl.font-semibold').allTextContents()).toEqual(['0', '0', '0']);
  await expect(page.getByRole('button', { name: 'Retry dataset', exact: true })).toBeHidden();
});

test('failed server dataset reads show unavailable counts and recover with Retry', async ({ page }) => {
  const fixturePath = process.env.HOLIDAY_SPEND_DB_PATH;
  test.skip(!fixturePath || !path.resolve(fixturePath).replaceAll('\\', '/').includes('/.local/feature-qa/'), 'Requires the isolated feature QA database.');
  const fixture = new Database(fixturePath!);
  let suspended = false;
  try {
    expect(fixture.prepare("SELECT email FROM user WHERE id='dev-local-user'").get()).toEqual({ email: 'feature-qa@example.test' });
    fixture.exec('ALTER TABLE city_estimates RENAME TO qa_suspended_city_estimates');
    suspended = true;
    // The failed server read is retried after hydration. Keep that read failed
    // until the test explicitly restores service and exercises the Retry button.
    await page.route('**/api/estimates?view=dataset', route => route.fulfill({ status: 503, json: { error: 'QA history unavailable' } }));
    const initialRetry = page.waitForResponse(response => response.url().endsWith('/api/estimates?view=dataset'));
    await page.goto('/dataset');
    await expect(page.getByRole('alert').filter({ hasText: 'Dataset unavailable. City and history counts could not be loaded.' })).toBeVisible();
    expect(await page.locator('main .text-2xl.font-semibold').allTextContents()).toEqual(['Unavailable', 'Unavailable', 'Unavailable']);
    await expect(page.getByText('No city rows match the current search.', { exact: true })).toBeHidden();
    await expect(page.getByText('No generation history is stored yet for the current filter.', { exact: true })).toBeHidden();
    await initialRetry;
    await expect(page.getByRole('alert').filter({ hasText: 'QA history unavailable' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry dataset', exact: true })).toBeEnabled();
    fixture.exec('ALTER TABLE qa_suspended_city_estimates RENAME TO city_estimates');
    suspended = false;
    await page.unroute('**/api/estimates?view=dataset');
    await page.getByRole('button', { name: 'Retry dataset', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry dataset', exact: true })).toBeHidden();
    await expect(page.getByTestId('dataset-city-table').locator('tbody tr').first()).not.toContainText('unavailable');
  } finally {
    if (suspended) fixture.exec('ALTER TABLE qa_suspended_city_estimates RENAME TO city_estimates');
    fixture.close();
  }
});
