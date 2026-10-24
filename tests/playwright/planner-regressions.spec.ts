import { expect, test, type Locator } from '@playwright/test';
import { expandLegCard } from './client-navigation';

test.describe('planner regressions', () => {
  test('city generation and model refresh failures explain the cause and allow retry', async ({ page }) => {
    let failRefresh = true;
    let failGeneration = true;
    await page.route('**/api/llm/models?**', async route => {
      if (failRefresh) return route.abort('failed');
      const models = ['gpt-6-luna'];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
        provider: 'openai', source: 'live', credentialSource: 'browser', aggregatorSource: null,
        defaultModel: models[0], curatedModels: [], liveModels: models, effectiveModels: models,
        fetchedAt: new Date().toISOString(), cacheHit: false, warning: null,
      } }) });
    });
    await page.route('**/api/cities/create-with-generation', async route => {
      if (failGeneration) {
        await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'OpenAI API error 404: model does not exist. Check the model ID and whether your account can use it.' }) });
      } else {
        await route.abort('failed');
      }
    });
    await page.goto('/dataset');
    await page.getByRole('button', { name: 'Generate New City', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add New City With LLM' });
    await dialog.getByPlaceholder('e.g. Kunming').fill('Failure fixture city');
    await dialog.getByPlaceholder('e.g. China').fill('Mexico');
    await dialog.getByText('Advanced generation settings', { exact: true }).click();
    await expect(dialog.getByText(/Model refresh could not reach the app server/)).toBeVisible();
    failRefresh = false;
    await dialog.getByRole('button', { name: 'Refresh models', exact: true }).click();
    await expect(dialog.getByText(/1 model available to this provider account/)).toBeVisible();
    await expect(dialog.getByText(/Model refresh could not reach/)).toBeHidden();
    const generateButton = dialog.getByRole('button', { name: 'Generate And Add City', exact: true });
    await generateButton.click();
    await expect(dialog.getByText(/City generation failed \(HTTP 502\): OpenAI API error 404/)).toBeVisible();
    await expect(dialog.getByText(/Check the model ID/)).toBeVisible();
    await expect(generateButton).toBeEnabled();
    await expect(dialog.getByPlaceholder('e.g. Kunming')).toHaveValue('Failure fixture city');
    failGeneration = false;
    await generateButton.click();
    await expect(dialog.getByText(/City generation could not reach the app server/)).toBeVisible();
    await expect(generateButton).toBeEnabled();
  });

  test('OpenAI migrates the previous default to GPT-6 Luna max and refreshes current suggestions', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('holiday-spend.city-generation.models', JSON.stringify({ openai: 'gpt-5.6-luna' }));
    });
    let refreshCount = 0;
    await page.route('**/api/llm/models?**', async route => {
      const refreshing = new URL(route.request().url()).searchParams.get('refresh') === '1';
      if (refreshing) refreshCount += 1;
      const models = refreshing ? ['gpt-6-luna', 'gpt-6.1-sol'] : ['gpt-6-luna'];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
        provider: 'openai', source: 'live', credentialSource: 'browser', aggregatorSource: null,
        defaultModel: 'gpt-6-luna', curatedModels: [], liveModels: models, effectiveModels: models,
        fetchedAt: new Date().toISOString(), cacheHit: false, warning: null,
      } }) });
    });
    await page.goto('/plan');
    await page.getByRole('button', { name: 'Add Leg', exact: true }).first().click();
    await page.getByRole('dialog', { name: 'Add Itinerary Leg' }).getByRole('button', { name: 'Generate New City', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add New City With LLM' });
    await dialog.getByText('Advanced generation settings', { exact: true }).click();
    const modelSelect = dialog.getByRole('combobox', { name: 'Model', exact: true });
    await expect(modelSelect).toHaveText('gpt-6-luna (default)');
    await expect(dialog.getByRole('combobox').last()).toHaveText('Maximum');
    await dialog.getByRole('button', { name: 'Refresh models', exact: true }).click();
    await expect(dialog.getByText(/2 models available to this provider account/)).toBeVisible();
    expect(refreshCount).toBe(1);
    // GPT-6.1 Sol always reasons: its effort choices are Low to Maximum, never a lone disabled "None".
    await modelSelect.click();
    await page.getByRole('option', { name: 'gpt-6.1-sol', exact: true }).click();
    const effortSelect = dialog.getByRole('combobox').last();
    await expect(effortSelect).toHaveText('Maximum');
    await expect(effortSelect).toBeEnabled();
    await effortSelect.click();
    await expect(page.getByRole('option')).toHaveText(['Low', 'Medium', 'High', 'Extra high', 'Maximum']);
    await page.keyboard.press('Escape');
  });

  // The bento layout replaced the pinned summary sidebar with a summary row above the leg timeline.
  test('trip summary sits above the leg timeline and legs collapse and expand', async ({ page }) => {
    await page.goto('/plan');

    const header = page.locator('div.fixed.inset-x-0.top-0.z-30').first();
    const tripSummaryCard = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Trip summary', exact: true }),
    }).first();
    const firstLeg = page.getByTestId('planner-leg-card').first();

    await expect(tripSummaryCard).toBeVisible();
    await expect(firstLeg).toBeVisible();
    const headerBox = await header.boundingBox();
    const summaryBox = await tripSummaryCard.boundingBox();
    const firstLegBox = await firstLeg.boundingBox();
    expect(summaryBox!.y).toBeGreaterThan(headerBox!.y + headerBox!.height);
    expect(firstLegBox!.y).toBeGreaterThan(summaryBox!.y + summaryBox!.height);

    const toggle = firstLeg.getByRole('button', { name: /^(Expand|Collapse) / });
    const initially = await toggle.getAttribute('aria-expanded');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', initially === 'true' ? 'false' : 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', initially ?? 'false');

    const expandAll = page.getByRole('button', { name: 'Expand all', exact: true });
    if (await expandAll.isVisible()) await expandAll.click();
    await expect(page.getByRole('button', { name: /^Expand / })).toHaveCount(0);
    await page.getByRole('button', { name: 'Collapse all', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Collapse / })).toHaveCount(0);
  });

  test('new city dialog fields accept typing without blocking the UI', async ({ page }) => {
    await page.goto('/plan');

    await page.getByRole('button', { name: 'Add Leg' }).click();
    await page.getByRole('button', { name: 'Generate New City' }).click();

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
    test.setTimeout(60000);
    await page.goto('/plan');
    await page.getByRole('button', { name: 'Add Leg', exact: true }).first().click();

    const addLegDialog = page.getByRole('dialog', { name: 'Add Itinerary Leg' });
    await expect(addLegDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
    await expect(addLegDialog.getByRole('button', { name: 'Generate New City', exact: true })).toBeVisible();
    await expect(addLegDialog.getByRole('button', { name: 'Add Leg', exact: true })).toBeDisabled();

    await addLegDialog.getByRole('button', { name: 'Select a city' }).click();
    const search = page.getByPlaceholder('Search cities...');
    await search.fill('Agra');
    const agra = page.locator('[cmdk-item]').filter({ hasText: 'Agra, India' });
    await expect(agra).toHaveCSS('pointer-events', 'auto');
    await expect(agra).toHaveCSS('opacity', '1');
    await agra.click();
    await expect(addLegDialog.getByRole('button', { name: 'Agra, India' })).toBeVisible();
    await addLegDialog.getByRole('button', { name: 'Agra, India' }).click();
    await search.fill('Lima');
    await search.press('Enter');
    await expect(addLegDialog.getByRole('button', { name: 'Lima, Peru' })).toBeVisible();
    await addLegDialog.getByRole('button', { name: 'Lima, Peru' }).click();
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

  test('Anthropic and Google model refresh reset defaults in the model dropdown', async ({ page }) => {
    const refreshRequests: string[] = [];
    const providerModels = {
      openai: ['gpt-6-luna', 'gpt-5.4-mini', 'gpt-5.4', 'gpt-5.3-codex'],
      anthropic: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5'],
      gemini: ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-4-argon', 'gemini-2.5-pro'],
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
      .getByRole('button', { name: 'Generate New City', exact: true })
      .click();

    const cityDialog = page.getByRole('dialog', { name: 'Add New City With LLM' });
    await cityDialog.getByText('Advanced generation settings', { exact: true }).click();
    const providerSelect = cityDialog.getByRole('combobox').first();
    const modelSelect = cityDialog.getByRole('combobox', { name: 'Model', exact: true });

    for (const scenario of [
      { label: 'Anthropic', provider: 'anthropic', defaultModel: 'claude-haiku-5-5', alternate: 'claude-sonnet-5-5' },
      { label: 'Google Gemini', provider: 'gemini', defaultModel: 'gemini-3.5-flash-lite', alternate: 'gemini-3.8-flash' },
    ] as const) {
      await providerSelect.click();
      await page.getByRole('option', { name: scenario.label, exact: true }).click();
      await expect(modelSelect).toHaveText(`${scenario.defaultModel} (default)`);
      await modelSelect.click();
      await expect(page.getByRole('option')).toHaveText(
        providerModels[scenario.provider].map((model, index) => (index === 0 ? `${model} (default)` : model))
      );
      await page.getByRole('option', { name: scenario.alternate, exact: true }).click();
      await expect(modelSelect).toHaveText(scenario.alternate);
      await expect(cityDialog.getByText('Thinking / reasoning effort', { exact: true })).toBeVisible();

      await cityDialog.getByRole('button', { name: 'Refresh models', exact: true }).click();
      await expect(modelSelect).toHaveText(`${scenario.defaultModel} (default)`);
    }

    expect(refreshRequests).toEqual(['anthropic', 'gemini']);
  });

  test('single and bulk intercity transport pickers choose discovered models from a dropdown', async ({ page }) => {
    const refreshRequests: string[] = [];
    const providerModels = {
      openai: ['gpt-6-luna', 'gpt-5.4-mini', 'gpt-5.4', 'gpt-5.3-codex'],
      anthropic: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5'],
      gemini: ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-4-argon', 'gemini-2.5-pro'],
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

    const chooseModel = async (dialog: Locator, models: readonly string[], choice: string) => {
      const modelSelect = dialog.getByRole('combobox', { name: 'Model', exact: true });
      await expect(modelSelect).toHaveText(`${models[0]} (default)`);
      await modelSelect.click();
      await expect(page.getByRole('option')).toHaveText(models.map((model, index) => (index === 0 ? `${model} (default)` : model)));
      await page.getByRole('option', { name: choice, exact: true }).click();
      await expect(modelSelect).toHaveText(choice);
      return modelSelect;
    };

    await page.goto('/plan');
    await expect(page.getByRole('button', { name: 'Add Leg', exact: true }).first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Expand all', exact: true }).click();
    const singleEstimateButtons = page.getByRole('button', { name: 'Estimate transport', exact: true });
    await expect(page.locator('section[aria-label="Trip historical climate"]').getByRole('img', {
      name: /Historical mean temperature/,
    })).toBeVisible();
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
    await singleProviderSelect.click();
    await page.getByRole('option', { name: 'Anthropic', exact: true }).click();
    const singleModelSelect = await chooseModel(singleDialog, providerModels.anthropic, providerModels.anthropic[1]);
    await singleDialog.getByRole('button', { name: 'Refresh models', exact: true }).click();
    await expect(singleModelSelect).toHaveText(`${providerModels.anthropic[0]} (default)`);
    await page.keyboard.press('Escape');
    await expect(singleDialog).toBeHidden();

    const bulkButton = page.getByRole('button', { name: /^Estimate Intercity Transport/ });
    await expect(bulkButton).toBeEnabled();
    await bulkButton.click();

    const bulkDialog = page.getByRole('dialog', { name: 'Estimate Intercity Transport' }).last();
    await bulkDialog.getByText('Advanced estimation settings', { exact: true }).click();
    await expect(bulkDialog.getByText('Thinking / reasoning effort', { exact: true })).toBeVisible();
    const bulkProviderSelect = bulkDialog.getByRole('combobox').first();
    await bulkProviderSelect.click();
    await page.getByRole('option', { name: 'Google Gemini', exact: true }).click();
    const bulkModelSelect = await chooseModel(bulkDialog, providerModels.gemini, providerModels.gemini[1]);
    await bulkDialog.getByRole('button', { name: 'Refresh models', exact: true }).click();
    await expect(bulkModelSelect).toHaveText(`${providerModels.gemini[0]} (default)`);

    expect(refreshRequests).toEqual(['anthropic', 'gemini']);
  });

  test('bottom accommodation info popover remains fully visible near the viewport edge', async ({ page }) => {
    await page.goto('/plan');

    await page.waitForTimeout(250);
    // Info buttons live in each card's collapsible body; open the last card to reach the bottom one.
    const lastCard = page.getByTestId('planner-leg-card').last();
    if (await lastCard.count()) await expandLegCard(lastCard);

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
