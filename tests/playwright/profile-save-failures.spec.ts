import { expect, test } from '@playwright/test';

test('profile acknowledgements must confirm the requested name before clearing its draft', async ({ page, request }) => {
  let mode: 'missing' | 'unreadable' | 'invalid' | 'wrong' | 'http' | 'network' | 'success' = 'missing';
  await page.route('**/api/user/profile', route => {
    if (mode === 'success') return route.continue();
    if (mode === 'missing') return route.fulfill({ json: { data: {} } });
    if (mode === 'unreadable') return route.fulfill({ contentType: 'text/plain', body: 'not JSON' });
    if (mode === 'invalid') return route.fulfill({ json: { data: { ok: true, name: 42 } } });
    if (mode === 'wrong') return route.fulfill({ json: { data: { ok: true, name: 'Wrong QA name' } } });
    if (mode === 'http') return route.fulfill({ status: 503, json: { error: 'QA profile unavailable' } });
    return route.abort();
  });
  await page.goto('/settings/account');
  const input = page.getByLabel('Display name', { exact: true });
  const original = await input.inputValue();
  try {
    await input.fill('QA retained profile draft');
    for (const failure of ['missing', 'unreadable', 'invalid', 'wrong', 'http', 'network'] as const) {
      mode = failure;
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: failure === 'http' ? 'QA profile unavailable' : failure === 'network' ? /network|fetch|connection/i : 'did not confirm the requested display name' })).toBeVisible();
      await expect(input).toHaveValue('QA retained profile draft');
      await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
      await expect(page.getByText('Display name updated.', { exact: true })).toBeHidden();
    }
    mode = 'success';
    await input.fill('  QA retained profile draft  ');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Display name updated.');
    await page.reload();
    await expect(input).toHaveValue('QA retained profile draft');
    await input.fill('   ');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Display name updated.');
    await expect(input).toHaveValue('');
    await page.reload();
    await expect(input).toHaveValue('');
    const longName = 'Q'.repeat(200);
    await input.fill(longName);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Display name updated.');
    await page.reload();
    await expect(input).toHaveValue(longName);
    await page.setViewportSize({ width: 390, height: 844 });
    await input.fill('QA draft after a long name');
    await expect.poll(() => page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth }))).toEqual({ viewport: 390, page: 390 });
  } finally {
    expect((await request.patch('/api/user/profile', { data: { name: original || null } })).ok()).toBeTruthy();
  }
});

test('pending profile saves lock input and submit once, while newer edits clear old success', async ({ page, request }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let writes = 0;
  let waitForWrite: Promise<unknown> | undefined;
  await page.route('**/api/user/profile', async route => {
    writes += 1;
    await held;
    await route.continue();
  });
  await page.goto('/settings/account');
  const input = page.getByLabel('Display name', { exact: true });
  const original = await input.inputValue();
  try {
    await input.fill('QA serialized profile');
    waitForWrite = page.waitForResponse(response => response.url().endsWith('/api/user/profile'), { timeout: 10000 }).catch(() => null);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => writes).toBe(1);
    await expect(input).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Saving...', exact: true })).toBeDisabled();
    release();
    await expect(page.getByRole('status')).toHaveText('Display name updated.');
    await expect(input).toBeEnabled();
    expect(writes).toBe(1);
    await input.fill('QA newer profile draft');
    await expect(page.getByRole('status')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  } finally {
    release();
    await waitForWrite;
    await page.unroute('**/api/user/profile');
    expect((await request.patch('/api/user/profile', { data: { name: original || null } })).ok()).toBeTruthy();
  }
});
