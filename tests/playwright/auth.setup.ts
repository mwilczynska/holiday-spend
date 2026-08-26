import fs from 'fs';
import path from 'path';
import { test as setup, expect } from '@playwright/test';

const authFile = path.join(process.cwd(), '.playwright', '.auth', 'user.json');

setup('authenticate dev user', async ({ page }) => {
  const appPin = process.env.PLAYWRIGHT_AUTH_DEV_PIN || '1234';

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto('/login');
  await page.getByPlaceholder('Development PIN').fill(appPin);
  const credentialsResponse = page.waitForResponse((response) =>
    response.url().includes('/api/auth/callback/credentials')
  );
  await page.getByRole('button', { name: 'Enter dev mode' }).click();
  await expect((await credentialsResponse).ok()).toBe(true);
  await page.goto('/');
  await expect(page).toHaveURL('/', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Holiday Spend' }).first()).toBeVisible();

  await page.context().storageState({ path: authFile });
});
