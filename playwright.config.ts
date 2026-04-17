import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT || 3000);
const baseUrl = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: baseUrl,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseUrl,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
