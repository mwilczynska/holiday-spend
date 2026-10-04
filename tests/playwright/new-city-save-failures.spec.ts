import { expect, test, type Page } from '@playwright/test';

const city = { cityId: 'sydney', cityName: 'Sydney', countryId: 'australia', countryName: 'Australia', createdCountry: false, createdCity: false, generatedCity: false, reusedExistingCity: true };

async function openForm(page: Page, dataset = false) {
  await page.goto(dataset ? '/dataset' : '/plan');
  if (!dataset) {
    await expect(page.locator('section[aria-label="Trip historical climate"]').getByRole('img', { name: /Historical mean temperature/ })).toBeVisible();
    await page.getByRole('button', { name: 'Add Leg', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Add City', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add New City With LLM', exact: true });
  await form.getByPlaceholder('e.g. Kunming', { exact: true }).fill('Sydney');
  await form.getByPlaceholder('e.g. China', { exact: true }).fill('Australia');
  if (!dataset) await form.getByRole('spinbutton').fill('2');
  return form;
}

test('new-city leg acknowledgements retain the draft unless the city and requested leg are confirmed', async ({ page }) => {
  const form = await openForm(page);
  const leg = { id: 900001, cityId: 'sydney', nights: 2 };
  const failures = [
    {}, { data: {} }, { data: { city } },
    { data: { city: { ...city, cityId: '' }, leg } },
    { data: { city: { ...city, createdCity: true }, leg } },
    { data: { city, leg: { ...leg, cityId: 'melbourne' } } },
    { data: { city, leg: { ...leg, nights: 3 } } },
    { data: { city, leg: { ...leg, id: 'invalid' } } },
  ];
  for (const json of failures) {
    await page.route('**/api/itinerary/legs/create-with-city', route => route.fulfill({ status: 201, json }));
    await form.getByRole('button', { name: 'Generate City And Add Leg', exact: true }).click();
    await expect(form).toBeVisible();
    await expect(form.getByRole('alert')).toContainText('could not be confirmed');
    await expect(form.getByPlaceholder('e.g. Kunming', { exact: true })).toHaveValue('Sydney');
    await expect(form.getByPlaceholder('e.g. China', { exact: true })).toHaveValue('Australia');
    await expect(form.getByRole('spinbutton')).toHaveValue('2');
    await expect(page.getByText(/^Added leg for/)).toBeHidden();
    await page.unroute('**/api/itinerary/legs/create-with-city');
  }
});

test('pending new-city requests lock all draft controls and retain them after rejection', async ({ page }) => {
  const form = await openForm(page);
  await form.getByText('Advanced generation settings', { exact: true }).click();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let submissions = 0;
  await page.route('**/api/itinerary/legs/create-with-city', async route => {
    submissions++;
    await pending;
    await route.fulfill({ status: 503, json: { error: 'QA delayed city failure' } });
  });
  try {
    const started = page.waitForRequest(request => request.url().endsWith('/api/itinerary/legs/create-with-city'));
    await form.getByRole('button', { name: 'Generate City And Add Leg', exact: true }).click();
    await started;
    for (const control of await form.locator('input, textarea, select, button').all()) {
      // The dialog Close button remains focusable, while its handler prevents closing.
      if (await control.getAttribute('aria-label') === 'Close') continue;
      if ((await control.innerText()).trim() === 'Close') continue;
      await expect(control).toBeDisabled();
    }
    await form.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(form).toBeVisible();
  } finally {
    release();
  }
  await expect(form.getByRole('alert')).toContainText('QA delayed city failure');
  await expect(form.getByPlaceholder('e.g. Kunming', { exact: true })).toHaveValue('Sydney');
  await expect(form.getByRole('spinbutton')).toHaveValue('2');
  expect(submissions).toBe(1);
});

test('dataset city acknowledgements retain failures and accept a real existing-city result without a leg', async ({ page }) => {
  const form = await openForm(page, true);
  for (const json of [{ data: {} }, { data: { city: { ...city, countryName: '' } } }]) {
    await page.route('**/api/cities/create-with-generation', route => route.fulfill({ json }));
    await form.getByRole('button', { name: 'Generate And Add City', exact: true }).click();
    await expect(form).toBeVisible();
    await expect(form.getByRole('alert')).toContainText('could not be confirmed');
    await expect(form.getByPlaceholder('e.g. Kunming', { exact: true })).toHaveValue('Sydney');
    await page.unroute('**/api/cities/create-with-generation');
  }
  const confirmed = page.waitForResponse(response => response.url().endsWith('/api/cities/create-with-generation'));
  await form.getByRole('button', { name: 'Generate And Add City', exact: true }).click();
  const response = await confirmed;
  expect(response.ok()).toBe(true);
  expect((await response.json()).data.city.reusedExistingCity).toBe(true);
  await expect(form).toBeHidden();
  await expect(page.getByText('Existing city selected.', { exact: true })).toBeVisible();
});
