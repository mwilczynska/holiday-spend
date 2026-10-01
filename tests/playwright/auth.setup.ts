import fs from 'fs';
import path from 'path';
import { test as setup, expect } from '@playwright/test';

const authFile = path.join(process.cwd(), '.playwright', '.auth', 'user.json');

setup.setTimeout(60_000);

setup('authenticate test user', async ({ page }) => {
  const appPin = process.env.PLAYWRIGHT_AUTH_DEV_PIN || '1234';

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto('/login');
  const production = process.env.PLAYWRIGHT_PRODUCTION === 'true';
  if (production) {
    if (!process.env.WEBAPP_AUTH_EMAIL || !process.env.WEBAPP_AUTH_PASSWORD) throw new Error('Production tests require test-account credentials.');
    await page.getByLabel('Email', { exact: true }).fill(process.env.WEBAPP_AUTH_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(process.env.WEBAPP_AUTH_PASSWORD);
  } else {
    await page.getByPlaceholder('Development PIN').fill(appPin);
  }
  const credentialsResponse = page.waitForResponse((response) =>
    response.url().includes('/api/auth/callback/credentials')
  );
  await page.getByRole('button', { name: production ? 'Sign in' : 'Enter dev mode', exact: true }).click();
  await expect((await credentialsResponse).ok()).toBe(true);
  await page.goto('/');
  await expect(page).toHaveURL('/', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Holiday Spend' }).first()).toBeVisible();

  await page.context().storageState({ path: authFile });
});
