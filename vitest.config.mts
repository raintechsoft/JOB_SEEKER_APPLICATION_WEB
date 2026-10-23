import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    // Unit tests cover the development UI (demo logins, OTP codes); production gating has its own test.
    env: { NEXT_PUBLIC_APP_ENV: "development", NEXT_PUBLIC_DATA_SOURCE: "mock" },
  },
});
