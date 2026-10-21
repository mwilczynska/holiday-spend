import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
test.setTimeout(180000);
test('records confirmed plan changes, exposes admin history and respects account opt-out', async ({ page, request }) => {
  const cities = (await (await request.get('/api/cities')).json()).data as Array<{ id: string }>;
  expect(cities.length).toBeGreaterThan(0);
  const created = await request.post('/api/itinerary/legs', { data: { cityId: cities[0].id, nights: 3 } });
  expect(created.status()).toBe(201);
  const leg = (await created.json()).data as { id: number };
  await page.goto('/settings');
  const preference = page.getByRole('switch', { name: 'Share product usage analytics' });
  await expect(preference).toBeChecked();
  await page.getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
  // Administrators are included by default and the choice is kept in the URL.
  await expect(page.getByLabel('Include administrators')).toBeChecked();
  expect(new URL(page.url()).searchParams.get('includeAdmins')).toBe('true');
  await expect(page.getByText('Controls used', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Plan history', exact: true }).click();
  await expect(page.getByText('Leg created', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: /View revision/ }).first().click();
  await expect(page.getByRole('link', { name: 'Export private revision' })).toBeVisible();
  await page.screenshot({ path: '.local/analytics-plans-desktop.png', fullPage: true });

  await page.goto('/settings');
  // Wait for the save itself: reloading first can cancel it, and the switch also reads as
  // unchecked while the preference is still loading, so neither check alone proves it saved.
  await expect(preference).toBeChecked();
  const saved = page.waitForResponse(r => r.url().endsWith('/api/settings/analytics') && r.request().method() === 'PUT');
  await preference.uncheck();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await expect(preference).toBeEnabled();
  await expect(preference).not.toBeChecked();
  const preferenceResponse = await request.get('/api/settings/analytics');
  expect((await preferenceResponse.json()).data.enabled).toBe(false);
  const disabled = await request.post('/api/analytics/events', {
    headers: { Origin: new URL(page.url()).origin },
    data: { events: [{ id: crypto.randomUUID(), name: 'page_viewed', version: 1, occurredAt: new Date().toISOString(), sessionId: crypto.randomUUID(), pageViewId: crypto.randomUUID(), route: '/plan', properties: {} }] },
  });
  expect(disabled.status()).toBe(204);
  expect((await request.put('/api/itinerary/legs/' + leg.id, { data: { nights: 4 } })).ok()).toBe(true);
  const history = await request.get('/api/admin/analytics?view=plans&environment=development&includeAdmins=true');
  expect((await history.json()).data.rows.some((row: { action: string }) => row.action === 'leg_updated')).toBe(true);
  const restored = page.waitForResponse(r => r.url().endsWith('/api/settings/analytics') && r.request().method() === 'PUT');
  await preference.check();
  expect((await restored).ok()).toBe(true);
  await expect(preference).toBeChecked();
  await request.delete('/api/itinerary/legs/' + leg.id);
});

test('admin reports render on mobile and reject invalid analytics payloads', async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/admin/analytics');
  for (const [name, label] of [['journeys', 'Journeys'], ['funnels', 'Funnels'], ['llm', 'LLM'], ['health', 'Health']]) {
    const response = page.waitForResponse(value => value.url().includes('/api/admin/analytics?') && new URL(value.url()).searchParams.get('view') === name);
    await page.getByRole('tab', { name: label, exact: true }).click();
    expect((await response).status()).toBe(200);
    await expect(page.getByText('Loading analytics…')).toHaveCount(0);
    // Next's route announcer also uses role=alert outside the app's main content.
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/analytics-health-mobile.png', fullPage: true });
  const invalid = await request.post('/api/analytics/events', { headers: { Origin: new URL(page.url()).origin }, data: { events: [{ name: 'mutation_committed', accountId: 'forged' }] } });
  expect(invalid.status()).toBe(400);
  const crossOrigin = await request.post('/api/analytics/events', { headers: { Origin: 'https://example.test' }, data: { events: [] } });
  expect(crossOrigin.status()).toBe(403);
});
