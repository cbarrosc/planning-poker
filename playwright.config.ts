import { defineConfig } from '@playwright/test';
const port = process.env.E2E_PORT ?? '3100';
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
export default defineConfig({
  testDir: './apps/web/tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL, headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: process.env.E2E_EXTERNAL
    ? undefined
    : {
        command: 'node dist/server.js',
        url: `${baseURL}/health`,
        reuseExistingServer: false,
        env: { PORT: port, DATABASE_PATH: 'data/e2e.sqlite', PUBLIC_ORIGIN: baseURL },
      },
});
