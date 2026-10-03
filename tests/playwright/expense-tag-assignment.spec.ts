import { expect, test } from '@playwright/test';

test('expense tags can be assigned, retained on failure, reloaded and removed', async ({ page }) => {
  const name = `QA assignment ${Date.now()}`;
  const tag = (await (await page.request.post('/api/tags', { data: { name } })).json()).data;
  const expense = (await (await page.request.post('/api/expenses', { data: { date: '2099-01-02', amount: 12.5, currency: 'AUD', category: 'food', description: name } })).json()).data;
  const endpoint = `/api/expenses/${expense.id}/tags`;
  try {
    await page.goto('/track');
    await expect(page.getByRole('button', { name: `Manage tags for expense ${expense.id}`, exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: `Manage tags for expense ${expense.id}`, exact: true }).filter({ visible: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name, exact: true }).check();
    await page.route(`**${endpoint}`, route => route.request().method() === 'PUT'
      ? route.fulfill({ status: 503, json: { error: 'QA tag save failed' } }) : route.continue());
    await dialog.getByRole('button', { name: 'Save tags', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText('QA tag save failed');
    await expect(dialog.getByRole('checkbox', { name, exact: true })).toBeChecked();
    await page.unroute(`**${endpoint}`);
    await dialog.getByRole('button', { name: 'Save tags', exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await page.getByRole('button', { name: `Manage tags for expense ${expense.id}`, exact: true }).filter({ visible: true }).click();
    await expect(dialog.getByRole('checkbox', { name, exact: true })).toBeChecked();
    expect((await (await page.request.get(`/api/tags/${tag.id}/expenses`)).json()).data.totalAud).toBe(12.5);
    const invalid = await page.request.put(endpoint, { data: { tagIds: [2147483647] } });
    expect(invalid.status()).toBe(404);
    expect((await (await page.request.get(endpoint)).json()).data.tagIds).toEqual([tag.id]);
    await dialog.getByRole('checkbox', { name, exact: true }).uncheck();
    await dialog.getByRole('button', { name: 'Save tags', exact: true }).click();
    await expect(dialog).toBeHidden();
    expect((await (await page.request.get(endpoint)).json()).data.tagIds).toEqual([]);

    await page.route(`**${endpoint}`, route => route.fulfill({ status: 503, json: { error: 'QA tag read failed' } }));
    await page.getByRole('button', { name: `Manage tags for expense ${expense.id}`, exact: true }).filter({ visible: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText('QA tag read failed');
    await expect(dialog.getByRole('button', { name: 'Save tags', exact: true })).toBeDisabled();
    await page.unroute(`**${endpoint}`);
    await dialog.getByRole('button', { name: 'Retry loading tags', exact: true }).click();
    await expect(dialog.getByRole('checkbox', { name, exact: true })).not.toBeChecked();
  } finally {
    await page.request.delete(`/api/expenses/${expense.id}`);
    await page.request.delete(`/api/tags/${tag.id}`);
  }
});
