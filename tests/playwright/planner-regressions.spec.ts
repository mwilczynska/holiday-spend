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
    await page.getByRole('button', { name: 'Add City' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const cityInput = dialog.getByPlaceholder('e.g. Kunming');
    const countryInput = dialog.getByPlaceholder('e.g. China');

    await cityInput.pressSequentially('San Cristobal de las Casas', { delay: 15 });
    await countryInput.pressSequentially('Mexico', { delay: 15 });

    await expect(cityInput).toHaveValue('San Cristobal de las Casas');
    await expect(countryInput).toHaveValue('Mexico');
  });

  test('add-leg city picker has strong selection contrast and explicit footer actions', async ({ page }) => {
    await page.goto('/plan');
    await page.getByRole('button', { name: 'Add Leg', exact: true }).first().click();

    const addLegDialog = page.getByRole('dialog', { name: 'Add Itinerary Leg' });
    await expect(addLegDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
    await expect(addLegDialog.getByRole('button', { name: 'Add City', exact: true })).toBeVisible();
    await expect(addLegDialog.getByRole('button', { name: 'Add Leg', exact: true })).toBeDisabled();

    await addLegDialog.getByRole('button', { name: 'Select a city' }).click();
    const search = page.getByPlaceholder('Search cities...');
    await search.fill('Agra');
    await search.press('Enter');

    await addLegDialog.getByRole('button', { name: 'Agra, India' }).click();
    const selectedAgra = page.locator('[cmdk-item]').filter({ hasText: 'Agra, India' }).first();
    await expect(selectedAgra).toBeVisible();
    expect(await selectedAgra.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(15, 23, 42)');

    await page.keyboard.press('Escape');
    await addLegDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(addLegDialog).toBeHidden();
  });

  test('Anthropic and Google model refresh reset defaults in the compact model grid', async ({ page }) => {
    const refreshRequests: string[] = [];
    const providerModels = {
      openai: ['gpt-5.6-luna', 'gpt-5.4-mini'],
      anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
      gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    } as const;

    await page.route('**/api/llm/models?**', async (route) => {
      const url = new URL(route.request().url());
      const provider = (url.searchParams.get('provider') || 'openai') as keyof typeof providerModels;
      if (url.searchParams.get('refresh') === '1') refreshRequests.push(provider);
      const models = providerModels[provider];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            provider,
            source: 'live',
            credentialSource: 'browser',
            aggregatorSource: null,
            defaultModel: models[0],
            curatedModels: models,
            liveModels: models,
            effectiveModels: models,
            fetchedAt: new Date().toISOString(),
            cacheHit: false,
            warning: null,
          },
        }),
      });
    });

    await page.goto('/plan');
    await page.getByRole('button', { name: 'Add Leg', exact: true }).first().click();
    await page.getByRole('dialog', { name: 'Add Itinerary Leg' })
      .getByRole('button', { name: 'Add City', exact: true })
      .click();

    const cityDialog = page.getByRole('dialog', { name: 'Add New City With LLM' });
    await cityDialog.getByText('Advanced generation settings', { exact: true }).click();
    const providerSelect = cityDialog.getByRole('combobox').first();
    const modelInput = cityDialog.locator('input[list]').first();

    for (const scenario of [
      { label: 'Anthropic', provider: 'anthropic', defaultModel: 'claude-sonnet-4-6', alternate: 'claude-haiku-4-5' },
      { label: 'Google Gemini', provider: 'gemini', defaultModel: 'gemini-2.5-flash', alternate: 'gemini-2.5-pro' },
    ] as const) {
      await providerSelect.click();
      await page.getByRole('option', { name: scenario.label, exact: true }).click();
      await expect(modelInput).toHaveValue(scenario.defaultModel);
      await modelInput.fill(scenario.alternate);

      const firstModel = cityDialog.getByRole('button', { name: `${scenario.defaultModel} (default)`, exact: true });
      const secondModel = cityDialog.getByRole('button', { name: scenario.alternate, exact: true });
      await expect(firstModel).toBeVisible();
      await expect(secondModel).toBeVisible();
      const [firstBox, secondBox] = await Promise.all([firstModel.boundingBox(), secondModel.boundingBox()]);
      expect(firstBox).not.toBeNull();
      expect(secondBox).not.toBeNull();
      expect(Math.abs(firstBox!.y - secondBox!.y)).toBeLessThan(2);
      expect(secondBox!.x).toBeGreaterThan(firstBox!.x);

      await cityDialog.getByRole('button', { name: 'Refresh models', exact: true }).click();
      await expect(modelInput).toHaveValue(scenario.defaultModel);
    }

    expect(refreshRequests).toEqual(['anthropic', 'gemini']);
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
