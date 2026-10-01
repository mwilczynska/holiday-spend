import { expect, test } from '@playwright/test';

test('full loads contain data before JavaScript and avoid initial API refetches', async ({ page, request }) => {
  test.setTimeout(60_000);
  const legs = (await (await request.get('/api/itinerary')).json()).data;
  expect(legs.length).toBeGreaterThan(0);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [path, marker] of [
    ['/plan', 'data-testid="planner-leg-card"'],
    ['/dataset', 'data-testid="dataset-city-table"'],
    ['/settings', 'Provider Request Limits'],
  ]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html).toContain(marker);
    if (path === '/plan') {
      expect(html.split('data-testid="planner-leg-card"').length - 1).toBe(legs.length);
      expect(html).toContain('Historical averages');
    }
    const apiRequests: string[] = [];
    const collect = (url: string) => {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/api/') && !parsed.pathname.startsWith('/api/auth/')) apiRequests.push(parsed.pathname);
    };
    const listener = (request: import('@playwright/test').Request) => collect(request.url());
    page.on('request', listener);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    if (path === '/plan') {
      await expect(page.getByTestId('planner-leg-card')).toHaveCount(legs.length);
      await expect(page.locator('section[aria-label="Trip historical climate"]').getByRole('img', { name: /Historical mean temperature/ })).toBeVisible();
      // The complete fixture has saved weather, so no read or collection is necessary.
      expect(apiRequests).toEqual([]);
    } else {
      expect(apiRequests).toEqual([]);
    }
    page.off('request', listener);
  }
  expect(errors).toEqual([]);
});

test('returning to the planner refreshes cached data and retains all cards', async ({ page, request }) => {
  test.setTimeout(60_000);
  const legs = (await (await request.get('/api/itinerary')).json()).data;
  expect(legs.length).toBeGreaterThan(0);
  await page.goto('/plan');
  await page.waitForLoadState('networkidle');
  await page.locator('a[href="/settings"]').filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  let reads = 0;
  await page.route('**/api/itinerary', async route => {
    reads++;
    await route.fulfill({ json: { data: legs.map((leg: { id: number }) => leg.id === legs[0].id ? { ...leg, cityName: 'Fresh itinerary response' } : leg) } });
  });
  await page.locator('a[href="/plan"]').filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Fresh itinerary response', exact: true })).toBeVisible();
  await expect(page.getByTestId('planner-leg-card')).toHaveCount(legs.length);
  expect(reads).toBe(1);
});

test('dataset and settings refresh on their first client navigation', async ({ page, request }) => {
  test.setTimeout(60_000);
  const countries = (await (await request.get('/api/countries')).json()).data;
  const firstCountry = countries.find((country: { cities: unknown[] }) => country.cities.length > 0);
  const cityId = firstCountry.cities[0].id;
  await page.goto('/estimates');
  await page.waitForLoadState('networkidle');
  await page.route('**/api/countries', route => route.fulfill({ json: { data: countries.map((country: { cities: Array<{ id: string }> }) => ({
    ...country, cities: country.cities.map(city => city.id === cityId ? { ...city, name: 'Fresh dataset response' } : city),
  })) } }));
  await page.locator('a[href="/dataset"]').filter({ visible: true }).first().click();
  await page.getByLabel('Search dataset', { exact: true }).fill('Fresh dataset response');
  await expect(page.getByTestId('dataset-city-table').locator('tbody')).toContainText('Fresh dataset response');
  await page.route('**/api/planner/settings', route => route.fulfill({ json: { data: { groupSize: 5 } } }));
  await page.locator('a[href="/settings"]').filter({ visible: true }).first().click();
  await expect(page.getByRole('combobox').first()).toHaveText('5 travellers');
  // Exercise hydration without a write.
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
});
