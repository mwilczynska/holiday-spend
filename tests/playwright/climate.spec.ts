import { expect, test, type Page, type Route } from '@playwright/test';
import { gotoClientPage } from './client-navigation';

const stopSpecs = [
  { name: 'New Year City', startDate: '2026-12-30', endDate: '2027-01-02' },
  { name: 'January City', startDate: '2027-01-02', endDate: '2027-02-01' },
  { name: 'February City', startDate: '2027-02-01', endDate: '2027-03-01' },
  { name: 'Missing City', startDate: '2027-03-01', endDate: '2027-04-01' },
  { name: 'April City', startDate: '2027-04-01', endDate: '2027-05-01' },
  { name: 'Undated City', startDate: null, endDate: null },
  { name: 'May City', startDate: '2027-05-01', endDate: '2027-06-01' },
  { name: 'June City', startDate: '2027-06-01', endDate: '2027-07-01' },
  { name: 'July City', startDate: '2027-07-01', endDate: '2027-08-01' },
  { name: 'August City', startDate: '2027-08-01', endDate: '2027-09-01' },
  { name: 'September City', startDate: '2027-09-01', endDate: '2027-10-01' },
  { name: 'October City', startDate: '2027-10-01', endDate: '2027-11-01' },
  { name: 'November City', startDate: '2027-11-01', endDate: '2027-12-01' },
  { name: 'December City', startDate: '2027-12-01', endDate: '2028-01-01' },
] as const;

const fixture = {
  legs: stopSpecs.map((stop, index) => {
    const id = index + 1;
    const nights = stop.startDate && stop.endDate
      ? (Date.parse(stop.endDate + 'T00:00:00Z') - Date.parse(stop.startDate + 'T00:00:00Z')) / 86_400_000
      : 7;

    return {
      id,
      cityId: 'city-' + String(id).padStart(2, '0'),
      cityName: stop.name,
      countryName: 'Testland',
      countryId: 'testland',
      startDate: stop.startDate,
      endDate: stop.endDate,
      nights,
      accomTier: '2star',
      foodTier: 'mid',
      drinksTier: 'moderate',
      activitiesTier: 'mid',
      accomOverride: null,
      foodOverride: null,
      drinksOverride: null,
      activitiesOverride: null,
      transportOverride: null,
      intercityTransportCost: 0,
      intercityTransportNote: null,
      intercityTransports: [],
      sortOrder: index,
      notes: null,
      status: 'planned',
      dailyCost: 100,
      legTotal: nights * 100,
    };
  }),
  cities: stopSpecs.map((stop, index) => ({
    id: 'city-' + String(index + 1).padStart(2, '0'),
    name: stop.name,
    countryId: 'testland',
    accomHostel: 10,
    accomPrivateRoom: 20,
    accom1star: 30,
    accom2star: 50,
    accom3star: 80,
    accom4star: 120,
    foodStreet: 5,
    foodBudget: 10,
    foodMid: 20,
    foodHigh: 30,
    drinkCoffee: 1,
    drinksNone: 0,
    drinksLight: 5,
    drinksModerate: 10,
    drinksHeavy: 20,
    activitiesFree: 0,
    activitiesBudget: 5,
    activitiesMid: 10,
    activitiesHigh: 20,
    transportLocal: 5,
  })),
};

async function fulfillData(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(status === 200 ? { data } : { error: 'Historical climate unavailable.' }),
  });
}

function climateForCity(cityId: string, name: string) {
  return {
    cityId,
    location: { name, countryCode: 'TL', latitude: 1.25, longitude: 2.5 },
    period: '2021-2025',
    sourceUrl: 'https://open-meteo.com/',
    sourceModel: cityId === 'city-14' ? 'ecmwf_ifs' : 'era5_seamless',
    grid: { latitude: 1.25, longitude: 2.5, elevation: 12, timezone: 'UTC' },
    months: Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const temperatureC = cityId === 'city-01'
        ? month === 1 ? 12.3 : 8.2
        : 15 + month / 10;
      const rainfallMm = month === 1 ? 75.6 : month * 10 + 0.6;
      return {
        month,
        temperatureC,
        highC: temperatureC + 4,
        lowC: temperatureC - 4,
        rainfallMm,
      };
    }),
  };
}

