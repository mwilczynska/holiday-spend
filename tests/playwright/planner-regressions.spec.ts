import { expect, test } from '@playwright/test';

test.describe('planner regressions', () => {
test('trip summary sits close to the header and stays pinned while scrolling', async ({ page }) => {
    await page.goto('/plan');

    const header = page.locator('div.fixed.inset-x-0.top-0.z-30').first();
    const tripSummary = page.getByText('Trip Summary').first();
    const tripSummaryCard = page.locator('div.rounded-lg.border').filter({ has: tripSummary }).first();

    await expect(tripSummaryCard).toBeVisible();

    const headerBox = await header.boundingBox();
    const summaryBoxBefore = await tripSummaryCard.boundingBox();

    expect(headerBox).not.toBeNull();
    expect(summaryBoxBefore).not.toBeNull();

    const initialGap = summaryBoxBefore!.y - (headerBox!.y + headerBox!.height);
    expect(initialGap).toBeLessThan(40);

    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(150);

    const summaryBoxAfter = await tripSummaryCard.boundingBox();
    expect(summaryBoxAfter).not.toBeNull();
    expect(Math.abs(summaryBoxAfter!.y - summaryBoxBefore!.y)).toBeLessThan(12);
  });

  test('new city dialog fields accept typing without blocking the UI', async ({ page }) => {
    await page.goto('/plan');

    await page.getByRole('button', { name: 'Add Leg' }).click();
    await page.getByRole('button', { name: 'New City' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const cityInput = dialog.getByPlaceholder('e.g. Kunming');
    const countryInput = dialog.getByPlaceholder('e.g. China');

    await cityInput.pressSequentially('San Cristobal de las Casas', { delay: 15 });
    await countryInput.pressSequentially('Mexico', { delay: 15 });

    await expect(cityInput).toHaveValue('San Cristobal de las Casas');
    await expect(countryInput).toHaveValue('Mexico');
  });

  test('bottom accommodation info popover remains fully visible near the viewport edge', async ({ page }) => {
    await page.goto('/plan');

    await page.waitForTimeout(250);

    const infoButtons = page.getByRole('button', { name: 'More information about Accommodation' });
    const count = await infoButtons.count();
    test.skip(count === 0, 'No accommodation info buttons are available in the current dataset.');

    const target = infoButtons.last();
    await target.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 500);
    await target.hover();

    const popover = page.getByTestId('info-popover-content');
    await expect(popover).toBeVisible();

    const box = await popover.boundingBox();
    expect(box).not.toBeNull();

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  });
});
