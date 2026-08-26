import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT || 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${port}`;
const playwrightPin = process.env.PLAYWRIGHT_AUTH_DEV_PIN || '1234';
const nextAuthSecret = process.env.APP_SECRET || 'playwright-dev-secret';

process.env.NEXTAUTH_URL = baseURL;
process.env.NEXTAUTH_SECRET ||= nextAuthSecret;
process.env.AUTH_DEV_PIN = playwrightPin;

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  outputDir: 'test-results/playwright',
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 960 },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: `cmd /c npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    env: {
      NEXTAUTH_URL: baseURL,
      NEXTAUTH_SECRET: nextAuthSecret,
      AUTH_DEV_PIN: playwrightPin,
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
