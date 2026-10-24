import { expect, test, type Locator, type Page } from '@playwright/test';
import { openAddLegDialog } from './client-navigation';

// These checks include multiple dialog transitions and planner refreshes on a dev build.
test.setTimeout(60_000);

async function openLegForm(page: Page) {
  await page.goto('/plan');
  return openAddLegDialog(page);
}

async function chooseCity(page: Page, form: Locator, name: string) {
  await form.getByRole('button', { name: 'Select a city', exact: true }).last().click();
  const picker = page.getByRole('dialog', { name: 'Select a city', exact: true });
  await picker.getByRole('combobox').fill(name);
  await picker.getByRole('option').filter({ hasText: `${name},` }).first().click();
}

function generatedResult(body: { cityName: string; countryName: string; nights?: number }, id: number) {
  const cityId = body.cityName.toLowerCase();
  return { data: {
    city: { cityId, cityName: body.cityName, countryId: 'test-country', countryName: body.countryName,
      createdCountry: false, createdCity: true, generatedCity: true, reusedExistingCity: false },
    ...(body.nights === undefined ? {} : { leg: { id, cityId, nights: body.nights } }),
  } };
}

test('existing-city batches save in order and retry only the remaining legs', async ({ page }) => {
  const form = await openLegForm(page);
  await chooseCity(page, form, 'Agra');
  await form.getByRole('spinbutton').fill('3');
  await form.getByRole('button', { name: 'Add another leg', exact: true }).click();
  await chooseCity(page, form, 'Sydney');
  await form.getByRole('spinbutton').last().fill('5');
  await form.getByRole('button', { name: 'Add another leg', exact: true }).click();
  await expect(form.getByRole('button', { name: 'Add 3 Legs', exact: true })).toBeDisabled();
  await form.getByRole('button', { name: 'Remove city 3', exact: true }).click();
  const requests: Array<{ cityId: string; nights: number }> = [];
  await page.route('**/api/itinerary/legs', async route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    await route.fulfill(requests.length === 2
      ? { status: 503, json: { error: 'Second leg rejected' } }
      : { status: 201, json: { data: { ...body, id: 900000 + requests.length } } });
  });
  await form.getByRole('button', { name: 'Add 2 Legs', exact: true }).click();
  await expect(form.getByRole('alert')).toHaveText('Second leg rejected');
  await expect(form.getByRole('status')).toContainText('1 leg added');
  await expect(form.getByRole('spinbutton')).toHaveValue('5');
  await expect(form.getByRole('button', { name: 'Agra, India', exact: true })).toBeHidden();
  await form.getByRole('button', { name: 'Add Leg', exact: true }).click();
  await expect(form).toBeHidden();
  expect(requests).toEqual([
    { cityId: 'agra', nights: 3 }, { cityId: 'sydney', nights: 5 }, { cityId: 'sydney', nights: 5 },
  ]);
});

