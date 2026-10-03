import { expect, test } from '@playwright/test';
import { gotoClientPage } from './client-navigation';

test('failed planner reads preserve loaded legs and totals until a successful retry', async ({ page }) => {
  const legs = (await (await page.request.get('/api/itinerary')).json()).data as Array<{ cityName: string }>;
  expect(legs.length).toBeGreaterThan(0);
  await page.route('**/api/itinerary', route => route.fulfill({ status: 503, json: { error: 'QA itinerary read unavailable' } }));
  await gotoClientPage(page, '/plan');
  await expect(page.getByRole('alert').filter({ hasText: 'QA itinerary read unavailable' })).toContainText('last loaded planner data');
  expect(await page.getByTestId('planner-leg-card').getByRole('heading').allTextContents()).toEqual(legs.map(leg => leg.cityName));
  await expect(page.getByText('No legs yet. Add your first destination to start planning.', { exact: true })).toBeHidden();
  await expect(page.getByText(new RegExp(`Last loaded plan: .*${legs.length} legs`))).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Plan', exact: true })).toBeDisabled();
  await page.unroute('**/api/itinerary');
  await page.getByRole('button', { name: 'Retry planner', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'QA itinerary read unavailable' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Save Plan', exact: true })).toBeEnabled();

  await page.route('**/api/cities?view=planner', route => route.fulfill({ status: 200, contentType: 'text/plain', body: 'not JSON' }));
  await gotoClientPage(page, '/plan');
  await expect(page.getByRole('alert').filter({ hasText: 'unreadable cities response' })).toBeVisible();
  expect(await page.getByTestId('planner-leg-card').getByRole('heading').allTextContents()).toEqual(legs.map(leg => leg.cityName));
  await page.unroute('**/api/cities?view=planner');
  await page.getByRole('button', { name: 'Retry planner', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'unreadable cities response' })).toBeHidden();

  await page.route('**/api/fixed-costs', route => route.abort());
  await gotoClientPage(page, '/plan');
  await expect(page.getByRole('alert').filter({ hasText: /fetch|connection/i })).toBeVisible();
  expect(await page.getByTestId('planner-leg-card').getByRole('heading').allTextContents()).toEqual(legs.map(leg => leg.cityName));
  await page.unroute('**/api/fixed-costs');
  await page.route('**/api/planner/settings', route => route.fulfill({ status: 200, json: { data: { groupSize: 0 } } }));
  await page.getByRole('button', { name: 'Retry planner', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'invalid traveller settings' })).toBeVisible();
  await page.unroute('**/api/planner/settings');
  await page.route('**/api/countries?includeCities=false', route => route.fulfill({ status: 200, json: { data: {} } }));
  await page.getByRole('button', { name: 'Retry planner', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'invalid countries list' })).toBeVisible();
  await page.unroute('**/api/countries?includeCities=false');
  await page.getByRole('button', { name: 'Retry planner', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry planner', exact: true })).toBeHidden();
  expect(await page.getByTestId('planner-leg-card').getByRole('heading').allTextContents()).toEqual(legs.map(leg => leg.cityName));
});

test('saved-plan reads expose failure and retry, while successful empty results remain empty', async ({ page }) => {
  const plans = (await (await page.request.get('/api/saved-plans')).json()).data as unknown[];
  expect(plans.length).toBeGreaterThan(0);
  await page.route('**/api/saved-plans', route => route.fulfill({ status: 503, json: { error: 'QA saved plans unavailable' } }));
  await gotoClientPage(page, '/plan');
  await expect(page.getByRole('alert').filter({ hasText: 'QA saved plans unavailable' })).toContainText('last loaded saved plans');
  await expect(page.getByRole('button', { name: `Saved Plans (${plans.length})`, exact: true })).toBeVisible();
  await page.unroute('**/api/saved-plans');
  await page.getByRole('button', { name: 'Retry saved plans', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'QA saved plans unavailable' })).toBeHidden();
  await page.route('**/api/itinerary', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/saved-plans', route => route.fulfill({ json: { data: [] } }));
  await gotoClientPage(page, '/plan');
  await expect(page.getByTestId('planner-leg-card')).toHaveCount(0);
  await expect(page.getByText('No legs yet. Add your first destination to start planning.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Saved Plans \(/ })).toBeHidden();
  await expect(page.getByRole('button', { name: /^Retry (planner|saved plans)$/ })).toBeHidden();
});
