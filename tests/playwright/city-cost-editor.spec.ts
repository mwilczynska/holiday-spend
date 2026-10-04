import { expect, test } from '@playwright/test';

test('city editor rejects negatives without losing drafts and preserves zero, missing and decimal costs', async ({ page, request }) => {
  const cities = (await (await request.get('/api/cities')).json()).data;
  const city = cities.find((row: { name: string }) => row.name === 'Agra');
  expect(city).toBeTruthy();
  const original = { accomHostel: city.accomHostel, drinkCoffee: city.drinkCoffee, drinksNone: city.drinksNone };
  try {
    expect((await request.post('/api/cities', { data: { countryId: city.countryId, name: 'QA negative city rejected', accomHostel: -5 } })).status()).toBe(400);
    expect((await request.put(`/api/cities/${city.id}`, { data: { accomHostel: -5, foodMid: 20 } })).status()).toBe(400);
    await page.goto(`/dataset?cityId=${city.id}`);
    const hostel = page.getByRole('spinbutton').first();
    await hostel.fill('-5');
    await page.getByRole('button', { name: 'Save City', exact: true }).click();
    await expect(page.getByText(/Shared Hostel Dorm must be a finite, nonnegative amount/)).toBeVisible();
    await expect(hostel).toHaveValue('-5');
    const after = (await (await request.get('/api/cities')).json()).data.find((row: { id: string }) => row.id === city.id);
    expect(after.accomHostel).toBe(original.accomHostel);

    await hostel.fill('0');
    await page.getByRole('button', { name: 'Save City', exact: true }).click();
    await expect(page.getByText('City saved.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Shared Hostel Dorm', { exact: true })).toHaveValue('0');
    await page.getByLabel('Shared Hostel Dorm', { exact: true }).fill('');
    await page.getByLabel('Coffee', { exact: true }).fill('3.25');
    await page.getByRole('button', { name: 'Save City', exact: true }).click();
    await expect(page.getByText('City saved.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Shared Hostel Dorm', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Coffee', { exact: true })).toHaveValue('3.25');
    await expect(page.getByLabel('None', { exact: true })).toHaveValue('6.5');
  } finally {
    expect((await request.put(`/api/cities/${city.id}`, { data: original })).ok()).toBeTruthy();
  }
});
