import { expect, test } from '@playwright/test';

test('invalid request limits retain drafts and do not reset existing overrides', async ({ page }) => {
  await page.request.put('/api/settings/llm', { data: { maxOutputTokens: 32000, requestTimeoutMs: 90000 } });
  try {
    await page.goto('/settings');
    const tokens = page.getByLabel('Maximum output tokens', { exact: true });
    const timeout = page.getByLabel('Request timeout (seconds)', { exact: true });
    for (const invalid of ['0', '-1', '999', '400001', '1000.5']) {
      await tokens.fill(invalid);
      const rejected = page.waitForResponse(response => response.url().endsWith('/api/settings/llm') && response.request().method() === 'PUT');
      await page.getByRole('button', { name: 'Save limits', exact: true }).click();
      expect((await rejected).status()).toBe(400);
      await expect(page.getByRole('alert').filter({ hasText: /small|big|int/i })).toBeVisible();
      await expect(tokens).toHaveValue(invalid);
      expect((await (await page.request.get('/api/settings/llm')).json()).data.maxOutputTokens).toBe(32000);
    }
    await tokens.fill('32000');
    for (const invalid of ['0', '-1', '9', '1801']) {
      await timeout.fill(invalid);
      const rejected = page.waitForResponse(response => response.url().endsWith('/api/settings/llm') && response.request().method() === 'PUT');
      await page.getByRole('button', { name: 'Save limits', exact: true }).click();
      expect((await rejected).status()).toBe(400);
      await expect(timeout).toHaveValue(invalid);
      expect((await (await page.request.get('/api/settings/llm')).json()).data.requestTimeoutMs).toBe(90000);
    }
  } finally {
    await page.request.put('/api/settings/llm', { data: { maxOutputTokens: null, requestTimeoutMs: null } });
  }
});

test('valid request limits persist and empty fields or Reset return to defaults', async ({ page }) => {
  try {
    await page.goto('/settings');
    await page.getByLabel('Maximum output tokens', { exact: true }).fill('32000');
    await page.getByLabel('Request timeout (seconds)', { exact: true }).fill('90');
    await page.getByRole('button', { name: 'Save limits', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Provider limits saved.');
    await page.reload();
    await expect(page.getByLabel('Maximum output tokens', { exact: true })).toHaveValue('32000');
    await expect(page.getByLabel('Request timeout (seconds)', { exact: true })).toHaveValue('90');
    await page.getByLabel('Maximum output tokens', { exact: true }).fill('');
    await page.getByLabel('Request timeout (seconds)', { exact: true }).fill('');
    await page.getByRole('button', { name: 'Save limits', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Provider limits reset to the defaults.');
    await page.getByLabel('Maximum output tokens', { exact: true }).fill('1000');
    await page.getByLabel('Request timeout (seconds)', { exact: true }).fill('10');
    await page.getByRole('button', { name: 'Save limits', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Provider limits saved.');
    await page.getByRole('button', { name: 'Reset to defaults', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Provider limits reset to the defaults.');
  } finally {
    await page.request.put('/api/settings/llm', { data: { maxOutputTokens: null, requestTimeoutMs: null } });
  }
});
