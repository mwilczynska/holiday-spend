import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import Papa from 'papaparse';

test('Settings exports download complete JSON and CSV artifacts', async ({ page }) => {
  await page.goto('/settings');
  const expectedResponse = await page.request.get('/api/export?format=json');
  expect(expectedResponse.ok()).toBe(true);
  const expected = await expectedResponse.json();

  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const json = await jsonDownload;
  expect(json.suggestedFilename()).toMatch(/^holiday-spend-export-\d{4}-\d{2}-\d{2}\.json$/);
  const artifact = JSON.parse(await fs.readFile((await json.path())!, 'utf8'));
  for (const key of ['countries', 'cities', 'itinerary', 'fixedCosts', 'expenses', 'tags', 'expenseTags']) {
    expect(artifact[key]).toEqual(expected[key]);
  }

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toMatch(/^holiday-spend-expenses-\d{4}-\d{2}-\d{2}\.csv$/);
  const parsed = Papa.parse<Record<string, string>>(await fs.readFile((await csv.path())!, 'utf8'), { header: true });
  expect(parsed.errors).toEqual([]);
  expect(parsed.data.map(row => Number(row.id))).toEqual(expected.expenses.map((row: { id: number }) => row.id));
  await expect(page).toHaveURL('/settings');
});
