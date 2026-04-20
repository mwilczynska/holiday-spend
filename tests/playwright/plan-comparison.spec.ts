import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

test.describe.serial('plan comparison', () => {
  const uniquePrefix = `CmpE2E-${Date.now()}`;
  const seededPlanNames = ['One', 'Two', 'Three', 'Four', 'Five'].map(
    (suffix) => `${uniquePrefix}-Seed-${suffix}`
  );
  let hasSeededSavedPlans = false;

  async function seedSavedPlans(request: APIRequestContext) {
    if (hasSeededSavedPlans) return;

    const [snapshotResponse, itineraryResponse] = await Promise.all([
      request.get('/api/itinerary/snapshot'),
      request.get('/api/itinerary'),
    ]);

    expect(snapshotResponse.ok()).toBeTruthy();
    expect(itineraryResponse.ok()).toBeTruthy();

    const snapshotPayload = await snapshotResponse.json();
    const itineraryPayload = await itineraryResponse.json();
    const snapshot = snapshotPayload.data;
    const itinerary = itineraryPayload.data as Array<{ legTotal: number }>;
    const totalBudget =
      itinerary.reduce((sum, leg) => sum + (leg.legTotal ?? 0), 0) +
      snapshot.fixedCosts.reduce(
        (sum: number, fixedCost: { amountAud: number }) => sum + (fixedCost.amountAud ?? 0),
        0
      );

    for (const planName of seededPlanNames) {
      const saveResponse = await request.post('/api/saved-plans', {
        data: {
          name: planName,
          snapshot: { ...snapshot, name: planName, exportedAt: new Date().toISOString() },
          summary: {
            legCount: snapshot.legs.length,
            totalNights: snapshot.legs.reduce(
              (sum: number, leg: { nights: number }) => sum + (leg.nights ?? 0),
              0
            ),
            totalBudget,
            fixedCostCount: snapshot.fixedCosts.length,
          },
        },
      });

      expect(saveResponse.ok()).toBeTruthy();
    }

    hasSeededSavedPlans = true;
  }

  async function openCompareSelector(page: Page) {
    await page.goto('/plan/compare');
    await page.evaluate(() => sessionStorage.removeItem('wanderledger.compare-ids'));
    await page.goto('/plan/compare');
    await page.waitForLoadState('networkidle');
  }

  async function compareNamedPlans(page: Page, planNames: string[]) {
    await openCompareSelector(page);

    for (const planName of planNames) {
      const checkbox = page.locator('label').filter({ hasText: planName }).locator('input[type="checkbox"]');
      await expect(checkbox).toBeVisible({ timeout: 15_000 });
      await checkbox.check();
    }

    await page.getByRole('button', { name: /Compare/ }).last().click();
    await expect(page).toHaveURL(/\/plan\/compare\?ids=/, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Change Plans/ })).toBeVisible();
  }

  test('plan selector renders when no IDs provided', async ({ page }) => {
    // Clear any stored comparison IDs
    await page.goto('/plan/compare');
    await page.evaluate(() => sessionStorage.removeItem('wanderledger.compare-ids'));
    await page.goto('/plan/compare');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Compare Plans' })).toBeVisible();
    await expect(page.getByText('Select 2')).toBeVisible();
  });

  test('compare sidebar navigates to compare page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click Compare in sidebar
    const compareNav = page.locator('aside').getByRole('button', { name: 'Compare' });
    await expect(compareNav).toBeVisible();
    await compareNav.click();
    await expect(page).toHaveURL(/\/plan\/compare/, { timeout: 15000 });
  });

  test('comparison renders chart and cards for saved plans', async ({ page, request }) => {
    await seedSavedPlans(request);

    await compareNamedPlans(page, seededPlanNames.slice(0, 2));

    await expect(page.getByText('Planned Total').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Cumulative Planned Spend')).toBeVisible();
    await expect(page.getByRole('button', { name: /Change Plans/ })).toBeVisible();
  });

  test('two-plan compare keeps analytics cards side-by-side and all expand dialogs open', async ({ page, request }) => {
    await seedSavedPlans(request);
    const planNames = seededPlanNames.slice(0, 2);
    await compareNamedPlans(page, planNames);

    await expect(page.getByText('Plan Overview')).toBeVisible();
    await expect(page.getByText('Spend Over Time')).toBeVisible();
    await expect(page.getByText('Plan Breakdown')).toBeVisible();

    const countryHeading = page.getByText('Planned Spend by Country').first();
    const categoryHeading = page.getByText('Planned Spend by Category').first();
    const countryBox = await countryHeading.boundingBox();
    const categoryBox = await categoryHeading.boundingBox();

    expect(countryBox).not.toBeNull();
    expect(categoryBox).not.toBeNull();
    expect(Math.abs((countryBox?.y ?? 0) - (categoryBox?.y ?? 0))).toBeLessThan(24);
    expect((categoryBox?.x ?? 0) - (countryBox?.x ?? 0)).toBeGreaterThan(120);

    const expandButtons = page.getByRole('button', { name: 'Expand' });
    await expect(expandButtons).toHaveCount(3);

    for (let index = 0; index < 3; index += 1) {
      await expandButtons.nth(index).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  });

  test('five-plan compare stacks breakdown charts vertically and keeps charts readable', async ({ page, request }) => {
    await seedSavedPlans(request);
    const planNames = seededPlanNames;
    await compareNamedPlans(page, planNames);

    await expect(page.getByText('Comparing 5 plans.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Planned Spend by Country').first()).toBeVisible();
    await expect(page.getByText('Planned Spend by Category').first()).toBeVisible();

    const countryHeading = page.getByText('Planned Spend by Country').first();
    const categoryHeading = page.getByText('Planned Spend by Category').first();
    const countryBox = await countryHeading.boundingBox();
    const categoryBox = await categoryHeading.boundingBox();

    expect(countryBox).not.toBeNull();
    expect(categoryBox).not.toBeNull();
    expect((categoryBox?.y ?? 0) - (countryBox?.y ?? 0)).toBeGreaterThan(150);

    for (const planName of planNames) {
      await expect(page.getByRole('heading', { name: planName }).first()).toBeVisible();
    }
  });

  test('shows error for invalid plan IDs', async ({ page }) => {
    await page.goto('/plan/compare?ids=bogus-id-1,bogus-id-2');

    // Should show an error state after the API call fails
    await expect(page.getByText(/not found|No matching|No comparison/i)).toBeVisible({ timeout: 15000 });
  });
});
