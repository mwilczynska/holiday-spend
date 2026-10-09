import { expect, test, type Page } from '@playwright/test';
import { expandLegCard } from './client-navigation';

async function openAddForm(page: Page) {
  await page.goto('/plan');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Add Leg', exact: true }).click();
  await page.getByRole('button', { name: 'Select a city', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Select a city', exact: true });
  await picker.getByRole('combobox').fill('Agra');
  await picker.getByRole('option', { name: 'Agra, India India', exact: true }).click();
  return page.getByRole('dialog', { name: 'Add Itinerary Leg', exact: true });
}

test('rejected Add Leg saves retain the selected city and nights for retry', async ({ page }) => {
  const original = (await (await page.request.get('/api/itinerary')).json()).data.map((leg: { id: number }) => leg.id) as number[];
  let createdId: number | undefined;
  try {
    const form = await openAddForm(page);
    await form.getByRole('spinbutton').fill('9');
    await page.route('**/api/itinerary/legs', route => route.fulfill({ status: 503, json: { error: 'QA leg addition rejected' } }));
    await form.getByRole('button', { name: 'Add Leg', exact: true }).click();
    await expect(form.getByRole('alert')).toHaveText('QA leg addition rejected');
    await expect(form.getByRole('spinbutton')).toHaveValue('9');
    await expect(form.getByRole('button', { name: 'Agra, India', exact: true })).toBeVisible();
    expect((await (await page.request.get('/api/itinerary')).json()).data.map((leg: { id: number }) => leg.id)).toEqual(original);
    await page.unroute('**/api/itinerary/legs');
    await page.route('**/api/itinerary/legs', route => route.abort());
    await form.getByRole('button', { name: 'Add Leg', exact: true }).click();
    await expect(form.getByRole('alert')).toContainText(/fetch|connection/i);
    await expect(form.getByRole('spinbutton')).toHaveValue('9');
    await page.unroute('**/api/itinerary/legs');
    await page.route('**/api/itinerary/legs', route => route.fulfill({ status: 200, contentType: 'text/plain', body: 'Unreadable result' }));
    await form.getByRole('button', { name: 'Add Leg', exact: true }).click();
    await expect(form.getByRole('alert')).toContainText('could not be confirmed');
    await expect(form.getByRole('spinbutton')).toHaveValue('9');
    await page.unroute('**/api/itinerary/legs');
    const saved = page.waitForResponse(response => response.url().endsWith('/api/itinerary/legs') && response.request().method() === 'POST');
    await form.getByRole('button', { name: 'Add Leg', exact: true }).click();
    const response = await saved;
    expect(response.status()).toBe(201);
    createdId = (await response.json()).data.id;
    await expect(form).toBeHidden();
    await expect(page.getByTestId('planner-leg-card').last().getByRole('heading')).toHaveText('Agra');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expandLegCard(page.getByTestId('planner-leg-card').last());
    await expect(page.getByTestId('planner-leg-card').last().getByRole('spinbutton')).toHaveValue('9');
  } finally {
    if (createdId) await page.request.delete(`/api/itinerary/legs/${createdId}`);
  }
});

test('Add Leg rejects invalid nights and locks its pending submission', async ({ page }) => {
  const form = await openAddForm(page);
  for (const value of ['0', '-2', '1.5', '']) {
    await form.getByRole('spinbutton').fill(value);
    await expect(form.getByRole('button', { name: 'Add Leg', exact: true })).toBeDisabled();
  }
  await form.getByRole('spinbutton').fill('2');
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let submissions = 0;
  await page.route('**/api/itinerary/legs', async route => {
    submissions += 1;
    await pending;
    await route.fulfill({ status: 503, json: { error: 'QA delayed rejection' } });
  });
  const requested = page.waitForRequest(request => request.url().endsWith('/api/itinerary/legs') && request.method() === 'POST');
  await form.getByRole('button', { name: 'Add Leg', exact: true }).click();
  await requested;
  await expect(form.getByRole('button', { name: 'Adding...', exact: true })).toBeDisabled();
  await expect(form.getByRole('spinbutton')).toBeDisabled();
  await expect(form.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await form.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(form).toBeVisible();
  release();
  await expect(form.getByRole('alert')).toHaveText('QA delayed rejection');
  expect(submissions).toBe(1);
  await expect(form.getByRole('spinbutton')).toHaveValue('2');
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(form).toBeHidden();
  await page.getByRole('button', { name: 'Add Leg', exact: true }).click();
  await expect(form.getByRole('spinbutton')).toHaveValue('7');
  await expect(form.getByRole('alert')).toBeHidden();
});
