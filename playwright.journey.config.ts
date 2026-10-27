import { defineConfig } from "@playwright/test";

const external = process.env.JOURNEY_TEST_URL;
export default defineConfig({
  testDir: "./src/features/journey/__tests__",
  testMatch: "**/*.browser.spec.ts",
  outputDir: "test-results/journey",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: external ?? "http://localhost:3401",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: external
    ? undefined
    : {
        command: "npm run dev -- --port 3401",
        url: "http://localhost:3401",
        reuseExistingServer: false,
        env: {
          NEXT_PUBLIC_CAREER_JOURNEY_ENABLED: "true",
          NEXT_PUBLIC_APP_ENV: "development",
          NEXT_PUBLIC_DATA_SOURCE: "mock",
          SKILLORA_STAGING_BUILD: "true",
        },
      },
});
