import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/features/journey/__tests__/*.test.ts"],
    env: {
      NEXT_PUBLIC_APP_ENV: "development",
      NEXT_PUBLIC_DATA_SOURCE: "mock",
    },
  },
});
