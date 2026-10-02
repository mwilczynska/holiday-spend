import { expect, test } from '@playwright/test';

test('fixed-cost validation, failed add retry, paid toggles and delete persist', async ({ page }) => {
  const description = `QA fixed cost ${Date.now()}`;
  let createdId: number | undefined;
  let attempts = 0;
  await page.route('**/api/fixed-costs', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary save failure. Try again.' }) });
    const response = await route.fetch();
    createdId = (await response.json()).data.id;
    await route.fulfill({ response });
  });
  try {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add Fixed Cost' });
    await dialog.getByLabel('Description', { exact: true }).fill('   ');
    await dialog.getByLabel('Amount (AUD)', { exact: true }).fill('25');
    await expect(dialog.getByRole('button', { name: 'Add Fixed Cost', exact: true })).toBeDisabled();
    await dialog.getByLabel('Description', { exact: true }).fill(description);
    for (const amount of ['-5', '0', '']) {
      await dialog.getByLabel('Amount (AUD)', { exact: true }).fill(amount);
      await expect(dialog.getByRole('button', { name: 'Add Fixed Cost', exact: true })).toBeDisabled();
    }
    await dialog.getByLabel('Amount (AUD)', { exact: true }).fill('25.5');
    await dialog.getByRole('button', { name: 'Add Fixed Cost', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Temporary save failure. Try again.');
    await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue(description);
    await expect(dialog.getByLabel('Amount (AUD)', { exact: true })).toHaveValue('25.5');
    await dialog.getByRole('button', { name: 'Add Fixed Cost', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(description, { exact: true })).toBeVisible();
    await page.getByRole('switch', { name: `Mark ${description} as paid`, exact: true }).click();
    await expect(page.getByRole('switch', { name: `Mark ${description} as unpaid`, exact: true })).toBeChecked();
    await page.reload();
    await expect(page.getByRole('switch', { name: `Mark ${description} as unpaid`, exact: true })).toBeChecked();
    await page.getByRole('button', { name: `Delete ${description}`, exact: true }).click();
    await expect(page.getByText(description, { exact: true })).not.toBeVisible();
    expect(attempts).toBe(2);
  } finally {
    if (createdId) await page.request.delete(`/api/fixed-costs/${createdId}`);
  }
});

test('fixed-cost network rejection preserves form values and permits retry', async ({ page }) => {
  await page.route('**/api/fixed-costs', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Fixed Cost' });
  await dialog.getByLabel('Description', { exact: true }).fill('Network fixture');
  await dialog.getByLabel('Amount (AUD)', { exact: true }).fill('25');
  await dialog.getByRole('button', { name: 'Add Fixed Cost', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(/fetch|connection/i);
  await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue('Network fixture');
  await expect(dialog.getByRole('button', { name: 'Add Fixed Cost', exact: true })).toBeEnabled();
});

test('fixed-cost paid and delete failures show errors without changing the row', async ({ page }) => {
  const description = `QA fixed mutation failure ${Date.now()}`;
  const response = await page.request.post('/api/fixed-costs', { data: { description, amountAud: 25 } });
  const id = (await response.json()).data.id;
  try {
    await page.route(`**/api/fixed-costs/${id}`, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fixed-cost update unavailable.' }) }));
    await page.goto('/settings');
    const paid = page.getByRole('switch', { name: `Mark ${description} as paid`, exact: true });
    await paid.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Fixed-cost update unavailable.' })).toBeVisible();
    await expect(paid).not.toBeChecked();
    await page.getByRole('button', { name: `Delete ${description}`, exact: true }).click();
    await expect(page.getByText(description, { exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Fixed-cost update unavailable.' })).toBeVisible();
  } finally {
    await page.request.delete(`/api/fixed-costs/${id}`);
  }
});
