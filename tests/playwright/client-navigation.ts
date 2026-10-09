import { expect, type Locator, type Page } from '@playwright/test';

/** Planner leg cards start collapsed (except the active leg); open one before using its fields. */
export async function expandLegCard(card: Locator) {
  const toggle = card.getByRole('button', { name: /^(Expand|Collapse) / });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

/** Browser API mocks apply to client refreshes, while full loads now use server readers. */
export async function gotoClientPage(page: Page, path: '/plan' | '/dataset' | '/settings') {
  await page.goto('/estimates');
  await page.waitForLoadState('networkidle');
  await page.locator(`a[href="${path}"]`).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(new RegExp(path + '$'));
}
