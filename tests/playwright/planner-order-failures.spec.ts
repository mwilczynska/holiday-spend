import { expect, test } from '@playwright/test';

test('failed itinerary moves and sorts show errors, preserve order and allow retry', async ({ page }) => {
  const readOrder = async () => (await (await page.request.get('/api/itinerary')).json()).data.map((leg: { id: number }) => leg.id) as number[];
  const original = await readOrder();
  expect(original.length).toBeGreaterThan(1);
  try {
    await page.goto('/plan');
    await page.waitForLoadState('networkidle');
    const cards = page.getByTestId('planner-leg-card');
    const names = await cards.getByRole('heading').allTextContents();
    await page.route('**/api/itinerary/reorder', route => route.fulfill({ status: 503, json: { error: 'QA reorder rejected' } }));
    await cards.last().getByRole('button').nth(0).click();
    await expect(page.getByRole('alert').filter({ hasText: 'QA reorder rejected' })).toBeVisible();
    expect(await readOrder()).toEqual(original);
    expect(await cards.getByRole('heading').allTextContents()).toEqual(names);
    await page.unroute('**/api/itinerary/reorder');
    await cards.last().getByRole('button', { name: /^Move .* leg up$/ }).click();
    await expect.poll(readOrder).not.toEqual(original);
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect((await cards.getByRole('heading').allTextContents()).slice(-2)).toEqual(names.slice(-2).reverse());
    await page.route('**/api/itinerary/reorder', route => route.fulfill({ status: 503, json: { error: 'QA sort rejected' } }));
    await page.getByRole('button', { name: 'Sort by Date', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'QA sort rejected' })).toBeVisible();
    await expect(page.getByText('Legs sorted by date.', { exact: true })).toBeHidden();
    await page.unroute('**/api/itinerary/reorder');
    await page.route('**/api/itinerary/reorder', route => route.abort());
    await page.getByRole('button', { name: 'Sort by Date', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /fetch|connection/i })).toBeVisible();
    await page.unroute('**/api/itinerary/reorder');
    await page.getByRole('button', { name: 'Sort by Date', exact: true }).click();
    await expect(page.getByText('Legs sorted by date.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sort by Date', exact: true })).toBeDisabled();
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(await readOrder()).toEqual(original);
  } finally {
    await page.request.put('/api/itinerary/reorder', { data: { legIds: original } });
  }
});
