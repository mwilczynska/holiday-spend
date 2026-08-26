import { expect, test, type Locator } from '@playwright/test';

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

  test('Anthropic and Google model refresh reset defaults in the four-column model grid', async ({ page }) => {
    const refreshRequests: string[] = [];
    const providerModels = {
      openai: ['gpt-5.6-luna', 'gpt-5.4-mini', 'gpt-5.4', 'gpt-5.3-codex'],
      anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-6', 'claude-3-7-sonnet-latest'],
      gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'],
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

      const modelButtons = providerModels[scenario.provider].map((model, index) =>
        cityDialog.getByRole('button', {
          name: index === 0 ? `${model} (default)` : model,
          exact: true,
        })
      );
      for (const button of modelButtons) await expect(button).toBeVisible();
      const boxes = await Promise.all(modelButtons.map((button) => button.boundingBox()));
      boxes.forEach((box) => expect(box).not.toBeNull());
      boxes.slice(1).forEach((box) => expect(Math.abs(box!.y - boxes[0]!.y)).toBeLessThan(2));
      boxes.slice(1).forEach((box, index) => expect(box!.x).toBeGreaterThan(boxes[index]!.x));
      const cityDialogBox = await cityDialog.boundingBox();
      expect(cityDialogBox).not.toBeNull();
      expect(boxes[3]!.x + boxes[3]!.width).toBeGreaterThan(cityDialogBox!.x + cityDialogBox!.width * 0.7);
      await expect(cityDialog.getByText('Thinking / reasoning effort', { exact: true })).toBeVisible();

      await cityDialog.getByRole('button', { name: 'Refresh models', exact: true }).click();
      await expect(modelInput).toHaveValue(scenario.defaultModel);
    }

    expect(refreshRequests).toEqual(['anthropic', 'gemini']);
  });

  test('single and bulk intercity transport pickers use discovered four-column models', async ({ page }) => {
    const refreshRequests: string[] = [];
    const providerModels = {
      openai: ['gpt-5.6-luna', 'gpt-5.4-mini', 'gpt-5.4', 'gpt-5.3-codex'],
      anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-6', 'claude-3-7-sonnet-latest'],
      gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'],
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

    const assertFourColumnGrid = async (dialog: Locator, models: readonly string[]) => {
      const buttons = models.map((model, index) => dialog.getByRole('button', {
        name: index === 0 ? `${model} (default)` : model,
        exact: true,
      }));
      for (const button of buttons) await expect(button).toBeVisible();
      const boxes = await Promise.all(buttons.map((button) => button.boundingBox()));
      boxes.forEach((box) => expect(box).not.toBeNull());
      boxes.slice(1).forEach((box) => expect(Math.abs(box!.y - boxes[0]!.y)).toBeLessThan(2));
      boxes.slice(1).forEach((box, index) => expect(box!.x).toBeGreaterThan(boxes[index]!.x));
      const dialogBox = await dialog.boundingBox();
      expect(dialogBox).not.toBeNull();
      expect(boxes[3]!.x + boxes[3]!.width).toBeGreaterThan(dialogBox!.x + dialogBox!.width * 0.7);
    };

    await page.goto('/plan');
    await expect(page.getByRole('button', { name: 'Add Leg', exact: true }).first()).toBeVisible({ timeout: 60_000 });
    const singleEstimateButtons = page.getByRole('button', { name: 'Estimate transport', exact: true });
    let singleEstimateButton: Locator | null = null;
    for (let index = 0; index < await singleEstimateButtons.count(); index += 1) {
      const candidate = singleEstimateButtons.nth(index);
      if (await candidate.isEnabled()) {
        singleEstimateButton = candidate;
        break;
      }
    }
    expect(singleEstimateButton).not.toBeNull();
    await singleEstimateButton!.click();

    const singleDialog = page.getByRole('dialog', { name: 'Estimate Intercity Transport' }).last();
    await singleDialog.getByText('Advanced estimation settings', { exact: true }).click();
    await expect(singleDialog.getByText('Thinking / reasoning effort', { exact: true })).toBeVisible();
    const singleProviderSelect = singleDialog.getByRole('combobox').first();
    const singleModelInput = singleDialog.locator('input[list]').first();
    await singleProviderSelect.click();
    await page.getByRole('option', { name: 'Anthropic', exact: true }).click();
    await expect(singleModelInput).toHaveValue(providerModels.anthropic[0]);
    await assertFourColumnGrid(singleDialog, providerModels.anthropic);
    await singleModelInput.fill(providerModels.anthropic[1]);
    await singleDialog.getByRole('button', { name: 'Refresh models', exact: true }).click();
    await expect(singleModelInput).toHaveValue(providerModels.anthropic[0]);
    await page.keyboard.press('Escape');
    await expect(singleDialog).toBeHidden();

    const bulkButton = page.getByRole('button', { name: /^Estimate Intercity Transport/ });
    await expect(bulkButton).toBeEnabled();
    await bulkButton.click();

    const bulkDialog = page.getByRole('dialog', { name: 'Estimate Intercity Transport' }).last();
    await bulkDialog.getByText('Advanced estimation settings', { exact: true }).click();
    await expect(bulkDialog.getByText('Thinking / reasoning effort', { exact: true })).toBeVisible();
    const bulkProviderSelect = bulkDialog.getByRole('combobox').first();
    const bulkModelInput = bulkDialog.locator('input[list]').first();
    await bulkProviderSelect.click();
    await page.getByRole('option', { name: 'Google Gemini', exact: true }).click();
    await expect(bulkModelInput).toHaveValue(providerModels.gemini[0]);
    await assertFourColumnGrid(bulkDialog, providerModels.gemini);
    await bulkModelInput.fill(providerModels.gemini[1]);
    await bulkDialog.getByRole('button', { name: 'Refresh models', exact: true }).click();
    await expect(bulkModelInput).toHaveValue(providerModels.gemini[0]);

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
