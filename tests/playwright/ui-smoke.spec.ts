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
    await expect(page.getByRole('heading', { name: 'Holiday Spend' }).first()).toBeVisible();
    await captureFullPage(page, testInfo, 'dashboard.png');
  });

  test('dashboard cumulative chart defines each line style', async ({ page }) => {
    await page.route('**/api/dashboard/summary', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          totalBudget: 5000,
          plannedLegsTotal: 4500,
          fixedTotal: 500,
          groupSize: 2,
          totalSpent: 150,
          plannedToDate: 160,
          varianceToDate: -10,
          projectedTotal: 4300,
          forecastVariance: -200,
          remainingLegBudget: 4350,
          remaining: 4850,
          asOfDate: '2026-08-26',
          asOfSource: 'today',
          daysElapsed: 2,
          daysRemaining: 28,
          totalNights: 30,
          destinations: 2,
          expenseCount: 2,
          burnRate: {
            tripAvg: 75,
            plannedAvgSoFar: 80,
            sevenDayAvg: 75,
            thirtyDayAvg: 75,
            requiredDailyPace: 155,
          },
          budgetHealth: 'on_track',
        },
      }),
    }));
    await page.route('**/api/dashboard/planned-vs-actual', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { comparison: [], actualCategoryTotals: {}, plannedCategoryTotals: {} },
      }),
    }));
    await page.route('**/api/dashboard/burn-rate', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          cumulative: [
            { date: '2026-08-25', cumulative: 100, daily: 100, plannedCumulative: 80, plannedDaily: 80, countryName: 'Japan', cityName: 'Tottori', legStatus: 'completed' },
            { date: '2026-08-26', cumulative: 150, daily: 50, plannedCumulative: 160, plannedDaily: 80, countryName: 'Japan', cityName: 'Tottori', legStatus: 'planned' },
          ],
          countryBands: [{ countryName: 'Japan', startDate: '2026-08-25', endDate: '2026-08-26', pointCount: 2 }],
        },
      }),
    }));

    await page.goto('/');
    const chartTitle = page.getByText('Cumulative Spend Over Time', { exact: true });
    await expect(chartTitle).toBeVisible();

    for (const label of [
      'Actual spend',
      'Actual spend · leg still planned',
      'Planned estimate',
      'Total trip budget',
    ]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    const plannedEstimateSwatch = page.getByText('Planned estimate', { exact: true }).first().locator('..').locator('span').first();
    const budgetSwatch = page.getByText('Total trip budget', { exact: true }).first().locator('..').locator('span').first();
    await expect(plannedEstimateSwatch).toHaveCSS('border-top-style', 'dashed');
    await expect(budgetSwatch).toHaveCSS('border-top-style', 'dashed');
  });

  test('transaction import submits multiple CSV files and handles the confirmation response', async ({ page }) => {
    const requestBodies: string[] = [];
    let requestCount = 0;
    const previewExpense = {
      date: '2026-08-01',
      amount: 14,
      currency: 'AUD',
      amountAud: 14,
      category: 'food',
      subcategory: 'Food & Drink',
      description: 'trip',
      merchant: 'First Cafe',
      wiseTxnId: 'txn-smoke',
      skip: false,
    };

    await page.route('**/api/expenses/import/csv', async (route) => {
      requestBodies.push(route.request().postData() || '');
      requestCount += 1;
      const body = requestCount === 1
        ? {
            preview: true,
            toImport: [previewExpense],
            skipped: [],
            duplicates: [],
            total: 1,
          }
        : { imported: 1, skipped: 0, duplicates: 0, total: 1 };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: body }),
      });
    });

    await page.goto('/track/import');
    const fileInput = page.getByLabel('Wise CSV files');
    await fileInput.setInputFiles([
      { name: 'july.csv', mimeType: 'text/csv', buffer: Buffer.from('ID,Status\ntxn-july,COMPLETED') },
      { name: 'august.csv', mimeType: 'text/csv', buffer: Buffer.from('ID,Status\ntxn-august,COMPLETED') },
    ]);

    await expect(page.getByText('2 files selected.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Parse CSVs', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Import 1 Transactions', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Import 1 Transactions', exact: true }).click();
    await expect(page.getByText('Import complete!', { exact: true })).toBeVisible();

    expect(requestBodies).toHaveLength(2);
    for (const body of requestBodies) {
      expect(body).toContain('july.csv');
      expect(body).toContain('august.csv');
      expect((body.match(/name="file"/g) || []).length).toBe(2);
    }
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
    await page.goto('/dataset');
    await expect(page).toHaveURL(/\/dataset$/);
    await captureFullPage(page, testInfo, 'dataset.png');
  });

  test('dashboard expanded charts open when available', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Holiday Spend' }).first()).toBeVisible();

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
