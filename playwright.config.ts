import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config for Dynamite Lens.
 *
 * The tests run against a running instance of the app served by the bundled
 * nginx (which also proxies DynamoDB Local at `/local`). By default we target
 * http://localhost:8080 (the docker-compose `web` service). Override with
 * BASE_URL if you serve it elsewhere.
 */
const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
