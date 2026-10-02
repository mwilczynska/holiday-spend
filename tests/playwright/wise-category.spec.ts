import { expect, test } from '@playwright/test';

test('Wise preview category changes survive confirmation and duplicate reparse', async ({ page }) => {
  const txn = `qa-category-${Date.now()}`;
  const csv = 'ID,Status,Direction,Created on,Source amount (after fees),Source currency,Target name,Target amount (after fees),Target currency,Reference,Category\n'
    + `${txn},COMPLETED,OUT,2026-10-02 10:00:00,25.00,AUD,QA category cafe,25.00,AUD,QA import category,Restaurants\n`;
  let expenseId: number | undefined;
  try {
    await page.goto('/track/import');
    await page.locator('input[type="file"]').setInputFiles({ name: 'category.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByRole('button', { name: 'Parse CSV', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Import 1 Transactions', exact: true })).toBeVisible();
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Shopping', exact: true }).click();
    await page.getByRole('button', { name: 'Import 1 Transactions', exact: true }).click();
    await expect(page.getByText('Import complete!', { exact: true })).toBeVisible();
    const expenses = (await (await page.request.get('/api/expenses')).json()).data;
    const saved = expenses.find((expense: { merchant: string; description: string; date: string }) => expense.merchant === 'QA category cafe' && expense.description === 'QA import category');
    expenseId = saved?.id;
    expect(saved?.category).toBe('shopping');
    await page.getByRole('button', { name: 'Parse CSV', exact: true }).click();
    await expect(page.getByText(/1 duplicate/)).toBeVisible();
  } finally {
    if (!expenseId) {
      const expenses = (await (await page.request.get('/api/expenses')).json()).data;
      expenseId = expenses.find((expense: { merchant: string; description: string }) => expense.merchant === 'QA category cafe' && expense.description === 'QA import category')?.id;
    }
    if (expenseId) await page.request.delete(`/api/expenses/${expenseId}`);
  }
});

test('choosing different CSV files invalidates the previous preview', async ({ page }) => {
  const csv = 'ID,Status,Direction,Created on,Source amount (after fees),Source currency,Target name,Target amount (after fees),Target currency,Reference,Category\n'
    + `qa-preview-${Date.now()},COMPLETED,OUT,2026-10-02,25,AUD,QA preview,25,AUD,QA preview,Restaurants\n`;
  await page.goto('/track/import');
  const files = page.locator('input[type="file"]');
  await files.setInputFiles({ name: 'first.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Parse CSV', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Import 1 Transactions', exact: true })).toBeVisible();
  await files.setInputFiles({ name: 'second.csv', mimeType: 'text/csv', buffer: Buffer.from(csv.replace('QA preview', 'Other preview')) });
  await expect(page.getByRole('button', { name: 'Import 1 Transactions', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Parse CSV', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Import 1 Transactions', exact: true })).toBeVisible();
});
