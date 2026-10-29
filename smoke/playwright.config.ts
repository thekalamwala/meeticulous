import { defineConfig, devices } from '@playwright/test';

// Smoke harness. Points at a locally-running client dev server (port 5173).
// The server is NOT started here — run `npm run dev --prefix client` in a
// separate terminal, or wire a webServer block later if we want CI to boot
// it. Keeping the harness passive avoids the two-npm-graph headache during
// early iteration.
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,   // single browser, single worker — smoke, not load
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.SMOKE_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
