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
    await city.locator('input[type="password"]').fill(fixtureKey);
    const saved = page.waitForResponse(response => response.url().endsWith('/api/itinerary/legs/create-with-city'));
    await city.getByRole('button', { name: 'Generate City And Add Leg', exact: true }).click();
    const response = await saved;
    expect(response.ok()).toBe(true);
    const result = await response.json();
    createdLegId = result.data.leg.id;
    expect(result.data.city.reusedExistingCity).toBe(true);
    await expect(city).toBeHidden();

    await page.getByRole('button', { name: /^Estimate Intercity Transport/ }).click();
    const transport = page.getByRole('dialog', { name: 'Estimate Intercity Transport', exact: true });
    await transport.getByText('Advanced estimation settings', { exact: true }).click();
    await expect(transport.locator('input[type="password"]')).toHaveValue(fixtureKey);
    await expect(transport.getByLabel('Save API key in this browser', { exact: true })).not.toBeChecked();
    await transport.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(transport).toBeHidden();

    await page.getByRole('link', { name: 'Dataset', exact: true }).click();
    await page.getByRole('button', { name: 'Add City', exact: true }).click();
    const datasetCity = page.getByRole('dialog', { name: 'Add New City With LLM', exact: true });
    await datasetCity.getByText('Advanced generation settings', { exact: true }).click();
    await expect(datasetCity.locator('input[type="password"]')).toHaveValue(fixtureKey);
    await expect(datasetCity.getByLabel('Save API key in this browser', { exact: true })).not.toBeChecked();
    await datasetCity.getByRole('button', { name: 'Close', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Add City', exact: true }).click();
    await datasetCity.getByText('Advanced generation settings', { exact: true }).click();
    await expect(datasetCity.locator('input[type="password"]')).toHaveValue('');
    await expect(datasetCity.getByLabel('Save API key in this browser', { exact: true })).not.toBeChecked();
  } finally {
    if (createdLegId) expect((await page.request.delete(`/api/itinerary/legs/${createdLegId}`)).ok()).toBe(true);
  }
});
