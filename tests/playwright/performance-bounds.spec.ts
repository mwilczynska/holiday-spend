import { expect, test } from '@playwright/test';

test.describe('performance render bounds', () => {
  test('planner initially renders at most twelve full leg cards', async ({ page }) => {
    await page.goto('/plan');
    await expect(page.getByText('Trip Summary')).toBeVisible({ timeout: 15_000 });

    const legCards = page.getByTestId('planner-leg-card');
    expect(await legCards.count()).toBeLessThanOrEqual(12);
  });

  test('dataset initially renders at most twenty-five city rows and twenty history rows', async ({ page }) => {
    await page.goto('/dataset');
    await expect(page.getByText('Current Dataset')).toBeVisible({ timeout: 15_000 });

    expect(await page.getByTestId('dataset-city-table').locator('tbody tr').count()).toBeLessThanOrEqual(25);
    expect(await page.getByTestId('dataset-history-table').locator('tbody tr').count()).toBeLessThanOrEqual(20);
  });

  test('expense tracker initially renders at most fifty table rows', async ({ page }) => {
    await page.goto('/track');
    await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible({ timeout: 15_000 });

    expect(await page.getByTestId('expense-table').locator('tbody tr').count()).toBeLessThanOrEqual(50);
  });
});
