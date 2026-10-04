import { expect, test, type Page } from '@playwright/test';

async function openNewCity(page: Page) {
  await page.goto('/plan');
  await expect(page.locator('section[aria-label="Trip historical climate"]').getByRole('img', { name: /Historical mean temperature/ })).toBeVisible();
  await page.getByRole('button', { name: 'Add Leg', exact: true }).click();
  await page.getByRole('button', { name: 'Add City', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add New City With LLM', exact: true });
  await form.getByPlaceholder('e.g. Kunming', { exact: true }).fill('Sydney');
  await form.getByPlaceholder('e.g. China', { exact: true }).fill('Australia');
  return form;
}

test('new-city nights reject fractional, nonpositive and unsafe values before submitting', async ({ page }) => {
  let submissions = 0;
  await page.route('**/api/itinerary/legs/create-with-city', route => {
    submissions++;
    return route.fulfill({ status: 503, json: { error: 'Unexpected invalid-nights submission' } });
  });
  const form = await openNewCity(page);
  const nights = form.getByRole('spinbutton');
  for (const value of ['3.5', '0', '-2', '', '1e-2', '9007199254740992']) {
    await nights.fill(value);
    await expect(form.getByRole('button', { name: 'Generate City And Add Leg', exact: true })).toBeDisabled();
    await expect(nights).toHaveValue(value);
  }
  await nights.fill('3');
  await expect(form.getByRole('button', { name: 'Generate City And Add Leg', exact: true })).toBeEnabled();
  expect(submissions).toBe(0);
});

test('new-city flow reuses an existing city and saves the exact whole-number nights', async ({ page, request }) => {
  let createdId: number | undefined;
  try {
    const form = await openNewCity(page);
    await form.getByRole('spinbutton').fill('2');
    const saved = page.waitForResponse(response => response.url().endsWith('/api/itinerary/legs/create-with-city') && response.request().method() === 'POST');
    await form.getByRole('button', { name: 'Generate City And Add Leg', exact: true }).click();
    const response = await saved;
    expect(response.status()).toBe(201);
    const result = (await response.json()).data;
    createdId = result.leg.id;
    expect(result.city.reusedExistingCity).toBe(true);
    expect(result.city.generatedCity).toBe(false);
    expect(result.leg.nights).toBe(2);
    await expect(form).toBeHidden();
    await page.reload();
    await expect(page.getByTestId('planner-leg-card').last().getByRole('heading')).toHaveText('Sydney');
    await expect(page.getByTestId('planner-leg-card').last().getByLabel('Nights', { exact: true })).toHaveValue('2');
  } finally {
    if (createdId) expect((await request.delete(`/api/itinerary/legs/${createdId}`)).ok()).toBe(true);
  }
});
