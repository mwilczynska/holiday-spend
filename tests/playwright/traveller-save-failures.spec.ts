import { expect, test } from '@playwright/test';

test('rejected traveller selections remain drafts through failed reads and recover with Retry', async ({ page, request }) => {
  const confirmed = (await (await request.get('/api/planner/settings')).json()).data.groupSize as number;
  const wanted = confirmed === 5 ? 4 : 5;
  let mode: 'http' | 'unreadable' | 'invalid' | 'wrong' | 'network' | 'success' = 'http';
  let failReads = true;
  await page.route('**/api/planner/settings', route => {
    if (route.request().method() === 'GET') return failReads ? route.fulfill({ status: 503, json: { error: 'QA traveller read unavailable' } }) : route.continue();
    if (mode === 'http') return route.fulfill({ status: 503, json: { error: 'QA traveller save unavailable' } });
    if (mode === 'unreadable') return route.fulfill({ contentType: 'text/plain', body: 'not JSON' });
    if (mode === 'invalid') return route.fulfill({ json: { data: { groupSize: 9 } } });
    if (mode === 'wrong') return route.fulfill({ json: { data: { groupSize: wanted === 4 ? 3 : 4 } } });
    if (mode === 'network') return route.abort();
    return route.continue();
  });
  try {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: `${wanted} travellers`, exact: true }).click();
    await expect(page.getByText(`Unsaved selection: ${wanted} travellers. Last confirmed saved count: ${confirmed}.`, { exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'QA traveller read unavailable' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'QA traveller save unavailable' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry traveller count', exact: true })).toBeDisabled();
    failReads = false;
    await page.getByRole('button', { name: 'Retry settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry settings', exact: true })).toBeHidden();
    await expect(page.getByRole('combobox').first()).toHaveText(`${wanted} travellers`);
    for (const failure of ['unreadable', 'invalid', 'wrong'] as const) {
      mode = failure;
      await page.getByRole('button', { name: 'Retry traveller count', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'did not confirm the requested traveller count' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry traveller count', exact: true })).toBeEnabled();
      await expect(page.getByText(`Unsaved selection: ${wanted} travellers. Last confirmed saved count: ${confirmed}.`, { exact: true })).toBeVisible();
    }
    mode = 'network';
    await page.getByRole('button', { name: 'Retry traveller count', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /fetch|connection/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry traveller count', exact: true })).toBeEnabled();
    mode = 'success';
    await page.getByRole('button', { name: 'Retry traveller count', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(`Traveller count set to ${wanted}.`);
    await expect(page.getByText(/Unsaved selection:/)).toBeHidden();
    await page.reload();
    await expect(page.getByRole('combobox').first()).toHaveText(`${wanted} travellers`);
    expect((await (await request.get('/api/planner/settings')).json()).data.groupSize).toBe(wanted);
  } finally {
    expect((await request.put('/api/planner/settings', { data: { groupSize: confirmed } })).ok()).toBeTruthy();
  }
});

test('pending traveller saves lock submissions until confirmed', async ({ page, request }) => {
  const confirmed = (await (await request.get('/api/planner/settings')).json()).data.groupSize as number;
  const wanted = confirmed === 5 ? 4 : 5;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let writes = 0;
  let waitForWrite: Promise<unknown> | undefined;
  await page.route('**/api/planner/settings', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    writes += 1;
    await held;
    await route.continue();
  });
  try {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    waitForWrite = page.waitForResponse(response => response.url().endsWith('/api/planner/settings') && response.request().method() === 'PUT', { timeout: 5000 }).catch(() => null);
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: `${wanted} travellers`, exact: true }).click();
    await expect.poll(() => writes).toBe(1);
    await expect(page.getByRole('combobox').first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Discard selection', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeDisabled();
    await expect(page.getByRole('status')).toHaveText('Saving traveller count...');
    await expect(page.getByText(`Unsaved selection: ${wanted} travellers. Last confirmed saved count: ${confirmed}.`, { exact: true })).toBeVisible();
    release();
    await expect(page.getByRole('status')).toHaveText(`Traveller count set to ${wanted}.`);
    await expect(page.getByRole('combobox').first()).toBeEnabled();
    expect(writes).toBe(1);
  } finally {
    release();
    await waitForWrite;
    await page.unroute('**/api/planner/settings');
    expect((await request.put('/api/planner/settings', { data: { groupSize: confirmed } })).ok()).toBeTruthy();
  }
});

test('discarding a rejected traveller selection returns to the saved value without another write', async ({ page }) => {
  const confirmed = (await (await page.request.get('/api/planner/settings')).json()).data.groupSize as number;
  const wanted = confirmed === 5 ? 4 : 5;
  let writes = 0;
  await page.route('**/api/planner/settings', route => {
    if (route.request().method() !== 'PUT') return route.continue();
    writes += 1;
    return route.fulfill({ status: 503, json: { error: 'QA discard traveller draft' } });
  });
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: `${wanted} travellers`, exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'QA discard traveller draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard selection', exact: true }).click();
  await expect(page.getByText(/Unsaved selection:/)).toBeHidden();
  await expect(page.getByRole('combobox').first()).toHaveText(`${confirmed} ${confirmed === 1 ? 'traveller' : 'travellers'}`);
  expect(writes).toBe(1);
});

test('a saved traveller count is recovered when the write acknowledgement is unreadable', async ({ page, request }) => {
  const confirmed = (await (await request.get('/api/planner/settings')).json()).data.groupSize as number;
  const wanted = confirmed === 5 ? 4 : 5;
  await page.route('**/api/planner/settings', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    const saved = await route.fetch();
    expect(saved.ok()).toBeTruthy();
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'unreadable acknowledgement' });
  });
  try {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: `${wanted} travellers`, exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(`Traveller count set to ${wanted}.`);
    await expect(page.getByText(/Unsaved selection:/)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Retry traveller count', exact: true })).toBeHidden();
    expect((await (await request.get('/api/planner/settings')).json()).data.groupSize).toBe(wanted);
  } finally {
    expect((await request.put('/api/planner/settings', { data: { groupSize: confirmed } })).ok()).toBeTruthy();
  }
});
