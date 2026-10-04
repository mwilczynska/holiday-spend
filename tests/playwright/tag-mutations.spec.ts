import { expect, test, type Page } from '@playwright/test';

async function createTag(page: Page, name: string) {
  const response = await page.request.post('/api/tags', { data: { name, color: '#3b82f6' } });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.id as number;
}

test('duplicate tag drafts remain editable and renaming updates the selected tag after reload', async ({ page }) => {
  const name = `QA duplicate ${Date.now()}`;
  const id = await createTag(page, name);
  let secondId: number | undefined;
  try {
    await page.goto('/track/tags');
    await page.getByRole('button', { name: `View ${name} expenses`, exact: true }).click();
    await expect(page.getByText('No expenses with this tag.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'New Tag', exact: true }).click();
    const create = page.getByRole('dialog', { name: 'Create Tag' });
    await create.getByLabel('Name', { exact: true }).fill(` ${name} `);
    const rejected = page.waitForResponse(response => response.url().endsWith('/api/tags') && response.request().method() === 'POST');
    await create.getByRole('button', { name: 'Create Tag', exact: true }).click();
    expect((await rejected).status()).toBe(409);
    await expect(create.getByRole('alert')).toContainText('already exists');
    await expect(create.getByLabel('Name', { exact: true })).toHaveValue(` ${name} `);
    const secondName = `${name} second`;
    await create.getByLabel('Name', { exact: true }).fill(secondName);
    await create.getByRole('button', { name: 'Create Tag', exact: true }).click();
    await expect(create).toBeHidden();
    secondId = (await (await page.request.get('/api/tags')).json()).data.find((tag: { name: string }) => tag.name === secondName).id;
    await page.getByRole('button', { name: `Edit ${name} tag`, exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit Tag' });
    await edit.getByLabel('Name', { exact: true }).fill(secondName);
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(edit.getByRole('alert')).toContainText('already exists');
    const renamed = `${name} renamed`;
    await edit.getByLabel('Name', { exact: true }).fill(renamed);
    await edit.getByLabel('Color', { exact: true }).fill('#ef4444');
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByRole('heading', { name: `${renamed} $0 AUD`, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: `View ${renamed} expenses`, exact: true })).toBeVisible();
    const saved = (await (await page.request.get('/api/tags')).json()).data.find((tag: { id: number }) => tag.id === id);
    expect(saved.color).toBe('#ef4444');
  } finally {
    await page.request.delete(`/api/tags/${id}`);
    if (secondId) await page.request.delete(`/api/tags/${secondId}`);
  }
});

test('network create failures retain drafts and failed tag deletes preserve selection for retry', async ({ page }) => {
  const name = `QA tag failures ${Date.now()}`;
  const id = await createTag(page, name);
  let rejectDelete = true;
  await page.route('**/api/tags', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await page.route(`**/api/tags/${id}`, route => rejectDelete && route.request().method() === 'DELETE'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'QA delete rejected' }) })
    : route.continue());
  page.on('dialog', dialog => dialog.accept());
  try {
    await page.goto('/track/tags');
    await page.getByRole('button', { name: 'New Tag', exact: true }).click();
    const create = page.getByRole('dialog', { name: 'Create Tag' });
    await create.getByLabel('Name', { exact: true }).fill('QA retained network draft');
    await create.getByRole('button', { name: 'Create Tag', exact: true }).click();
    await expect(create.getByRole('alert')).toContainText(/fetch|connection/i);
    await expect(create.getByLabel('Name', { exact: true })).toHaveValue('QA retained network draft');
    await create.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: `View ${name} expenses`, exact: true }).click();
    await page.getByRole('button', { name: `Delete ${name} tag`, exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'QA delete rejected' })).toBeVisible();
    await expect(page.getByRole('heading', { name: `${name} $0 AUD`, exact: true })).toBeVisible();
    rejectDelete = false;
    await page.getByRole('button', { name: `Delete ${name} tag`, exact: true }).click();
    await expect(page.getByRole('button', { name: `View ${name} expenses`, exact: true })).toBeHidden();
    await expect(page.getByText('Select a tag to see its expenses.', { exact: true })).toBeVisible();
  } finally {
    await page.request.delete(`/api/tags/${id}`);
  }
});

test('tag list and tagged-expense read failures show errors and recover through Retry', async ({ page }) => {
  const name = `QA tag reads ${Date.now()}`;
  const id = await createTag(page, name);
  let rejectList = true;
  let rejectExpenses = true;
  await page.route('**/api/tags', route => rejectList
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'QA tags unavailable' }) })
    : route.continue());
  await page.route(`**/api/tags/${id}/expenses`, route => rejectExpenses
    ? route.abort()
    : route.continue());
  try {
    await page.goto('/track/tags');
    await expect(page.getByRole('alert').filter({ hasText: 'QA tags unavailable' })).toBeVisible();
    await expect(page.getByText('No tags yet.', { exact: true })).toBeHidden();
    rejectList = false;
    await page.getByRole('button', { name: 'Retry loading tags', exact: true }).click();
    await page.getByRole('button', { name: `View ${name} expenses`, exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /fetch|connection/i })).toBeVisible();
    await expect(page.getByText('No expenses with this tag.', { exact: true })).toBeHidden();
    rejectExpenses = false;
    await page.getByRole('button', { name: 'Retry tagged expenses', exact: true }).click();
    await expect(page.getByText('No expenses with this tag.', { exact: true })).toBeVisible();
  } finally {
    await page.request.delete(`/api/tags/${id}`);
  }
});
