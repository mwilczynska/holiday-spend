import { expect, test } from '@playwright/test';

test('narrow pages contain wide tables and comparison cards within their scroll areas', async ({ page, request }) => {
  const response = await request.get('/api/saved-plans');
  expect(response.ok()).toBeTruthy();
  const plans = (await response.json()).data as Array<{ id: string }>;
  expect(plans.length).toBeGreaterThanOrEqual(5);

  await page.setViewportSize({ width: 390, height: 844 });
  const routes = [
    { path: `/plan/compare?ids=${plans.slice(0, 5).map(plan => plan.id).join(',')}`, heading: 'Compare Plans' },
    { path: '/plan', heading: 'Itinerary Planner' },
    { path: '/dataset', heading: 'Dataset' },
    { path: '/track', heading: 'Expenses' },
    { path: '/settings', heading: 'Settings' },
  ];
  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.getByRole('heading', { name: route.heading, exact: true }).first()).toBeVisible();
    if (route.path.startsWith('/plan/compare')) {
      await expect(page.getByText('Comparing 5 plans.')).toBeVisible();
    }
    await expect.poll(() => page.evaluate(() => ({
      viewport: window.innerWidth,
      page: document.documentElement.scrollWidth,
    })), { message: `Page overflow at ${route.path}` }).toEqual({ viewport: 390, page: 390 });
    await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeInViewport();
  }
});

test('the pinned planner header stays compact on a phone and keeps its actions in a menu', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/plan');
  await expect(page.getByRole('heading', { name: 'Itinerary Planner', exact: true })).toBeVisible();

  const header = page.locator('div.fixed.top-0').filter({ has: page.getByRole('heading', { name: 'Itinerary Planner' }) });
  const headerBox = await header.boundingBox();
  expect(headerBox?.height ?? Infinity).toBeLessThan(160);
  await expect(page.getByRole('combobox', { name: 'Travellers' })).toHaveText(/\d travellers?/);
  await expect(page.getByRole('button', { name: 'Add Leg' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Save Plan' })).toBeHidden();

  await page.getByRole('button', { name: 'More plan actions' }).click();
  for (const name of ['Save Plan', 'Export', 'Import']) {
    await expect(page.getByRole('menuitem', { name })).toBeVisible();
  }
  await expect(page.getByRole('menuitem', { name: /Estimate Intercity Transport/ })).toBeVisible();
  await page.keyboard.press('Escape');

  // Legs come straight after the banner on a phone; the summaries follow them.
  const top = async (name: string) => (await page.getByRole('heading', { name, exact: true }).first().boundingBox())?.y ?? NaN;
  const banner = (await page.getByRole('region', { name: 'Trip at a glance' }).boundingBox())?.y ?? NaN;
  const legs = await top('Legs');
  expect(banner).toBeLessThan(legs);
  expect(legs).toBeLessThan(await top('Trip summary'));
  expect(legs).toBeLessThan(await top('By country'));

  await page.screenshot({ path: 'test-results/playwright/mobile-planner-header.png' });
});
