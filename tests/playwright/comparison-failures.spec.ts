import { expect, test, type APIRequestContext } from '@playwright/test';

async function comparisonFixture(request: APIRequestContext) {
  const plans = (await (await request.get('/api/saved-plans')).json()).data as Array<{ id: string; name: string }>;
  expect(plans.length).toBeGreaterThanOrEqual(3);
  const ids = plans.slice(0, 3).map(plan => plan.id);
  const result = await request.post('/api/saved-plans/compare', { data: { planIds: ids.slice(0, 2) } });
  expect(result.ok()).toBeTruthy();
  return { plans, ids, payload: await result.json() };
}

test('initial comparison list failures show unavailable values and Retry, distinct from valid empty lists', async ({ page }) => {
  let mode: 'http' | 'unreadable' | 'invalid' | 'network' | 'success' | 'empty' = 'http';
  await page.route('**/api/saved-plans', route => {
    if (mode === 'success') return route.continue();
    if (mode === 'empty') return route.fulfill({ json: { data: [] } });
    if (mode === 'http') return route.fulfill({ status: 503, json: { error: 'QA comparison list unavailable' } });
    if (mode === 'unreadable') return route.fulfill({ contentType: 'text/plain', body: 'not JSON' });
    if (mode === 'invalid') return route.fulfill({ json: { data: [{ id: 'broken', name: 'Incomplete plan' }] } });
    return route.abort();
  });
  await page.goto('/plan/compare');
  await expect(page.getByText('Saved plans unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByText('Saved plan count unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByText(/No saved plans yet/)).toBeHidden();
  for (const failure of ['unreadable', 'invalid', 'network'] as const) {
    mode = failure;
    await page.getByRole('button', { name: 'Retry saved plans', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry saved plans', exact: true })).toBeEnabled();
    await expect(page.getByText('Saved plans unavailable.', { exact: true })).toBeVisible();
    await expect(page.getByText(/No saved plans yet/)).toBeHidden();
  }
  mode = 'success';
  await page.getByRole('button', { name: 'Retry saved plans', exact: true }).click();
  await expect(page.getByRole('checkbox').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry saved plans', exact: true })).toBeHidden();
  mode = 'empty';
  await page.reload();
  await expect(page.getByText(/No saved plans yet/)).toBeVisible();
  await expect(page.getByText('Saved plans unavailable.', { exact: true })).toBeHidden();
});

test('failed comparison-list refresh retains the last loaded list and selections', async ({ page, request }) => {
  const { plans, ids } = await comparisonFixture(request);
  let fail = false;
  await page.route('**/api/saved-plans', route => fail ? route.fulfill({ status: 503, json: { error: 'QA retained comparison list' } }) : route.continue());
  await page.goto('/plan/compare');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('checkbox')).toHaveCount(plans.length);
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('checkbox').nth(1).check();
  await page.getByRole('button', { name: 'Compare (2 selected)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change Plans', exact: true })).toBeVisible();
  fail = true;
  await page.getByRole('button', { name: 'Change Plans', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'QA retained comparison list' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(plans.length);
  await expect(page.getByRole('checkbox').nth(0)).toBeChecked();
  await expect(page.getByRole('checkbox').nth(1)).toBeChecked();
  await expect(page.getByRole('checkbox').nth(0)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Compare (2 selected)', exact: true })).toBeDisabled();
  await expect(page.getByText(/No saved plans yet/)).toBeHidden();
  fail = false;
  await page.getByRole('button', { name: 'Retry saved plans', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Compare (2 selected)', exact: true })).toBeEnabled();
  await expect(page.getByRole('checkbox').nth(0)).toBeChecked();
  await page.getByRole('button', { name: 'Compare (2 selected)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change Plans', exact: true })).toBeVisible();
  await expect(page).toHaveURL(`/plan/compare?ids=${ids.slice(0, 2).join(',')}`);
});

test('comparison failures from the selector remain visible and Retry requires complete valid results', async ({ page, request }) => {
  const { payload, plans } = await comparisonFixture(request);
  let mode: 'http' | 'unreadable' | 'missing' | 'empty' | 'partial' | 'invalid' | 'wrong' | 'network' | 'success' = 'http';
  await page.route('**/api/saved-plans/compare', route => {
    if (mode === 'success') return route.continue();
    if (mode === 'http') return route.fulfill({ status: 503, json: { error: 'QA comparison calculation unavailable' } });
    if (mode === 'unreadable') return route.fulfill({ contentType: 'text/plain', body: 'not JSON' });
    if (mode === 'missing') return route.fulfill({ json: { data: {} } });
    if (mode === 'empty') return route.fulfill({ json: { data: { plans: [] } } });
    if (mode === 'partial') return route.fulfill({ json: { data: { plans: payload.data.plans.slice(0, 1) } } });
    if (mode === 'invalid') return route.fulfill({ json: { data: { plans: payload.data.plans.map((plan: object) => ({ ...plan, summary: { totalBudget: -1 } })) } } });
    if (mode === 'wrong') return route.fulfill({ json: { data: { plans: [...payload.data.plans].reverse() } } });
    return route.abort();
  });
  await page.goto('/plan/compare');
  await page.waitForLoadState('networkidle');
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('checkbox').nth(1).check();
  await page.getByRole('button', { name: 'Compare (2 selected)', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'QA comparison calculation unavailable' })).toBeVisible();
  await expect(page.getByRole('checkbox').nth(0)).toBeChecked();
  await expect(page.getByRole('checkbox').nth(1)).toBeChecked();
  for (const failure of ['unreadable', 'missing', 'empty', 'partial', 'invalid', 'wrong', 'network'] as const) {
    mode = failure;
    await page.getByRole('button', { name: 'Retry comparison', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry comparison', exact: true })).toBeEnabled();
    await expect(page.getByRole('alert').filter({ hasText: 'Comparison unavailable.' })).toBeVisible();
    await expect(page.getByRole('checkbox').nth(0)).toBeChecked();
    await expect(page.getByRole('heading', { name: 'Plan Overview', exact: true })).toBeHidden();
  }
  mode = 'success';
  await page.getByRole('button', { name: 'Retry comparison', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change Plans', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: plans[0].name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry comparison', exact: true })).toBeHidden();
});

test('failed history navigation retains previous results and obsolete comparisons cannot replace newer results', async ({ page, request }) => {
  const { ids, plans, payload } = await comparisonFixture(request);
  let mode: 'success' | 'reject' | 'hold' = 'success';
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let paused = false;
  let obsoleteDone: Promise<unknown> | undefined;
  await page.route('**/api/saved-plans/compare', async route => {
    const requested = route.request().postDataJSON().planIds as string[];
    if (requested[1] === ids[1] && mode === 'reject') return route.fulfill({ status: 503, json: { error: 'QA history comparison unavailable' } });
    if (requested[1] === ids[1] && mode === 'hold') {
      paused = true;
      await held;
      await route.fulfill({ json: payload });
      return;
    }
    return route.continue();
  });
  try {
    await page.goto(`/plan/compare?ids=${ids.slice(0, 2).join(',')}`);
    await expect(page.getByRole('button', { name: 'Change Plans', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Change Plans', exact: true }).click();
    await expect(page.getByRole('checkbox').nth(1)).toBeEnabled();
    await page.getByRole('checkbox').nth(1).uncheck();
    await page.getByRole('checkbox').nth(2).check();
    await page.getByRole('button', { name: 'Compare (2 selected)', exact: true }).click();
    await expect(page.getByRole('heading', { name: plans[2].name, exact: true })).toBeVisible();
    mode = 'reject';
    await page.goBack();
    await expect(page.getByRole('alert').filter({ hasText: 'QA history comparison unavailable' })).toBeVisible();
    await expect(page.getByText('Showing the previous comparison; it may be out of date.', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: plans[2].name, exact: true })).toBeVisible();
    mode = 'hold';
    obsoleteDone = page.waitForResponse(response => response.url().endsWith('/api/saved-plans/compare') && response.request().postDataJSON().planIds[1] === ids[1], { timeout: 10000 }).catch(() => null);
    await page.getByRole('button', { name: 'Retry comparison', exact: true }).click();
    await expect.poll(() => paused).toBeTruthy();
    await expect(page.getByRole('heading', { name: plans[2].name, exact: true })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('button', { name: 'Change Plans', exact: true })).toBeEnabled();
    release();
    await obsoleteDone;
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: plans[2].name, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: plans[1].name, exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Retry comparison', exact: true })).toBeHidden();
  } finally { release(); }
});

test('comparison API rejects malformed, duplicate and partially missing IDs atomically', async ({ request }) => {
  const { ids } = await comparisonFixture(request);
  for (const planIds of [null, [], [ids[0], ids[0]], [ids[0], 1], [''], Array(6).fill(ids[0])]) {
    expect((await request.post('/api/saved-plans/compare', { data: { planIds } })).status()).toBe(400);
  }
  const missing = await request.post('/api/saved-plans/compare', { data: { planIds: [ids[0], 'qa-nonexistent-plan'] } });
  expect(missing.status()).toBe(404);
  expect((await missing.json()).data).toBeUndefined();
  const complete = await request.post('/api/saved-plans/compare', { data: { planIds: ids.slice(0, 2).reverse() } });
  expect(complete.ok()).toBeTruthy();
  expect((await complete.json()).data.plans.map((plan: { id: string }) => plan.id)).toEqual(ids.slice(0, 2).reverse());
});
