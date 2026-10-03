import { expect, test } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'node:path';
import { gotoClientPage } from './client-navigation';

test('Settings read failures retain fixed costs and settings until a valid retry', async ({ page, request }) => {
  const fixture = (await (await request.post('/api/fixed-costs', { data: { description: 'QA read retention', amountAud: 45, category: 'other' } })).json()).data;
  try {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const travellerControl = page.getByRole('combobox').first();
    await expect(travellerControl).toHaveText(/^[1-5] travellers?$/);
    await expect(travellerControl).toBeEnabled();
    const tokens = await page.getByLabel('Maximum output tokens', { exact: true }).inputValue();
    const timeout = await page.getByLabel('Request timeout (seconds)', { exact: true }).inputValue();
    const travellers = await travellerControl.innerText();
    await page.route('**/api/fixed-costs', route => route.fulfill({ status: 503, json: { error: 'QA fixed costs unavailable' } }));
    await gotoClientPage(page, '/settings');
    await expect(page.getByRole('alert').filter({ hasText: 'QA fixed costs unavailable' })).toContainText('last loaded settings and fixed costs');
    await expect(page.getByText('QA read retention', { exact: true })).toBeVisible();
    await expect(page.getByText('No fixed costs yet.', { exact: true })).toBeHidden();
    await page.unroute('**/api/fixed-costs');
    await page.route('**/api/settings/llm', route => route.fulfill({ status: 503, json: { error: 'QA provider limits unavailable' } }));
    await page.getByRole('button', { name: 'Retry settings', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'QA provider limits unavailable' })).toBeVisible();
    await expect(page.getByLabel('Maximum output tokens', { exact: true })).toHaveValue(tokens);
    await page.unroute('**/api/settings/llm');
    await page.route('**/api/countries?includeCities=false', route => route.fulfill({ contentType: 'text/plain', body: 'not JSON' }));
    await page.getByRole('button', { name: 'Retry settings', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'unreadable country options response' })).toBeVisible();
    await page.unroute('**/api/countries?includeCities=false');
    await page.route('**/api/fixed-costs', route => route.abort());
    await page.getByRole('button', { name: 'Retry settings', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /fetch|connection/i })).toBeVisible();
    await page.unroute('**/api/fixed-costs');
    await page.route('**/api/planner/settings', route => route.fulfill({ json: { data: { groupSize: 0 } } }));
    await page.getByRole('button', { name: 'Retry settings', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'invalid traveller settings' })).toBeVisible();
    await expect(page.getByRole('combobox').first()).toHaveText(travellers);
    await page.unroute('**/api/planner/settings');
    await page.route('**/api/settings/llm', route => route.fulfill({ json: { data: { maxOutputTokens: 100, requestTimeoutMs: 1000 } } }));
    await page.getByRole('button', { name: 'Retry settings', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'invalid provider limits' })).toBeVisible();
    await expect(page.getByLabel('Request timeout (seconds)', { exact: true })).toHaveValue(timeout);
    await expect(page.getByText('QA read retention', { exact: true })).toBeVisible();
    await page.unroute('**/api/settings/llm');
    await page.getByRole('button', { name: 'Retry settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry settings', exact: true })).toBeHidden();
    await expect(page.getByText('QA read retention', { exact: true })).toBeVisible();
  } finally {
    expect((await request.delete(`/api/fixed-costs/${fixture.id}`)).ok()).toBeTruthy();
  }
});

test('Settings retry preserves unsaved provider limit drafts', async ({ page }) => {
  await page.route('**/api/fixed-costs', route => route.fulfill({ status: 503, json: { error: 'QA draft refresh unavailable' } }));
  await gotoClientPage(page, '/settings');
  await expect(page.getByRole('alert').filter({ hasText: 'QA draft refresh unavailable' })).toBeVisible();
  await page.getByLabel('Maximum output tokens', { exact: true }).fill('33333');
  await page.getByLabel('Request timeout (seconds)', { exact: true }).fill('420');
  await page.unroute('**/api/fixed-costs');
  await page.getByRole('button', { name: 'Retry settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry settings', exact: true })).toBeHidden();
  await expect(page.getByLabel('Maximum output tokens', { exact: true })).toHaveValue('33333');
  await expect(page.getByLabel('Request timeout (seconds)', { exact: true })).toHaveValue('420');
  await expect(page.getByRole('button', { name: 'Save limits', exact: true })).toBeEnabled();
});

test('successful empty fixed-cost reads remain distinct from read failure', async ({ page }) => {
  await page.route('**/api/fixed-costs', route => route.fulfill({ json: { data: [] } }));
  await gotoClientPage(page, '/settings');
  await expect(page.getByText('No fixed costs yet.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry settings', exact: true })).toBeHidden();
  await expect(page.getByText('Fixed-cost totals unavailable.', { exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeEnabled();
});

test('failed initial Settings reads show unavailable values and recover with Retry', async ({ page }) => {
  const fixturePath = process.env.HOLIDAY_SPEND_DB_PATH;
  test.skip(!fixturePath || !path.resolve(fixturePath).replaceAll('\\', '/').includes('/.local/feature-qa/'), 'Requires the isolated feature QA database.');
  const fixture = new Database(fixturePath!);
  let suspended = false;
  try {
    expect(fixture.prepare("SELECT email FROM user WHERE id='dev-local-user'").get()).toEqual({ email: 'feature-qa@example.test' });
    fixture.exec('ALTER TABLE fixed_costs RENAME TO qa_suspended_fixed_costs');
    suspended = true;
    await page.goto('/settings');
    await expect(page.getByRole('alert').filter({ hasText: 'Settings unavailable. Traveller count, provider limits and fixed-cost totals could not be loaded.' })).toBeVisible();
    await expect(page.getByRole('combobox').first()).toHaveText('Unavailable');
    await expect(page.getByLabel('Maximum output tokens', { exact: true })).toHaveValue('');
    await expect(page.getByText('Fixed-cost totals unavailable.', { exact: true })).toBeVisible();
    await expect(page.getByText('No fixed costs yet.', { exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeDisabled();
    await page.waitForLoadState('networkidle');
    fixture.exec('ALTER TABLE qa_suspended_fixed_costs RENAME TO fixed_costs');
    suspended = false;
    await page.getByRole('button', { name: 'Retry settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry settings', exact: true })).toBeHidden();
    await expect(page.getByLabel('Maximum output tokens', { exact: true })).not.toHaveValue('');
    await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeEnabled();
  } finally {
    if (suspended) fixture.exec('ALTER TABLE qa_suspended_fixed_costs RENAME TO fixed_costs');
    fixture.close();
  }
});
