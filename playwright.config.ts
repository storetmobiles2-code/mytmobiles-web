import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. They place real orders and change stock, so run them only
 * against a disposable, seeded database — never production.
 *
 *   npm run build && npm run test:e2e         # starts `next start` on :3100
 *   E2E_BASE_URL=http://localhost:3000 npm run test:e2e   # use a running server
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /storefront\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npx next start -p 3100", url: `${baseURL}/api/health`, reuseExistingServer: true, timeout: 120_000 },
});
