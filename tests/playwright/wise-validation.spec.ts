import { expect, test } from '@playwright/test';

const unsupported = 'not,a,wise,export\none,two,three,four';
const validCsv = () => 'ID,Status,Direction,Created on,Source amount (after fees),Source currency,Target name,Target amount (after fees),Target currency,Reference,Category\n'
  + `qa-validation-${Date.now()},COMPLETED,OUT,2026-12-04,25,AUD,Fictional cafe,25,AUD,Fictional validation,Restaurants\n`;

test('unsupported CSV shows a recoverable error without an importable blank row', async ({ page }) => {
  await page.goto('/track/import');
  const files = page.getByLabel('Wise CSV files', { exact: true });
  await files.setInputFiles({ name: 'unsupported.csv', mimeType: 'text/csv', buffer: Buffer.from(unsupported) });
  const response = page.waitForResponse(res => res.url().endsWith('/api/expenses/import/csv'));
  await page.getByRole('button', { name: 'Parse CSV', exact: true }).click();
  expect((await response).status()).toBe(400);
  await expect(page.getByText(/Unsupported Wise CSV columns/)).toBeVisible();
  await expect(page.getByText('1 file selected.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Import \d+ Transactions$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Parse CSV', exact: true })).toBeEnabled();
  await files.setInputFiles({ name: 'corrected.csv', mimeType: 'text/csv', buffer: Buffer.from(validCsv()) });
  await page.getByRole('button', { name: 'Parse CSV', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Import 1 Transactions', exact: true })).toBeVisible();
  await expect(page.getByText('25.00 AUD', { exact: true })).toBeVisible();
});

test('mixed and directly confirmed unsupported files cannot change expenses', async ({ page }) => {
  const before = (await (await page.request.get('/api/expenses')).json()).data.map((row: { id: number }) => row.id);
  const direct = await page.request.post('/api/expenses/import/csv', { multipart: {
    file: { name: 'unsupported.csv', mimeType: 'text/csv', buffer: Buffer.from(unsupported) }, confirm: 'true',
  } });
  expect(direct.status()).toBe(400);
  await page.goto('/track/import');
  await page.getByLabel('Wise CSV files', { exact: true }).setInputFiles([
    { name: 'valid.csv', mimeType: 'text/csv', buffer: Buffer.from(validCsv()) },
    { name: 'unsupported.csv', mimeType: 'text/csv', buffer: Buffer.from(unsupported) },
  ]);
  await page.getByRole('button', { name: 'Parse CSVs', exact: true }).click();
  await expect(page.getByText(/CSV file 2: Unsupported Wise CSV columns/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Import \d+ Transactions$/ })).toHaveCount(0);
  const after = (await (await page.request.get('/api/expenses')).json()).data.map((row: { id: number }) => row.id);
  expect(after).toEqual(before);
});
