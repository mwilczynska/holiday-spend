import { expect, test } from '@playwright/test';

test('tag totals omit deleted and excluded spend and update after include/delete', async ({ page }) => {
  const name = `QA tag totals ${Date.now()}`;
  const tag = (await (await page.request.post('/api/tags', { data: { name } })).json()).data;
  const aud = (await (await page.request.post('/api/expenses', { data: { date: '2099-01-01', amount: 19.25, currency: 'AUD', category: 'food', description: 'QA tagged AUD' } })).json()).data;
  const eur = (await (await page.request.post('/api/expenses', { data: { date: '2099-01-01', amount: 17, currency: 'EUR', amountAud: 30, category: 'food', description: 'QA tagged EUR' } })).json()).data;
  try {
    for (const expense of [aud, eur]) {
      expect((await page.request.post(`/api/expenses/${expense.id}/tags`, { data: { tagIds: [tag.id] } })).ok()).toBeTruthy();
    }
    const read = async () => (await (await page.request.get(`/api/tags/${tag.id}/expenses`)).json()).data;
    expect((await read()).totalAud).toBe(49.25);
    await page.request.patch(`/api/expenses/${eur.id}/exclude`);
    expect((await read()).totalAud).toBe(19.25);
    await page.request.delete(`/api/expenses/${aud.id}`);
    let saved = await read();
    expect(saved.count).toBe(1);
    expect(saved.expenses.map((expense: { id: number }) => expense.id)).toEqual([eur.id]);
    expect(saved.totalAud).toBe(0);
    let summary = (await (await page.request.get('/api/tags')).json()).data.find((item: { id: number }) => item.id === tag.id);
    expect(summary.expenseCount).toBe(1);
    expect(summary.totalAud).toBe(0);
    await page.goto('/track/tags');
    await page.getByRole('button', { name: `View ${name} expenses`, exact: true }).click();
    await expect(page.getByRole('heading', { name: `${name} $0 AUD`, exact: true })).toBeVisible();
    await expect(page.getByText('QA tagged AUD', { exact: true })).toBeHidden();
    await expect(page.getByText('Excluded', { exact: true })).toBeVisible();
    await page.request.patch(`/api/expenses/${eur.id}/exclude`);
    expect((await read()).totalAud).toBe(30);
    await page.request.delete(`/api/expenses/${eur.id}`);
    saved = await read();
    expect(saved.count).toBe(0);
    expect(saved.totalAud).toBe(0);
    summary = (await (await page.request.get('/api/tags')).json()).data.find((item: { id: number }) => item.id === tag.id);
    expect(summary.expenseCount).toBe(0);
    expect(summary.totalAud).toBe(0);
    await page.reload();
    await page.getByRole('button', { name: `View ${name} expenses`, exact: true }).click();
    await expect(page.getByText('No expenses with this tag.', { exact: true })).toBeVisible();
  } finally {
    for (const expense of [aud, eur]) await page.request.delete(`/api/expenses/${expense.id}`);
    await page.request.delete(`/api/tags/${tag.id}`);
  }
});
