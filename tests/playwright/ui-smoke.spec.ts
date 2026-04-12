import { test, expect, type Page, type TestInfo } from '@playwright/test';

async function captureFullPage(page: Page, testInfo: TestInfo, filename: string) {
  await page.screenshot({
    path: testInfo.outputPath(filename),
    fullPage: true,
  });
}

test.describe('app UI smoke', () => {
  test('dashboard renders', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Wanderledger' }).first()).toBeVisible();
    await captureFullPage(page, testInfo, 'dashboard.png');
  });

  test('planner renders', async ({ page }, testInfo) => {
    await page.goto('/plan');
    await expect(page).toHaveURL(/\/plan$/);
    await captureFullPage(page, testInfo, 'plan.png');
  });

  test('estimates page renders', async ({ page }, testInfo) => {
    await page.goto('/estimates');
    await expect(page).toHaveURL(/\/estimates$/);
    await captureFullPage(page, testInfo, 'estimates.png');
  });

  test('city library renders', async ({ page }, testInfo) => {
    await page.goto('/settings/cities');
    await expect(page).toHaveURL(/\/settings\/cities$/);
    await captureFullPage(page, testInfo, 'settings-cities.png');
  });

  test('dashboard expanded charts open when available', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Wanderledger' }).first()).toBeVisible();

    const expandButtons = page.getByRole('button', { name: 'Expand' });
    const firstExpandButtonVisible = await expandButtons.first().isVisible({ timeout: 15_000 }).catch(() => false);

    test.skip(!firstExpandButtonVisible, 'No dashboard charts are available yet in the current dataset.');

    const buttonCount = await expandButtons.count();

    const screenshotCount = Math.min(buttonCount, 3);
    for (let index = 0; index < screenshotCount; index += 1) {
      await expandButtons.nth(index).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await captureFullPage(page, testInfo, `dashboard-expanded-${index + 1}.png`);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  });
});
