import { expect, test } from '@playwright/test';

test('rejected inline edits retain drafts, report errors, retry and discard', async ({ page }) => {
  test.setTimeout(60_000);
  const cities = (await (await page.request.get('/api/cities')).json()).data as Array<{ id: string; name: string }>;
  const created = await page.request.post('/api/itinerary/legs', { data: { cityId: cities.find(city => city.name === 'Agra')!.id, nights: 2 } });
  const id = (await created.json()).data.id;
  const otherCreated = await page.request.post('/api/itinerary/legs', { data: { cityId: cities.find(city => city.name === 'Amsterdam')!.id, nights: 3 } });
  const otherId = (await otherCreated.json()).data.id;
  try {
    await page.goto('/plan');
    await page.waitForLoadState('networkidle');
    const card = page.locator(`[data-leg-id="${id}"]`);
    await page.route(`**/api/itinerary/legs/${id}`, route => route.fulfill({ status: 503, json: { error: 'QA leg edit rejected' } }));
    await card.getByRole('spinbutton').fill('4');
    await expect(card.getByRole('alert')).toContainText('QA leg edit rejected');
    await expect(card.getByRole('spinbutton')).toHaveValue('4');
    await expect(page.getByRole('button', { name: 'Save Plan', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
    const readLeg = async () => (await (await page.request.get('/api/itinerary')).json()).data.find((leg: { id: number }) => leg.id === id);
    expect((await readLeg()).nights).toBe(2);
    await page.locator(`[data-leg-id="${otherId}"]`).getByRole('spinbutton').fill('5');
    await expect.poll(async () => (await (await page.request.get('/api/itinerary')).json()).data.find((leg: { id: number }) => leg.id === otherId)?.nights).toBe(5);
    await page.waitForLoadState('networkidle');
    await expect(card.getByRole('spinbutton')).toHaveValue('4');
    await expect(card.getByRole('alert')).toContainText('QA leg edit rejected');
    await page.unroute(`**/api/itinerary/legs/${id}`);
    await card.getByRole('button', { name: 'Retry leg save', exact: true }).click();
    await expect(card.getByRole('alert')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Save Plan', exact: true })).toBeEnabled();
    expect((await readLeg()).nights).toBe(4);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(card.getByRole('spinbutton')).toHaveValue('4');

    await card.getByRole('button', { name: 'Show cost overrides', exact: true }).click();
    await page.route(`**/api/itinerary/legs/${id}`, route => route.abort());
    await card.getByLabel('Accom $/night', { exact: true }).fill('100');
    await expect(card.getByRole('alert')).toContainText(/fetch|connection/i);
    await expect(card.getByLabel('Accom $/night', { exact: true })).toHaveValue('100');
    expect((await readLeg()).accomOverride).toBeNull();
    await page.unroute(`**/api/itinerary/legs/${id}`);
    await card.getByRole('button', { name: 'Retry leg save', exact: true }).click();
    await expect(card.getByRole('alert')).toBeHidden();
    expect((await readLeg()).accomOverride).toBe(100);
    await page.route(`**/api/itinerary/legs/${id}`, route => route.fulfill({ status: 200, contentType: 'text/plain', body: 'Unreadable result' }));
    await card.getByLabel('Accom $/night', { exact: true }).fill('101');
    await expect(card.getByRole('alert')).toContainText('unreadable save result');
    await expect(card.getByLabel('Accom $/night', { exact: true })).toHaveValue('101');
    await page.unroute(`**/api/itinerary/legs/${id}`);
    await card.getByRole('button', { name: 'Discard leg changes', exact: true }).click();
    await expect(card.getByLabel('Accom $/night', { exact: true })).toHaveValue('100');
    await expect(card.getByRole('alert')).toBeHidden();

    await page.route('**/api/itinerary/reorder', route => route.fulfill({ status: 503, json: { error: 'QA automatic order rejected' } }));
    await card.getByRole('button', { name: 'active', exact: true }).click();
    await expect(card.getByRole('alert')).toContainText('Leg saved, but automatic date ordering failed: QA automatic order rejected');
    expect((await readLeg()).status).toBe('active');
    await page.unroute('**/api/itinerary/reorder');
    await card.getByRole('button', { name: 'Retry leg save', exact: true }).click();
    await expect(card.getByRole('alert')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Save Plan', exact: true })).toBeEnabled();
  } finally {
    await page.request.delete(`/api/itinerary/legs/${id}`);
    await page.request.delete(`/api/itinerary/legs/${otherId}`);
  }
});

test('rapid inline edits are serialized and the last typed value persists', async ({ page }) => {
  const cities = (await (await page.request.get('/api/cities')).json()).data as Array<{ id: string; name: string }>;
  const created = await page.request.post('/api/itinerary/legs', { data: { cityId: cities.find(city => city.name === 'Agra')!.id, nights: 3 } });
  const id = (await created.json()).data.id;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const writes: number[] = [];
  try {
    await page.goto('/plan');
    await page.waitForLoadState('networkidle');
    const card = page.getByTestId('planner-leg-card').last();
    await page.route(`**/api/itinerary/legs/${id}`, async route => {
      writes.push(route.request().postDataJSON().nights);
      if (writes.length === 1) await pending;
      await route.continue();
    });
    await card.getByRole('spinbutton').fill('2');
    await expect.poll(() => writes.length).toBe(1);
    await card.getByRole('spinbutton').fill('20');
    await card.getByRole('spinbutton').fill('200');
    await expect(card.getByRole('spinbutton')).toHaveValue('200');
    expect(writes).toEqual([2]);
    release();
    await expect(page.getByRole('button', { name: 'Save Plan', exact: true })).toBeEnabled();
    expect(writes).toEqual([2, 200]);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(card.getByRole('spinbutton')).toHaveValue('200');
  } finally {
    release();
    await page.unroute(`**/api/itinerary/legs/${id}`);
    await page.request.delete(`/api/itinerary/legs/${id}`);
  }
});

test('rejected transport row edits retain their draft for retry', async ({ page }) => {
  const cities = (await (await page.request.get('/api/cities')).json()).data as Array<{ id: string; name: string }>;
  const created = await page.request.post('/api/itinerary/legs', { data: { cityId: cities.find(city => city.name === 'Agra')!.id, nights: 2 } });
  const id = (await created.json()).data.id;
  try {
    await page.goto('/plan');
    await page.waitForLoadState('networkidle');
    const card = page.getByTestId('planner-leg-card').last();
    await page.route(`**/api/itinerary/legs/${id}`, route => route.fulfill({ status: 503, json: { error: 'QA transport edit rejected' } }));
    await card.getByRole('button', { name: 'Add transport', exact: true }).click();
    await expect(card.getByRole('alert')).toContainText('QA transport edit rejected');
    await card.getByPlaceholder('Flight', { exact: true }).fill('QA train');
    await card.getByPlaceholder('Flight', { exact: true }).press('Tab');
    await card.getByPlaceholder('Cost', { exact: true }).fill('123.4');
    await card.getByPlaceholder('Cost', { exact: true }).press('Tab');
    await expect(card.getByRole('alert')).toContainText('QA transport edit rejected');
    await expect(card.getByPlaceholder('Cost', { exact: true })).toHaveValue('123.4');
    await page.unroute(`**/api/itinerary/legs/${id}`);
    await card.getByRole('button', { name: 'Retry leg save', exact: true }).click();
    await expect(card.getByRole('alert')).toBeHidden();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(card.getByPlaceholder('Flight', { exact: true })).toHaveValue('QA train');
    await expect(card.getByPlaceholder('Cost', { exact: true })).toHaveValue('123.4');
  } finally {
    await page.request.delete(`/api/itinerary/legs/${id}`);
  }
});
