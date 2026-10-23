import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e-real",
  workers: 1,
  timeout: 45_000,
  retries: 0,
  use: { baseURL: "http://localhost:3400", channel: process.env.PW_CHANNEL ?? "msedge", trace: "retain-on-failure" },
  webServer: [
    { command: "node scripts/start-test-api.mjs", url: "http://localhost:8001/up", reuseExistingServer: false, timeout: 60_000 },
    { command: "npx next start -p 3400", url: "http://localhost:3400/api/health", reuseExistingServer: false, timeout: 60_000 },
  ],
});
