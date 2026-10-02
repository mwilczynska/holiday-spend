import { expect, test, type Page } from '@playwright/test';

const FIXTURE_KEY = 'not-a-provider-key-shared-ui-fixture';

async function newCity(page: Page) {
  await page.getByRole('button', { name: 'Add Leg', exact: true }).first().click();
  await page.getByRole('dialog', { name: 'Add Itinerary Leg' }).getByRole('button', { name: 'Add City', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add New City With LLM' });
  await dialog.getByText('Advanced generation settings', { exact: true }).click();
  return dialog;
}

async function bulkTransport(page: Page) {
  await page.getByRole('button', { name: /Estimate Intercity Transport \(/ }).click();
  return page.getByRole('dialog', { name: 'Estimate Intercity Transport', exact: true });
}

test('saved provider keys synchronize city and transport dialogs across open pages', async ({ page, context }) => {
  // Isolated Playwright profile only. Model discovery is intercepted so fixture values are
  // never submitted to a provider, and these checks never read the owner's browser storage.
  await context.route('**/api/llm/models?**', route => route.abort());
  await page.goto('/plan');
  const second = await context.newPage();
  await second.goto('/plan');
  const transport = await bulkTransport(second);
  await transport.getByText('Advanced estimation settings', { exact: true }).click();
  const transportKey = transport.locator('input[type="password"]');
  await expect(transportKey).toHaveValue('');
  const city = await newCity(page);
  const cityKey = city.locator('input[type="password"]');
  await cityKey.fill(FIXTURE_KEY);
  await city.getByLabel('Save API key in this browser').check();
  await expect(transportKey).toHaveValue(FIXTURE_KEY);
  await expect(transport.getByLabel('Save API key in this browser')).toBeChecked();

  await transport.getByRole('button', { name: /Clear.*key/i }).first().click();
  await expect(cityKey).toHaveValue('');
  await cityKey.fill(FIXTURE_KEY);
  await expect(transportKey).toHaveValue(FIXTURE_KEY);
  await city.getByLabel('Save API key in this browser').uncheck();
  await expect(transportKey).toHaveValue('');
  await expect(cityKey).toHaveValue(FIXTURE_KEY);
  await second.reload();
  const reopened = await bulkTransport(second);
  await reopened.getByText('Advanced estimation settings', { exact: true }).click();
  await expect(reopened.locator('input[type="password"]')).toHaveValue('');
});

test('Stop cancels a ten-leg batch, prevents queued requests and keeps the completed estimate', async ({ page }) => {
  const started: string[] = [];
  let releasePending!: () => void;
  const hold = new Promise<void>(resolve => { releasePending = resolve; });
  await page.route('**/api/itinerary/legs/*/estimate-transport', async route => {
    started.push(route.request().url());
    if (started.length === 1) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
        options: [{ label: 'Completed fixture', mode: 'bus', confidence: 'medium', totalAud: 40, sourceBasis: 'Browser test fixture', notes: 'Test only', transportRowDraft: { mode: 'Bus', cost: 40, note: null } }],
        assumptions: [],
      } }) });
    } else {
      await hold;
      await route.abort().catch(() => {});
    }
  });
  try {
    await page.goto('/plan');
    const dialog = await bulkTransport(page);
    await dialog.getByText(/Choose legs to estimate/).click();
    await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
    const legs = dialog.locator('input[type="checkbox"]');
    for (let i = 0; i < 10; i++) await legs.nth(i).check();
    await dialog.getByRole('button', { name: 'Estimate Selected Legs', exact: true }).click();
    await expect(dialog.getByText('1 ready to apply', { exact: true })).toBeVisible();
    await expect.poll(() => started.length).toBe(5);
    await dialog.getByRole('button', { name: 'Stop estimating', exact: true }).click();
    await expect(dialog.getByText('9 cancelled', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Completed fixture', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close', exact: true }).first()).toBeEnabled();
    await expect(dialog.getByRole('button', { name: 'Apply Top Options', exact: true })).toBeEnabled();
    releasePending();
    await expect(dialog.getByText('0 failed', { exact: true })).toBeVisible();
    expect(started).toHaveLength(5);
  } finally { releasePending(); }
});

test('retrying failed legs preserves successes and sends only failed requests again', async ({ page }) => {
  const started: string[] = [];
  await page.route('**/api/itinerary/legs/*/estimate-transport', async route => {
    started.push(route.request().url());
    if (started.length === 2) {
      return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary provider failure fixture' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
      options: [{ label: started.length === 1 ? 'Original successful fixture' : 'Retried fixture', mode: 'bus', confidence: 'medium', totalAud: 40, sourceBasis: 'Browser test fixture', notes: 'Test only', transportRowDraft: { mode: 'Bus', cost: 40, note: null } }],
      assumptions: [],
    } }) });
  });
  await page.goto('/plan');
  const dialog = await bulkTransport(page);
  await dialog.getByText(/Choose legs to estimate/).click();
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
  const legs = dialog.locator('input[type="checkbox"]');
  await legs.nth(0).check(); await legs.nth(1).check();
  await dialog.getByRole('button', { name: 'Estimate Selected Legs', exact: true }).click();
  await expect(dialog.getByText('1 failed', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Retry failed legs', exact: true }).click();
  await expect(dialog.getByText('2 ready to apply', { exact: true })).toBeVisible();
  await expect(dialog.getByText('0 failed', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Original successful fixture', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Retried fixture', { exact: true })).toBeVisible();
  expect(started).toHaveLength(3);
  expect(started[2]).toBe(started[1]);
});
