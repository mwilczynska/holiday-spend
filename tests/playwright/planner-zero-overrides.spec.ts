import { expect, test } from '@playwright/test';
import { expandLegCard } from './client-navigation';

test('zero overrides stay visible after reload and clearing restores automatic costs', async ({ page }) => {
  const cities = (await (await page.request.get('/api/cities')).json()).data as Array<{ id: string; name: string }>;
  const city = cities.find(item => item.name === 'Agra')!;
  const created = await page.request.post('/api/itinerary/legs', { data: {
    cityId: city.id, nights: 2, intercityTransports: [{ mode: 'QA bus', cost: 65 }],
  } });
  expect(created.ok()).toBeTruthy();
  const id = (await created.json()).data.id;
  try {
    await page.goto('/plan');
    const card = page.getByTestId('planner-leg-card').last();
    await expandLegCard(card);
    await card.getByRole('button', { name: 'Show cost overrides', exact: true }).click();
    for (let index = 0; index < 5; index += 1) {
      const updated = page.waitForResponse(response => response.url().endsWith(`/api/itinerary/legs/${id}`) && response.request().method() === 'PUT');
      await card.getByPlaceholder('Auto', { exact: true }).nth(index).fill('0');
      expect((await updated).ok()).toBeTruthy();
      await expect(card.getByPlaceholder('Auto', { exact: true }).nth(index)).toHaveValue('0');
    }
    await expect(card.getByText('$0/day', { exact: true })).toBeVisible();
    await expect(card.getByText('$65 total', { exact: true })).toBeVisible();
    await page.reload();
    await expandLegCard(card);
    await card.getByRole('button', { name: 'Show cost overrides', exact: true }).click();
    for (let index = 0; index < 5; index += 1) {
      await expect(card.getByPlaceholder('Auto', { exact: true }).nth(index)).toHaveValue('0');
    }
    const updated = page.waitForResponse(response => response.url().endsWith(`/api/itinerary/legs/${id}`) && response.request().method() === 'PUT');
    await card.getByPlaceholder('Auto', { exact: true }).nth(0).fill('');
    expect((await updated).ok()).toBeTruthy();
    await expect(card.getByPlaceholder('Auto', { exact: true }).nth(0)).toHaveValue('');
    const saved = (await (await page.request.get('/api/itinerary')).json()).data.find((leg: { id: number }) => leg.id === id);
    expect(saved.accomOverride).toBeNull();
    expect(saved.drinksOverride).toBe(0);
    expect(saved.dailyCost).toBeGreaterThan(0);
    expect(saved.legTotal).toBe(saved.dailyCost * 2 + 65);
  } finally {
    await page.request.delete(`/api/itinerary/legs/${id}`);
  }
});
