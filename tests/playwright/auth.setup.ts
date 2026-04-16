import fs from 'fs';
import path from 'path';
import { test as setup, expect } from '@playwright/test';

const authFile = path.join(process.cwd(), '.playwright', '.auth', 'user.json');

setup('authenticate dev user', async ({ page }) => {
  const appPin = process.env.PLAYWRIGHT_AUTH_DEV_PIN || process.env.AUTH_DEV_PIN || process.env.APP_SECRET || '1234';

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto('/login');
  await page.getByPlaceholder('Development PIN').fill(appPin);
  await page.getByRole('button', { name: 'Enter dev mode' }).click();
  await expect(page).toHaveURL('/', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Wanderledger' }).first()).toBeVisible();

  await page.context().storageState({ path: authFile });
});
