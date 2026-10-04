import { expect, test } from '@playwright/test';

test('manual miscellaneous costs persist, update totals, retain rejected drafts and remove', async ({ page }) => {
  test.setTimeout(60_000);
  const cities = (await (await page.request.get('/api/cities')).json()).data as Array<{ id: string; name: string }>;
  const created = await page.request.post('/api/itinerary/legs', { data: {
    cityId: cities.find(city => city.name === 'Agra')!.id, nights: 2,
  } });
  const id = (await created.json()).data.id;
  const readLeg = async () => (await (await page.request.get('/api/itinerary')).json()).data.find((leg: { id: number }) => leg.id === id);
  const original = await readLeg();
  try {
    await page.goto('/plan');
    await page.waitForLoadState('networkidle');
    const card = page.locator(`[data-leg-id="${id}"]`);
    const misc = card.getByTestId('miscellaneous-expenses');
    await misc.getByRole('button', { name: 'Add miscellaneous expense', exact: true }).click();
    await misc.getByLabel('Description', { exact: true }).fill('Laundry');
    await misc.getByLabel('Cost (AUD)', { exact: true }).fill('25.75');
    await expect.poll(async () => (await readLeg()).miscellaneousExpenses).toEqual([{ description: 'Laundry', cost: 25.75 }]);
    await expect(page.getByRole('button', { name: 'Save Plan', exact: true })).toBeEnabled();
    expect((await readLeg()).legTotal).toBeCloseTo(original.legTotal + 25.75);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(misc.getByLabel('Description', { exact: true })).toHaveValue('Laundry');
    await expect(misc.getByLabel('Cost (AUD)', { exact: true })).toHaveValue('25.75');

    await misc.getByLabel('Cost (AUD)', { exact: true }).fill('-2');
    await expect(card.getByRole('alert')).toContainText('nonnegative miscellaneous cost');
    await expect(page.getByRole('button', { name: 'Save Plan', exact: true })).toBeDisabled();
    expect((await readLeg()).miscellaneousExpenses[0].cost).toBe(25.75);
    await card.getByRole('button', { name: 'Discard leg changes', exact: true }).click();
    await expect(misc.getByLabel('Cost (AUD)', { exact: true })).toHaveValue('25.75');

    await page.route(`**/api/itinerary/legs/${id}`, route => route.fulfill({ status: 503, json: { error: 'QA miscellaneous save rejected' } }));
    await misc.getByLabel('Cost (AUD)', { exact: true }).fill('42.5');
    await expect(card.getByRole('alert')).toContainText('QA miscellaneous save rejected');
    await expect(misc.getByLabel('Cost (AUD)', { exact: true })).toHaveValue('42.5');
    expect((await readLeg()).miscellaneousExpenses[0].cost).toBe(25.75);
    await page.unroute(`**/api/itinerary/legs/${id}`);
    await card.getByRole('button', { name: 'Retry leg save', exact: true }).click();
    await expect(card.getByRole('alert')).toBeHidden();
    expect((await readLeg()).legTotal).toBeCloseTo(original.legTotal + 42.5);

    // A superficially successful response must acknowledge the requested costs.
    await page.route(`**/api/itinerary/legs/${id}`, route => route.fulfill({ status: 200, json: { data: { id } } }));
    await misc.getByLabel('Cost (AUD)', { exact: true }).fill('44');
    await expect(card.getByRole('alert')).toContainText('did not confirm the miscellaneous expenses');
    await expect(misc.getByLabel('Cost (AUD)', { exact: true })).toHaveValue('44');
    await page.unroute(`**/api/itinerary/legs/${id}`);
    await card.getByRole('button', { name: 'Discard leg changes', exact: true }).click();
    await expect(misc.getByLabel('Cost (AUD)', { exact: true })).toHaveValue('42.5');

    await misc.getByRole('button', { name: 'Add miscellaneous expense', exact: true }).click();
    await misc.getByLabel('Description', { exact: true }).last().fill('Luggage storage');
    await misc.getByLabel('Cost (AUD)', { exact: true }).last().fill('0');
    await expect.poll(async () => (await readLeg()).miscellaneousExpenses).toEqual([
      { description: 'Laundry', cost: 42.5 }, { description: 'Luggage storage', cost: 0 },
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await misc.screenshot({ path: '.local/planner-miscellaneous-mobile.png' });
    await misc.getByRole('button', { name: 'Remove miscellaneous expense 1', exact: true }).click();
    await expect.poll(async () => (await readLeg()).miscellaneousExpenses).toEqual([{ description: 'Luggage storage', cost: 0 }]);
    await misc.getByRole('button', { name: 'Remove miscellaneous expense 1', exact: true }).click();
    await expect.poll(async () => (await readLeg()).miscellaneousExpenses).toEqual([]);
    expect((await readLeg()).legTotal).toBeCloseTo(original.legTotal);
  } finally {
    await page.unroute(`**/api/itinerary/legs/${id}`);
    await page.request.delete(`/api/itinerary/legs/${id}`);
  }
});

test('saved comparisons display miscellaneous costs as their own category', async ({ page }) => {
  const cities = (await (await page.request.get('/api/cities')).json()).data as Array<{ id: string; name: string }>;
  const ids: string[] = [];
  try {
    for (const cost of [37.5, 50]) {
      const response = await page.request.post('/api/saved-plans', { data: {
        name: `Miscellaneous QA ${cost} ${Date.now()}`,
        snapshot: { legs: [{ cityId: cities.find(city => city.name === 'Agra')!.id, nights: 2,
          startDate: '2026-12-01', accomOverride: 0, foodOverride: 0, drinksOverride: 0,
          activitiesOverride: 0, transportOverride: 0,
          miscellaneousExpenses: [{ description: 'Laundry', cost }] }], fixedCosts: [] },
        summary: { totalBudget: cost },
      } });
      expect(response.ok()).toBe(true);
      ids.push((await response.json()).data.id);
    }
    const result = await page.request.post('/api/saved-plans/compare', { data: { planIds: ids } });
    expect(result.ok()).toBe(true);
    const plans = (await result.json()).data.plans;
    expect(plans.map((plan: { summary: { totalBudget: number } }) => plan.summary.totalBudget)).toEqual([37.5, 50]);
    await page.goto(`/plan/compare?ids=${ids.join(',')}`);
    await expect(page.getByText('Planned Spend by Category', { exact: true })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Miscellaneous' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Expand', exact: true }).last().click();
    await expect(page.getByRole('dialog').locator('svg text').filter({ hasText: 'Miscellaneous' }).first()).toBeVisible();
  } finally {
    for (const id of ids) await page.request.delete(`/api/saved-plans/${id}`);
  }
});
