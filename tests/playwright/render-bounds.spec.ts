import { expect, test } from '@playwright/test';

// These assert the initial DOM bounds from src/lib/performance-bounds.ts, not timings.
// Durations and payload sizes are measured by `npm run performance:check`; naming this
// "performance" previously implied a timing guarantee it never made.
test.describe('initial render bounds', () => {
  test('planner renders every itinerary leg', async ({ page, request }) => {
    const legs = (await (await request.get('/api/itinerary')).json()).data;
    await page.goto('/plan');
    await expect(page.getByText('Trip Summary').filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });

    const legCards = page.getByTestId('planner-leg-card');
    await expect(legCards).toHaveCount(legs.length);
  });

  // Paging was replaced (10 October 2026) by every row inside a scroll area capped to the viewport.
  test('dataset renders every city and history row inside viewport-height scroll areas', async ({ page, request }) => {
    const dataset = (await (await request.get('/api/estimates?view=dataset')).json()).data;
    await page.goto('/dataset');
    await expect(page.getByText('Current Dataset')).toBeVisible({ timeout: 15_000 });

    const cityRows = page.getByTestId('dataset-city-table').locator('tbody tr');
    await expect(cityRows).toHaveCount(Math.max(dataset.rows.length, 1));
    await expect(page.getByTestId('dataset-history-table').locator('tbody tr')).toHaveCount(Math.max(dataset.history.length, 1));

    const viewport = page.viewportSize()!;
    for (const id of ['dataset-city-scroll', 'dataset-history-scroll']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box!.height).toBeLessThanOrEqual(viewport.height);
    }
  });

  test('expense tracker initially renders at most fifty table rows', async ({ page }) => {
    await page.goto('/track');
    await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible({ timeout: 15_000 });

    expect(await page.getByTestId('expense-table').locator('tbody tr').count()).toBeLessThanOrEqual(50);
  });
});