async function installPlannerMocks(page: Page) {
  const requestedClimateCities = new Set<string>();
  const climateAttempts = new Map<string, number>();
  let bulkReads = 0;
  const saved = Object.fromEntries(fixture.legs.filter(leg => leg.cityId !== 'city-14').map(leg => [leg.cityId, leg.cityId === 'city-04' ? null : climateForCity(leg.cityId, leg.cityName)]));
  let releaseCollection: () => void = () => {};
  const collectionGate = new Promise<void>(resolve => { releaseCollection = resolve; });

  await page.route('**/api/itinerary', route => fulfillData(route, fixture.legs));
  await page.route('**/api/cities?view=planner', route => fulfillData(route, fixture.cities));
  await page.route('**/api/countries?includeCities=false', route => fulfillData(route, [
    { id: 'testland', name: 'Testland', currencyCode: 'USD', region: 'Europe' },
  ]));
  await page.route('**/api/fixed-costs', route => fulfillData(route, []));
  await page.route('**/api/planner/settings', route => fulfillData(route, { groupSize: 2 }));
  await page.route('**/api/saved-plans', route => fulfillData(route, []));
  await page.route('**/api/climate?*', async route => {
    const query = new URL(route.request().url()).searchParams;
    if (route.request().method() === 'GET') {
      const ids = JSON.parse(query.get('cityIds') || '[]') as string[];
      if (!ids.every(id => id.startsWith('city-'))) {
        await fulfillData(route, Object.fromEntries(ids.map(id => [id, null])));
        return;
      }
      bulkReads += 1;
      await fulfillData(route, Object.fromEntries(ids.filter(id => id in saved).map(id => [id, saved[id]])));
      return;
    }
    const cityId = query.get('cityId');
    if (!cityId) {
      await fulfillData(route, null, 400);
      return;
    }

    requestedClimateCities.add(cityId);
    const attempt = (climateAttempts.get(cityId) ?? 0) + 1;
    climateAttempts.set(cityId, attempt);
    if (cityId === 'city-14') await collectionGate;

    const city = stopSpecs[Number(cityId.slice(-2)) - 1];
    saved[cityId] = climateForCity(cityId, city.name);
    await fulfillData(route, saved[cityId]);
  });

  return { requestedClimateCities, climateAttempts, releaseCollection, getBulkReads: () => bulkReads };
}

