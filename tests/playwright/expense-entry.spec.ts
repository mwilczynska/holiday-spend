import { expect, test } from '@playwright/test';

test('Quick Add retains rejected input, allows retry and prevents duplicate success submissions', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/expenses', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    requests += 1;
    await route.fulfill({ status: requests === 1 ? 400 : 201, contentType: 'application/json',
      body: JSON.stringify(requests === 1 ? { error: 'Currency is required.' } : { data: { amountAud: 25 } }) });
  });
  await page.goto('/track/add');
  await page.getByLabel('Amount', { exact: true }).fill('25');
  await page.getByLabel('Currency', { exact: true }).fill('AUD');
  await page.getByPlaceholder('Description (optional)').fill('Retained fixture');
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Currency is required.' })).toBeVisible();
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('25');
  await expect(page.getByPlaceholder('Description (optional)')).toHaveValue('Retained fixture');
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved!', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('');
  await expect(page.getByPlaceholder('Description (optional)')).toHaveValue('');
  expect(requests).toBe(2);
});

test('Quick Add reports an unavailable conversion without claiming it counts in AUD totals', async ({ page }) => {
  await page.route('**/api/expenses', route => route.fulfill({ status: 201, contentType: 'application/json',
    body: JSON.stringify({ data: { amountAud: null } }) }));
  await page.goto('/track/add');
  await page.getByLabel('Amount', { exact: true }).fill('25');
  await page.getByLabel('Currency', { exact: true }).fill('USD');
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('saved without an AUD conversion');
});

test('Quick Add recovers from a network failure and rejects nonpositive amounts', async ({ page }) => {
  await page.route('**/api/expenses', route => route.abort());
  await page.goto('/track/add');
  await page.getByLabel('Amount', { exact: true }).fill('-5');
  await expect(page.getByRole('button', { name: 'Add Expense', exact: true })).toBeDisabled();
  await page.getByLabel('Amount', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /fetch|connection/i })).toBeVisible();
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('25');
  await expect(page.getByRole('button', { name: 'Add Expense', exact: true })).toBeEnabled();
});
