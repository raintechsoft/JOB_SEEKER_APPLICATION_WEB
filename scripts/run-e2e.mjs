import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const real = process.argv[2] === "real";
const cwd = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const env = { ...process.env, API_SESSION_COOKIE: real ? "skillora_e2e_session" : "skillora_session", NEXT_PUBLIC_APP_ENV: "development", NEXT_PUBLIC_DATA_SOURCE: real ? "http" : "mock", NEXT_PUBLIC_API_BASE_URL: real ? "http://localhost:8001/api/v1" : "http://localhost:8000/api/v1" };
for (const args of [[require.resolve("next/dist/bin/next"), "build"], [require.resolve("@playwright/test/cli"), "test", ...(real ? ["--config=playwright.real.config.ts"] : ["--workers=2"]), ...process.argv.slice(3)]]) {
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
