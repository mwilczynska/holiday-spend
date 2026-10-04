import { expect, test } from '@playwright/test';

test('failed provider-limit acknowledgements retain drafts without reporting success', async ({ page, request }) => {
  let mode: 'missing' | 'invalid' | 'wrong' | 'unreadable' | 'http' | 'network' | 'success' = 'missing';
  await page.route('**/api/settings/llm', route => {
    if (route.request().method() !== 'PUT' || mode === 'success') return route.continue();
    if (mode === 'missing') return route.fulfill({ json: { data: {} } });
    if (mode === 'invalid') return route.fulfill({ json: { data: { maxOutputTokens: -1, requestTimeoutMs: 420000 } } });
    if (mode === 'wrong') return route.fulfill({ json: { data: { maxOutputTokens: 32000, requestTimeoutMs: 420000 } } });
    if (mode === 'unreadable') return route.fulfill({ contentType: 'text/plain', body: 'not JSON' });
    if (mode === 'http') return route.fulfill({ status: 503, json: { error: 'QA provider save unavailable' } });
    return route.abort();
  });
  try {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const tokens = page.getByLabel('Maximum output tokens', { exact: true });
    const timeout = page.getByLabel('Request timeout (seconds)', { exact: true });
    await tokens.fill('33333');
    await timeout.fill('420');
    await page.getByRole('button', { name: 'Save limits', exact: true }).click();
    for (const failure of ['missing', 'invalid', 'wrong', 'unreadable', 'http', 'network'] as const) {
      if (failure !== 'missing') {
        mode = failure;
        await page.getByRole('button', { name: 'Retry provider limits', exact: true }).click();
      }
      await expect(page.getByRole('alert').filter({ hasText: failure === 'http' ? 'QA provider save unavailable' : failure === 'network' ? /fetch|connection/i : 'did not confirm the requested provider limits' })).toBeVisible();
      await expect(tokens).toHaveValue('33333');
      await expect(timeout).toHaveValue('420');
      await expect(page.getByRole('status')).toBeHidden();
      await expect(page.getByRole('button', { name: 'Retry provider limits', exact: true })).toBeEnabled();
    }
    mode = 'success';
    await page.getByRole('button', { name: 'Retry provider limits', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Provider limits saved.');
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toBeHidden();
    await page.reload();
    await expect(tokens).toHaveValue('33333');
    await expect(timeout).toHaveValue('420');
  } finally {
    expect((await request.put('/api/settings/llm', { data: { maxOutputTokens: null, requestTimeoutMs: null } })).ok()).toBeTruthy();
  }
});

test('pending provider saves clear old success and lock Save, Reset, drafts and other settings writes', async ({ page, request }) => {
  let release!: () => void;
  let hold = false;
  let writes = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  let waitForWrite: Promise<unknown> | undefined;
  await page.route('**/api/settings/llm', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    writes += 1;
    if (hold) await held;
    await route.continue();
  });
  try {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Maximum output tokens', { exact: true }).fill('32000');
    await page.getByRole('button', { name: 'Save limits', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Provider limits saved.');
    await page.getByLabel('Maximum output tokens', { exact: true }).fill('33333');
    await expect(page.getByText('Provider limits saved.', { exact: true })).toBeHidden();
    hold = true;
    waitForWrite = page.waitForResponse(response => response.url().endsWith('/api/settings/llm') && response.request().method() === 'PUT', { timeout: 5000 }).catch(() => null);
    await page.getByRole('button', { name: 'Save limits', exact: true }).click();
    await expect.poll(() => writes).toBe(2);
    await expect(page.getByLabel('Maximum output tokens', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('Request timeout (seconds)', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save limits', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Reset to defaults', exact: true })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: 'Travellers', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeDisabled();
    await expect(page.getByRole('status')).toHaveText('Saving provider limits...');
    release();
    await expect(page.getByRole('status')).toHaveText('Provider limits saved.');
    await expect(page.getByLabel('Maximum output tokens', { exact: true })).toBeEnabled();
    expect(writes).toBe(2);
  } finally {
    release();
    await waitForWrite;
    await page.unroute('**/api/settings/llm');
    expect((await request.put('/api/settings/llm', { data: { maxOutputTokens: null, requestTimeoutMs: null } })).ok()).toBeTruthy();
  }
});

test('failed Reset retries the reset operation and newer edits replace that retry', async ({ page, request }) => {
  let reject = true;
  const writes: unknown[] = [];
  await request.put('/api/settings/llm', { data: { maxOutputTokens: 32000, requestTimeoutMs: 90000 } });
  await page.route('**/api/settings/llm', route => {
    if (route.request().method() !== 'PUT') return route.continue();
    writes.push(route.request().postDataJSON());
    return reject ? route.fulfill({ status: 503, json: { error: 'QA reset unavailable' } }) : route.continue();
  });
  try {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Reset to defaults', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'QA reset unavailable' })).toBeVisible();
    await expect(page.getByLabel('Maximum output tokens', { exact: true })).toHaveValue('32000');
    reject = false;
    await page.getByRole('button', { name: 'Retry provider limits', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Provider limits reset to the defaults.');
    expect(writes.slice(0, 2)).toEqual([{ maxOutputTokens: null, requestTimeoutMs: null }, { maxOutputTokens: null, requestTimeoutMs: null }]);
    reject = true;
    await page.getByRole('button', { name: 'Reset to defaults', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'QA reset unavailable' })).toBeVisible();
    await page.getByLabel('Maximum output tokens', { exact: true }).fill('33333');
    await expect(page.getByRole('button', { name: 'Retry provider limits', exact: true })).toBeHidden();
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toBeHidden();
    reject = false;
    await page.getByRole('button', { name: 'Save limits', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Provider limits saved.');
    expect(writes.at(-1)).toEqual({ maxOutputTokens: 33333, requestTimeoutMs: 600000 });
  } finally {
    expect((await request.put('/api/settings/llm', { data: { maxOutputTokens: null, requestTimeoutMs: null } })).ok()).toBeTruthy();
  }
});
