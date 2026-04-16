import { expect, test } from '@playwright/test';

// Run serially since all tests share the same user's saved plans
test.describe.serial('saved plans', () => {
  const uniquePrefix = `E2E-${Date.now()}`;

  test('save a plan and verify it appears in the saved plans list', async ({ page }) => {
    await page.goto('/plan');
    await page.waitForLoadState('networkidle');

    const planName = `${uniquePrefix}-Save`;
    await page.getByRole('button', { name: 'Save Plan' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const nameInput = dialog.getByLabel('Plan name');
    await nameInput.clear();
    await nameInput.fill(planName);
    await dialog.getByRole('button', { name: 'Save' }).click();

    // Wait for dialog to close and success message
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`Saved plan "${planName}"`)).toBeVisible();

    // Expand the saved plans panel
    const savedPlansToggle = page.getByText(/Saved Plans \(\d+\)/);
    await savedPlansToggle.click();

    // Find the plan in the saved plans list (use exact match to avoid matching the status message)
    const planText = page.locator('.rounded-md.border.p-3').getByText(planName, { exact: true });
    await planText.scrollIntoViewIfNeeded();
    await expect(planText).toBeVisible();
  });

  test('saved plans persist across page reload', async ({ page }) => {
    await page.goto('/plan');
    await page.waitForLoadState('networkidle');

    const planName = `${uniquePrefix}-Persist`;
    await page.getByRole('button', { name: 'Save Plan' }).click();
    const dialog = page.getByRole('dialog');
    const nameInput = dialog.getByLabel('Plan name');
    await nameInput.clear();
    await nameInput.fill(planName);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Expand and verify
    const savedPlansToggle = page.getByText(/Saved Plans \(\d+\)/);
    await savedPlansToggle.click();
    const planText = page.locator('.rounded-md.border.p-3').getByText(planName, { exact: true });
    await planText.scrollIntoViewIfNeeded();
    await expect(planText).toBeVisible();
  });

  test('delete a saved plan', async ({ page }) => {
    await page.goto('/plan');
    await page.waitForLoadState('networkidle');

    // Save a plan to delete
    const planName = `${uniquePrefix}-Delete`;
    await page.getByRole('button', { name: 'Save Plan' }).click();
    const dialog = page.getByRole('dialog');
    const nameInput = dialog.getByLabel('Plan name');
    await nameInput.clear();
    await nameInput.fill(planName);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Expand saved plans
    const savedPlansToggle = page.getByText(/Saved Plans \(\d+\)/);
    await savedPlansToggle.click();

    // Find the plan card and click delete
    const planCard = page.locator('.rounded-md.border.p-3').filter({ hasText: planName });
    await planCard.scrollIntoViewIfNeeded();
    await expect(planCard).toBeVisible();
    await planCard.getByRole('button').last().click();

    // Plan card should disappear
    await expect(planCard).not.toBeVisible({ timeout: 10000 });
  });

  test('navigate to comparison page with selected plans', async ({ page }) => {
    await page.goto('/plan');
    await page.waitForLoadState('networkidle');

    // Save two plans sequentially
    for (const suffix of ['Alpha', 'Beta']) {
      await page.getByRole('button', { name: 'Save Plan' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const nameInput = dialog.getByLabel('Plan name');
      await nameInput.clear();
      await nameInput.fill(`${uniquePrefix}-Cmp-${suffix}`);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).not.toBeVisible({ timeout: 10000 });
    }

    // Expand saved plans
    const savedPlansToggle = page.getByText(/Saved Plans \(\d+\)/);
    await savedPlansToggle.click();

    // Select first two checkboxes
    const checkboxes = page.locator('input[type="checkbox"][title="Select for comparison"]');
    await expect(checkboxes.first()).toBeVisible();
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    // Click Compare Selected
    await page.getByRole('button', { name: 'Compare Selected' }).click();

    // Should navigate to comparison page
    await expect(page).toHaveURL(/\/plan\/compare\?ids=/, { timeout: 10000 });
  });
});
