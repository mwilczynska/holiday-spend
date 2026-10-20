import { expect, test, type Page } from '@playwright/test';
import { expandLegCard } from './client-navigation';

test.describe.configure({ mode: 'serial' });
async function mockCurrency(page: Page, failure?: { mode: 'reject' | 'mismatch' | null }) {
  let state = { currency: 'AUD', rate: 1 as number | null, asOf: null as string | null, error: null as string | null };
  await page.route('**/api/settings/currency', async route => {
    if (route.request().method() === 'PUT') {
      if (failure?.mode === 'reject') return route.fulfill({ status: 503, json: { error: 'FX provider unavailable' } });
      if (failure?.mode === 'mismatch') return route.fulfill({ json: { data: state } });
      const currency = route.request().postDataJSON().currency;
      state = { currency, rate: currency === 'AUD' ? 1 : 0.5, asOf: currency === 'AUD' ? null : '2026-10-20', error: null };
    }
    await route.fulfill({ json: { data: state } });
  });
  return (next: typeof state) => { state = next; };
}
async function selectCurrency(page: Page, code: string) {
  await page.getByRole('combobox', { name: 'Display currency', exact: true }).click();
  await page.getByRole('option', { name: new RegExp('^' + code + ' —') }).click();
}

test('currency controls share totals and inputs; switching never rewrites AUD amounts', async ({ page }) => {
  test.setTimeout(90000);
  await page.request.put('/api/settings/currency', { data: { currency: 'AUD' } });
  const cities = (await (await page.request.get('/api/cities')).json()).data;
  const created = await page.request.post('/api/itinerary/legs', { data: { cityId: cities[0].id, nights: 2,
    miscellaneousExpenses: [{ description: 'Currency test', cost: 100 }] } });
  expect(created.ok()).toBeTruthy();
  const id = (await created.json()).data.id;
  const readLeg = async () => (await (await page.request.get('/api/itinerary')).json()).data.find((leg: { id: number }) => leg.id === id);
  await page.request.put('/api/itinerary/legs/' + id, { data: { accomOverride: 0, foodOverride: 0, drinksOverride: 0, activitiesOverride: 0, transportOverride: 0 } });
  await mockCurrency(page);
  try {
    await page.goto('/plan');
    const card = page.locator('[data-leg-id="' + id + '"]');
    await expect(card).toContainText('$100 total');
    const before = await readLeg();
    await selectCurrency(page, 'EUR');
    await expect(card).toContainText('€50 total');
    expect(await readLeg()).toEqual(before);
    await expandLegCard(card);
    const cost = card.getByLabel('Cost (EUR)', { exact: true });
    await expect(cost).toHaveValue('50');
    await cost.fill('25');
    await expect.poll(async () => (await readLeg()).miscellaneousExpenses[0].cost).toBe(50);
    await expect(card).toContainText('€25 total');
    await card.getByRole('button', { name: 'Show cost overrides', exact: true }).click();
    const override = card.getByLabel('Accom per night (EUR)', { exact: true });
    await override.fill('10');
    await expect.poll(async () => (await readLeg()).accomOverride).toBe(20);
    await expect(card).toContainText('€45 total');
    await override.fill('-2');
    await expect(card.getByRole('alert')).toContainText('finite, nonnegative');
    expect((await readLeg()).accomOverride).toBe(20);
    await card.getByRole('button', { name: 'Discard leg changes', exact: true }).click();
    await expect(override).toHaveValue('10');
    await page.locator('a[href="/settings"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/settings$/, { timeout: 15000 });
    await expect(page.getByRole('combobox', { name: 'Display currency', exact: true })).toContainText('EUR');
    await expect(page.getByText(/1 AUD = 0.5 EUR/)).toBeVisible();
    await selectCurrency(page, 'AUD');
    await expect(page.getByText('Saving currency…', { exact: true })).toBeHidden();
    await page.locator('a[href="/plan"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/plan$/, { timeout: 15000 });
    await expect(card).toContainText('$90 total', { timeout: 15000 });
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('combobox', { name: 'Display currency' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Add Leg', exact: true })).toBeInViewport();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: 'test-results/playwright/currency-mobile.png' });
  } finally { await page.request.delete('/api/itinerary/legs/' + id); }
});

test('failed and mismatched currency saves retain a retryable draft; unavailable rates never show parity', async ({ page }) => {
  test.setTimeout(60000);
  const failure: { mode: 'reject' | 'mismatch' | null } = { mode: 'reject' };
  const setState = await mockCurrency(page, failure);
  await page.goto('/settings');
  await selectCurrency(page, 'EUR');
  await expect(page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Retry currency', exact: true }) })).toContainText('FX provider unavailable');
  await expect(page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Retry currency', exact: true }) })).toContainText('Saved currency: AUD');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Retry currency', exact: true }) })).toContainText('FX provider unavailable');
  await expect(page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Retry currency', exact: true }) })).toContainText('Saved currency: AUD');
  failure.mode = 'mismatch';
  await page.getByRole('button', { name: 'Retry currency', exact: true }).click();
  await expect(page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Retry currency', exact: true }) })).toContainText('did not confirm');
  failure.mode = null;
  await page.getByRole('button', { name: 'Retry currency', exact: true }).click();
  await expect(page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Retry currency', exact: true }) })).toBeHidden();
  setState({ currency: 'EUR', rate: null, asOf: null, error: 'FX provider unavailable' });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('alert').filter({ hasText: 'EUR conversions unavailable' })).toContainText('EUR conversions unavailable');
  await selectCurrency(page, 'AUD');
  await expect(page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Retry currency', exact: true }) })).toBeHidden();
});
