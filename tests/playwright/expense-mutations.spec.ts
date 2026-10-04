import { expect, test } from '@playwright/test';

async function createFixture(page: import('@playwright/test').Page) {
  const response = await page.request.post('/api/expenses', { data: {
    date: '2099-01-01', amount: 19, currency: 'AUD', category: 'shopping', description: 'QA mutation fixture',
  } });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.id as number;
}

test('failed expense edits retain input and recover after validation, HTTP and network failures', async ({ page }) => {
  const id = await createFixture(page);
  let mode = 'http';
  let writes = 0;
  await page.route(`**/api/expenses/${id}`, route => {
    if (route.request().method() !== 'PUT') return route.continue();
    writes += 1;
    if (mode === 'http') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'QA update rejected' }) });
    if (mode === 'network') return route.abort();
    return route.continue();
  });
  try {
    await page.goto('/track');
    await page.getByRole('button', { name: `Edit expense ${id}`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Expense' });
    await dialog.getByLabel('Amount', { exact: true }).fill('0');
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('positive amount');
    expect(writes).toBe(0);
    await dialog.getByLabel('Amount', { exact: true }).fill('25.50');
    await dialog.getByLabel('Description', { exact: true }).fill('QA retained expense edit');
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText('QA update rejected');
    await expect(dialog.getByLabel('Amount', { exact: true })).toHaveValue('25.50');
    await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue('QA retained expense edit');
    mode = 'network';
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText(/fetch|connection/i);
    mode = 'success';
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(dialog).toBeHidden();
    const saved = (await (await page.request.get('/api/expenses')).json()).data.find((expense: { id: number }) => expense.id === id);
    expect(saved.amountAud).toBe(25.5);
    expect(saved.description).toBe('QA retained expense edit');
    expect(writes).toBe(3);
  } finally {
    await page.request.delete(`/api/expenses/${id}`);
  }
});

test('failed exclude, bulk and delete actions keep rows and selections for retry', async ({ page }) => {
  const id = await createFixture(page);
  let reject = true;
  const handler = (route: import('@playwright/test').Route) => reject && route.request().method() !== 'GET'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'QA mutation rejected' }) })
    : route.continue();
  await page.route(`**/api/expenses/${id}/exclude`, handler);
  await page.route('**/api/expenses/bulk', handler);
  await page.route(`**/api/expenses/${id}`, handler);
  page.on('dialog', dialog => dialog.accept());
  try {
    await page.goto('/track');
    await page.getByRole('button', { name: `Exclude expense ${id}`, exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'QA mutation rejected' })).toBeVisible();
    await expect(page.getByRole('button', { name: `Exclude expense ${id}`, exact: true })).toBeEnabled();
    await page.getByRole('checkbox', { name: `Select expense ${id}`, exact: true }).check();
    await page.getByRole('button', { name: 'Exclude', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'QA mutation rejected' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: `Select expense ${id}`, exact: true })).toBeChecked();
    await page.getByRole('button', { name: `Delete expense ${id}`, exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'QA mutation rejected' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: `Select expense ${id}`, exact: true })).toBeChecked();
    reject = false;
    await page.getByRole('button', { name: 'Exclude', exact: true }).click();
    await expect(page.getByRole('button', { name: `Include expense ${id}`, exact: true })).toBeEnabled();
    await expect(page.getByRole('checkbox', { name: `Select expense ${id}`, exact: true })).not.toBeChecked();
    await page.getByRole('checkbox', { name: `Select expense ${id}`, exact: true }).check();
    await page.getByRole('button', { name: 'Include', exact: true }).click();
    await expect(page.getByRole('button', { name: `Exclude expense ${id}`, exact: true })).toBeEnabled();
    await page.getByRole('button', { name: `Delete expense ${id}`, exact: true }).click();
    await expect(page.getByRole('button', { name: `Edit expense ${id}`, exact: true })).toBeHidden();
  } finally {
    await page.request.delete(`/api/expenses/${id}`);
  }
});

test('failed tracker reads label prior results and retry without presenting an empty list', async ({ page }) => {
  const id = await createFixture(page);
  let reject = true;
  await page.route('**/api/expenses?**', route => reject
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'QA read rejected' }) })
    : route.continue());
  try {
    await page.goto('/track');
    await page.getByRole('combobox', { name: 'Filter category', exact: true }).click();
    await page.getByRole('option', { name: 'Food', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'QA read rejected' })).toContainText('Showing the last loaded results.');
    await expect(page.getByRole('button', { name: `Edit expense ${id}`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `Edit expense ${id}`, exact: true })).toBeDisabled();
    await expect(page.getByText('No expenses yet.', { exact: true })).toBeHidden();
    reject = false;
    await page.getByRole('button', { name: 'Retry loading expenses', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'QA read rejected' })).toBeHidden();
    await expect(page.getByRole('button', { name: `Edit expense ${id}`, exact: true })).toBeHidden();
    await expect(page.getByTestId('expense-table').getByRole('row').nth(1)).toContainText('Food');
  } finally {
    await page.request.delete(`/api/expenses/${id}`);
  }
});