test('a mismatched leg acknowledgement stops the batch and retains every unconfirmed row', async ({ page }) => {
  const form = await openLegForm(page);
  await chooseCity(page, form, 'Agra');
  await form.getByRole('button', { name: 'Add another leg', exact: true }).click();
  await chooseCity(page, form, 'Sydney');
  let requests = 0;
  await page.route('**/api/itinerary/legs', route => {
    requests++;
    return route.fulfill({ status: 201, json: { data: { id: 900001, cityId: 'wrong-city', nights: 7 } } });
  });
  await form.getByRole('button', { name: 'Add 2 Legs', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('could not be confirmed');
  await expect(form.getByRole('spinbutton')).toHaveCount(2);
  expect(requests).toBe(1);
});

test('an unmatched planner search prefills the city and nights and preserves other selected cities', async ({ page }) => {
  const form = await openLegForm(page);
  await chooseCity(page, form, 'Agra');
  await form.getByRole('button', { name: 'Add another leg', exact: true }).click();
  await form.getByRole('spinbutton').last().fill('4');
  await form.getByRole('button', { name: 'Select a city', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Select a city', exact: true });
  await picker.getByRole('combobox').fill('Missingville');
  await picker.getByRole('button', { name: 'Generate New City “Missingville”', exact: true }).click();
  const generation = page.getByRole('dialog', { name: 'Add New City With LLM', exact: true });
  await expect(generation.getByLabel('City Name', { exact: true })).toHaveValue('Missingville');
  await expect(generation.getByLabel('Nights', { exact: true })).toHaveValue('4');
  await expect(generation.getByLabel('Country Name', { exact: true })).toHaveValue('');
  await generation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Add Leg', exact: true }).click();
  await expect(form.getByRole('button', { name: 'Agra, India', exact: true })).toBeVisible();
  await expect(form.getByRole('spinbutton').last()).toHaveValue('4');
});

test('missing-city generation preserves partial successes and retries without regenerating them', async ({ page }) => {
  const legForm = await openLegForm(page);
  await legForm.getByRole('button', { name: 'Generate New City', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add New City With LLM', exact: true });
  await form.getByLabel('City Name', { exact: true }).fill('Firstville');
  await form.getByLabel('Country Name', { exact: true }).fill('Australia');
  await form.getByLabel('Nights', { exact: true }).fill('2');
  await form.getByRole('button', { name: 'Add another city', exact: true }).click();
  await form.getByLabel('City Name', { exact: true }).last().fill('Secondville');
  await form.getByLabel('Country Name', { exact: true }).last().fill('France');
  await form.getByLabel('Nights', { exact: true }).last().fill('1.5');
  await expect(form.getByRole('button', { name: 'Generate Cities And Add 2 Legs', exact: true })).toBeDisabled();
  await form.getByLabel('Nights', { exact: true }).last().fill('6');
  const requests: Array<Record<string, unknown>> = [];
  await page.route('**/api/itinerary/legs/create-with-city', async route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    await route.fulfill(requests.length === 2
      ? { status: 503, json: { error: 'Second city rejected' } }
      : { status: 201, json: generatedResult(body, 900000 + requests.length) });
  });
  await form.getByRole('button', { name: 'Generate Cities And Add 2 Legs', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('Second city rejected');
  await expect(form.getByRole('status')).toContainText('1 leg saved');
  await expect(form.getByLabel('City Name', { exact: true })).toHaveValue('Secondville');
  await expect(form.getByLabel('Country Name', { exact: true })).toHaveValue('France');
  await expect(form.getByLabel('Nights', { exact: true })).toHaveValue('6');
  await form.getByRole('button', { name: 'Generate City And Add Leg', exact: true }).click();
  await expect(form).toBeHidden();
  expect(requests.map(({ cityName, countryName, nights }) => ({ cityName, countryName, nights }))).toEqual([
    { cityName: 'Firstville', countryName: 'Australia', nights: 2 },
    { cityName: 'Secondville', countryName: 'France', nights: 6 },
    { cityName: 'Secondville', countryName: 'France', nights: 6 },
  ]);
  expect(requests[1].provider).toBe(requests[0].provider);
  expect(requests[1].model).toBe(requests[0].model);
  expect(requests[1].reasoningEffort).toBe(requests[0].reasoningEffort);
});

test('dataset empty search opens batch generation without creating itinerary legs', async ({ page }) => {
  await page.goto('/dataset');
  await page.getByLabel('Search dataset', { exact: true }).fill('Missingville');
  await page.getByRole('button', { name: 'Generate New City “Missingville”', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add New City With LLM', exact: true });
  await expect(form.getByLabel('City Name', { exact: true })).toHaveValue('Missingville');
  await expect(form.getByRole('spinbutton')).toHaveCount(0);
  await form.getByLabel('Country Name', { exact: true }).fill('Australia');
  await form.getByRole('button', { name: 'Add another city', exact: true }).click();
  await form.getByLabel('City Name', { exact: true }).last().fill('Othercity');
  await form.getByLabel('Country Name', { exact: true }).last().fill('France');
  const requests: Array<Record<string, unknown>> = [];
  await page.route('**/api/cities/create-with-generation', async route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    await route.fulfill({ status: 201, json: generatedResult(body, requests.length) });
  });
  let legs = 0;
  await page.route('**/api/itinerary/legs/create-with-city', route => { legs++; return route.abort(); });
  await form.getByRole('button', { name: 'Generate And Add 2 Cities', exact: true }).click();
  await expect(form).toBeHidden();
  await expect(page.getByText('2 cities added or selected.', { exact: true })).toBeVisible();
  expect(requests.map(body => body.cityName)).toEqual(['Missingville', 'Othercity']);
  expect(requests.every(body => body.nights === undefined)).toBe(true);
  expect(legs).toBe(0);
});

test('dataset city picker offers a keyboard-accessible add action for an unmatched city', async ({ page }) => {
  await page.goto('/dataset');
  await page.getByRole('button', { name: 'Search for a city', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Search for a city', exact: true });
  await picker.getByRole('combobox').fill('Missingville');
  const add = picker.getByRole('button', { name: 'Generate New City “Missingville”', exact: true });
  await add.focus();
  await page.keyboard.press('Enter');
  const form = page.getByRole('dialog', { name: 'Add New City With LLM', exact: true });
  await expect(form.getByLabel('City Name', { exact: true })).toHaveValue('Missingville');
});
