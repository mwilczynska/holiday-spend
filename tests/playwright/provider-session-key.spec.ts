import { expect, test } from '@playwright/test';

test('an unsaved fixture key survives city saving and dialog/navigation changes until page reload', async ({ page, context }) => {
  // Fresh test profile only. No owner's key or browser storage is read. Model discovery is
  // blocked, and existing Sydney is reused without making a provider request.
  const fixtureKey = 'not-a-provider-key-session-ui-fixture';
  await context.route('**/api/llm/models?**', route => route.abort());
  let createdLegId: number | undefined;
  try {
    await page.goto('/plan');
    await expect(page.locator('section[aria-label="Trip historical climate"]').getByRole('img', {
      name: /Historical mean temperature/,
    })).toBeVisible();
    await page.getByRole('button', { name: 'Add Leg', exact: true }).click();
    await page.getByRole('button', { name: 'Add City', exact: true }).click();
    const city = page.getByRole('dialog', { name: 'Add New City With LLM', exact: true });
    await city.getByPlaceholder('e.g. Kunming', { exact: true }).fill('Sydney');
    await city.getByPlaceholder('e.g. China', { exact: true }).fill('Australia');
    await city.getByRole('spinbutton', { name: 'Nights', exact: true }).fill('2');
    await city.getByText('Advanced generation settings', { exact: true }).click();
    await expect(city.getByLabel('Save API key in this browser', { exact: true })).not.toBeChecked();
    await city.getByLabel('OpenAI API Key', { exact: true }).fill(fixtureKey);
    const saved = page.waitForResponse(response => response.url().endsWith('/api/itinerary/legs/create-with-city'));
    await city.getByRole('button', { name: 'Generate City And Add Leg', exact: true }).click();
    const response = await saved;
    expect(response.ok()).toBe(true);
    const result = await response.json();
    createdLegId = result.data.leg.id;
    expect(result.data.city.reusedExistingCity).toBe(true);
    await expect(city).toBeHidden();

    const expandAll = page.getByRole('button', { name: 'Expand all', exact: true });
    if (await expandAll.isVisible()) await expandAll.click();
    const singleButtons = page.getByRole('button', { name: 'Estimate transport', exact: true });
    for (const button of await singleButtons.all()) {
      if (await button.isEnabled()) { await button.click(); break; }
    }
    const single = page.getByRole('dialog', { name: 'Estimate Intercity Transport', exact: true });
    await single.getByText('Advanced estimation settings', { exact: true }).click();
    await expect(single.getByLabel('OpenAI API Key', { exact: true })).toHaveValue(fixtureKey);
    await single.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(single).toBeHidden();

    await page.getByRole('button', { name: /^Estimate Intercity Transport/ }).click();
    const transport = page.getByRole('dialog', { name: 'Estimate Intercity Transport', exact: true });
    await transport.getByText('Advanced estimation settings', { exact: true }).click();
    await expect(transport.getByLabel('OpenAI API Key', { exact: true })).toHaveValue(fixtureKey);
    await expect(transport.getByLabel('Save API key in this browser', { exact: true })).not.toBeChecked();
    await transport.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(transport).toBeHidden();

    await page.getByRole('link', { name: 'Dataset', exact: true }).click();
    await page.getByText('Search for a city', { exact: true }).click();
    await page.getByPlaceholder('Type a city or country...', { exact: true }).fill('Sydney');
    await page.getByText('Sydney, Australia', { exact: true }).click();
    await expect(page.getByLabel('OpenAI API Key', { exact: true })).toHaveValue(fixtureKey);
    await expect(page.getByLabel('Save API key in this browser', { exact: true })).not.toBeChecked();
    const showKey = page.getByRole('switch', { name: 'Show API key', exact: true });
    await expect(showKey).not.toBeChecked();
    await showKey.click();
    await expect(page.getByLabel('OpenAI API Key', { exact: true })).toHaveAttribute('type', 'text');
    await showKey.click();
    await expect(page.getByLabel('OpenAI API Key', { exact: true })).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Add City', exact: true }).click();
    const datasetCity = page.getByRole('dialog', { name: 'Add New City With LLM', exact: true });
    await datasetCity.getByText('Advanced generation settings', { exact: true }).click();
    await expect(datasetCity.getByLabel('OpenAI API Key', { exact: true })).toHaveValue(fixtureKey);
    await expect(datasetCity.getByLabel('Save API key in this browser', { exact: true })).not.toBeChecked();
    await datasetCity.getByRole('button', { name: 'Close', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Add City', exact: true }).click();
    await datasetCity.getByText('Advanced generation settings', { exact: true }).click();
    await expect(datasetCity.getByLabel('OpenAI API Key', { exact: true })).toHaveValue('');
    await expect(datasetCity.getByLabel('Save API key in this browser', { exact: true })).not.toBeChecked();
  } finally {
    if (createdLegId) expect((await page.request.delete(`/api/itinerary/legs/${createdLegId}`)).ok()).toBe(true);
  }
});

test('missing-city import exposes a labelled unsaved provider key without submitting generation', async ({ page, context }) => {
  await context.route('**/api/llm/models?**', route => route.abort());
  await page.goto('/plan');
  await expect(page.locator('section[aria-label="Trip historical climate"]').getByRole('img', {
    name: /Historical mean temperature/,
  })).toBeVisible();
  const snapshot = { version: 1, name: 'Provider label QA', groupSize: 2, fixedCosts: [], legs: [{
    cityId: 'qa-provider-label-missing-city', cityName: 'Hobart', countryId: 'australia', countryName: 'Australia',
    startDate: '2026-12-01', endDate: '2026-12-04', nights: 3, sortOrder: 0, status: 'planned',
  }] };
  await page.locator('input[type="file"]').setInputFiles({
    name: 'provider-label-qa.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot)),
  });
  const dialog = page.getByRole('dialog', { name: 'Resolve Missing Cities Before Import', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox').filter({ hasText: 'Create placeholders only' }).click();
  await page.getByRole('option', { name: 'Generate city costs now', exact: true }).click();
  const key = dialog.getByLabel('OpenAI API Key', { exact: true });
  await expect(key).toBeVisible();
  await key.fill('not-a-provider-key-import-label-fixture');
  await expect(dialog.getByLabel('Save API key in this browser', { exact: true })).not.toBeChecked();
  await expect(dialog.getByRole('button', { name: 'Clear This Key', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toBeHidden();
});
