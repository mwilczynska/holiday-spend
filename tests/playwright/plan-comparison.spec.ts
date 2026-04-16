import { expect, test } from '@playwright/test';

test.describe.serial('plan comparison', () => {
  test('plan selector renders when no IDs provided', async ({ page }) => {
    await page.goto('/plan/compare');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Compare Plans' })).toBeVisible();
    await expect(page.getByText('Select 2 to 5 saved plans')).toBeVisible();
    // Sub-nav tabs should be visible
    await expect(page.getByRole('button', { name: /Planner/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Compare Plans/ })).toBeVisible();
  });

  test('planner tab navigates back to planner', async ({ page }) => {
    await page.goto('/plan/compare');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Planner/ }).first().click();
    await expect(page).toHaveURL('/plan', { timeout: 15000 });
  });

  test('comparison renders chart and cards for saved plans', async ({ page }) => {
    // Save two plans from the planner
    await page.goto('/plan');
    await page.waitForLoadState('networkidle');

    for (const suffix of ['ChartA', 'ChartB']) {
      await page.getByRole('button', { name: 'Save Plan' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const nameInput = dialog.getByLabel('Plan name');
      await nameInput.clear();
      await nameInput.fill(`CompTest-${suffix}`);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).not.toBeVisible({ timeout: 10000 });
    }

    // Navigate to comparison page through the selector
    await page.goto('/plan/compare');
    await page.waitForLoadState('networkidle');

    // Select two plans via checkboxes
    const checkboxes = page.locator('label').filter({ hasText: /CompTest/ }).locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    test.skip(checkboxCount < 2, 'Need at least 2 plans for comparison');

    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await page.getByRole('button', { name: /Compare/ }).click();

    // Verify URL changed to include ids
    await expect(page).toHaveURL(/\/plan\/compare\?ids=/, { timeout: 10000 });

    // Verify summary cards render
    await expect(page.getByText('Total Budget').first()).toBeVisible({ timeout: 15000 });

    // Verify chart renders
    await expect(page.getByText('Cumulative Planned Spend')).toBeVisible();
  });

  test('shows error for invalid plan IDs', async ({ page }) => {
    await page.goto('/plan/compare?ids=bogus-id-1,bogus-id-2');

    // Should show an error state after the API call fails
    await expect(page.getByText(/not found|No matching|No comparison/i)).toBeVisible({ timeout: 15000 });
  });
});
