import { expect, type Page } from '@playwright/test';

/** Browser API mocks apply to client refreshes, while full loads now use server readers. */
export async function gotoClientPage(page: Page, path: '/plan' | '/dataset' | '/settings') {
  await page.goto('/estimates');
  await page.waitForLoadState('networkidle');
  await page.locator(`a[href="${path}"]`).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(new RegExp(path + '$'));
}
