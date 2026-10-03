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
