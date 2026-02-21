import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'https://info-hub.io';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'api',
      testMatch: /api\.spec\.ts/,
      use: { baseURL: BASE_URL },
    },
    {
      name: 'e2e',
      testMatch: /e2e\.spec\.ts/,
      use: {
        baseURL: BASE_URL,
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
