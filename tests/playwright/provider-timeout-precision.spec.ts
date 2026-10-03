import { expect, test } from '@playwright/test';

test('provider timeout seconds preserve the exact saved millisecond value across saves, reads and reloads', async ({ page, request }) => {
  try {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const timeout = page.getByLabel('Request timeout (seconds)', { exact: true });
    for (const seconds of ['90.5', '90.125', '10.001', '16.001', '16.002', '1800']) {
      await timeout.fill(seconds);
      const saved = page.waitForResponse(response => response.url().endsWith('/api/settings/llm') && response.request().method() === 'PUT');
      await page.getByRole('button', { name: 'Save limits', exact: true }).click();
      const response = await saved;
      expect(response.ok()).toBeTruthy();
      expect((await response.json()).data.requestTimeoutMs).toBe(Math.round(Number(seconds) * 1000));
      await expect(page.getByRole('status')).toHaveText('Provider limits saved.');
      await expect(timeout).toHaveValue(seconds);
      await page.reload();
      await expect(timeout).toHaveValue(seconds);
      await page.goto('/estimates');
      await page.waitForLoadState('networkidle');
      const refreshed = page.waitForResponse(response => response.url().endsWith('/api/settings/llm') && response.request().method() === 'GET');
      await page.locator('aside').getByRole('link', { name: 'Settings', exact: true }).click();
      expect((await refreshed).ok()).toBeTruthy();
      await expect(timeout).toHaveValue(seconds);
    }
    await timeout.fill('90.1255');
    await page.getByRole('button', { name: 'Save limits', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /int/i })).toBeVisible();
    await expect(timeout).toHaveValue('90.1255');
    expect((await (await request.get('/api/settings/llm')).json()).data.requestTimeoutMs).toBe(1800000);
    await page.getByRole('button', { name: 'Reset to defaults', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Provider limits reset to the defaults.');
    await expect(timeout).toHaveValue('600');
  } finally {
    expect((await request.put('/api/settings/llm', { data: { maxOutputTokens: null, requestTimeoutMs: null } })).ok()).toBeTruthy();
  }
});
