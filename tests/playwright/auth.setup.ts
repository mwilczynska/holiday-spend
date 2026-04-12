import fs from 'fs';
import path from 'path';
import { test as setup, expect } from '@playwright/test';

const authFile = path.join(process.cwd(), '.playwright', '.auth', 'user.json');

setup('authenticate dev user', async ({ page }) => {
  const appPin = process.env.PLAYWRIGHT_APP_PIN || process.env.APP_SECRET || '1234';

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.context().addCookies([
    {
      name: 'wanderledger-auth',
      value: appPin,
      domain: '127.0.0.1',
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
    },
  ]);

  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Wanderledger' }).first()).toBeVisible();

  await page.context().storageState({ path: authFile });
});