test('planner climate covers the full itinerary, shares temperature units, and retries missing data', async ({ page }) => {
  // Development recompilation can delay route hydration; data-loading behavior
  // itself is checked with the collection gate and exact request counts below.
  test.setTimeout(60_000);
  const { requestedClimateCities, climateAttempts, releaseCollection, getBulkReads } = await installPlannerMocks(page);

  await gotoClientPage(page, '/plan');

  const tripClimate = page.locator('section[aria-label="Trip historical climate"]');
  await expect(page.getByTestId('planner-leg-card')).toHaveCount(14, { timeout: 15_000 });
  // Per-leg climate sits inside each card's collapsible body.
  await page.getByRole('button', { name: 'Expand all', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show all', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Show next/ })).toHaveCount(0);
  await expect(tripClimate.getByText(/Loading trip climate…/)).toBeVisible();
  await expect(tripClimate.getByRole('img')).toHaveCount(0);
  await expect.poll(() => requestedClimateCities.has('city-14')).toBe(true);
  releaseCollection();
  await expect(tripClimate.getByRole('img', { name: /degrees C/ })).toBeVisible();

  // The first leg spans December and January; the next leg checks out on February 1,
  // so February must not be shown for that stay.
  const newYearClimate = page.locator('section[aria-label="New Year City historical climate"]');
  await expect(newYearClimate.getByText(/Historical averages.*2021/)).toBeVisible();
  const december = newYearClimate.getByText('Dec 2026', { exact: true }).locator('..');
  const january = newYearClimate.getByText('Jan 2027', { exact: true }).locator('..');
  await expect(december).toContainText(/8\.2.*121 mm\/month rain/);
  await expect(january).toContainText(/12\.3.*76 mm\/month rain/);

  const januaryCheckoutClimate = page.locator('section[aria-label="January City historical climate"]');
  await expect(januaryCheckoutClimate.getByText('Jan 2027', { exact: true })).toBeVisible();
  expect(await januaryCheckoutClimate.textContent()).not.toContain('Feb 2027');

  const undatedClimate = page.locator('section[aria-label="Undated City historical climate"]');
  await expect(undatedClimate.getByText(/Set valid travel dates/)).toBeVisible();

  const missingClimate = page.locator('section[aria-label="Missing City historical climate"]');
  await expect(missingClimate.getByText('Historical climate unavailable.')).toBeVisible();
  await expect(missingClimate.getByRole('button', { name: 'Retry climate' })).toBeVisible();
  expect(climateAttempts.get('city-04') ?? 0).toBe(0);

  // There are 14 dated month segments because the first leg crosses a month boundary.
  // One city is unavailable, leaving 13 dots per series, including the 14th leg.
  const tripChart = tripClimate.getByRole('img');
  await expect(tripChart.locator('g.recharts-line-dots')).toHaveCount(2);
  await expect(tripChart.locator('g.recharts-line-dots').nth(0).locator('circle.recharts-dot')).toHaveCount(13);
  await expect(tripChart.locator('g.recharts-line-dots').nth(1).locator('circle.recharts-dot')).toHaveCount(13);

  await tripClimate.getByRole('button', { name: 'Switch to Fahrenheit' }).click();
  await expect(tripClimate.getByRole('img', { name: /degrees F/ })).toBeVisible();
  await expect(january).toContainText('54.1');
  await newYearClimate.getByRole('button', { name: 'Switch to Celsius' }).click();
  await expect(tripClimate.getByRole('img', { name: /degrees C/ })).toBeVisible();
  await expect(january).toContainText('12.3');

  await newYearClimate.getByRole('button', { name: 'View year' }).click();
  const annualDialog = page.getByRole('dialog');
  await expect(annualDialog).toBeVisible();
  await expect(annualDialog.getByRole('img', { name: /degrees C/ })).toBeVisible();
  await expect(annualDialog.locator('tbody tr')).toHaveCount(12);
  const januaryRow = annualDialog.locator('tbody tr').first();
  await expect(januaryRow.locator('td').nth(0)).toHaveText('12.3');
  await expect(januaryRow.locator('td').nth(1)).toHaveText('76');

  await annualDialog.getByRole('button', { name: 'Switch to Fahrenheit' }).click();
  await expect(annualDialog.getByRole('img', { name: /degrees F/ })).toBeVisible();
  await expect(annualDialog.getByRole('columnheader').nth(1)).toContainText('F');
  await expect(januaryRow.locator('td').nth(0)).toHaveText('54.1');
  await expect(tripClimate.getByRole('img', { name: /degrees F/ })).toBeVisible();
  await expect(january).toContainText('54.1');

  await page.keyboard.press('Escape');
  await expect(annualDialog).toHaveCount(0);
  await missingClimate.getByRole('button', { name: 'Retry climate' }).click();
  await expect(missingClimate.getByText('Historical climate unavailable.')).toHaveCount(0);
  await expect(missingClimate.getByText('Mar 2027', { exact: true })).toBeVisible();
  await expect.poll(() => climateAttempts.get('city-04')).toBe(1);

  const decemberClimate = page.locator('section[aria-label="December City historical climate"]');
  await decemberClimate.getByRole('button', { name: 'View year' }).click();
  await expect(annualDialog.getByRole('link', { name: 'Open-Meteo / ECMWF IFS data' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(annualDialog).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const tripClimateBox = await tripClimate.boundingBox();
  expect(tripClimateBox).not.toBeNull();
  expect(tripClimateBox!.x).toBeGreaterThanOrEqual(0);
  expect(tripClimateBox!.x + tripClimateBox!.width).toBeLessThanOrEqual(390);
  const climateWidths = await tripClimate.evaluate(element => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(climateWidths.scroll).toBeLessThanOrEqual(climateWidths.client);

  // A later visit reads every saved result in one request and performs no collection.
  const readsBeforeReload = getBulkReads();
  const attemptsBeforeReload = Array.from(climateAttempts.entries());
  await page.setViewportSize({ width: 1440, height: 960 });
  await gotoClientPage(page, '/plan');
  await expect(page.getByTestId('planner-leg-card')).toHaveCount(14, { timeout: 15_000 });
  await expect(tripClimate.getByRole('img', { name: /degrees C/ })).toBeVisible();
  expect(getBulkReads() - readsBeforeReload).toBe(1);
  expect(Array.from(climateAttempts.entries())).toEqual(attemptsBeforeReload);
});
