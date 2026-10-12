import { expect, type Locator, type Page } from '@playwright/test';

/** A cold dev page can paint its trigger before hydration attaches the click handler. */
export async function openAddLegDialog(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Add Itinerary Leg', exact: true });
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.getByRole('button', { name: 'Add Leg', exact: true }).first().click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000, intervals: [500, 1_000] });
  return dialog;
}

/** Planner leg cards start collapsed (except the active leg); open one before using its fields. */
export async function expandLegCard(card: Locator) {
  const toggle = card.getByRole('button', { name: /^(Expand|Collapse) / });
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000, intervals: [500, 1_000] });
}

/** Browser API mocks apply to client refreshes, while full loads now use server readers. */
export async function gotoClientPage(page: Page, path: '/plan' | '/dataset' | '/settings') {
  await page.goto('/estimates');
  await page.waitForLoadState('networkidle');
  await page.locator(`a[href="${path}"]`).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(new RegExp(path + '$'));
}
