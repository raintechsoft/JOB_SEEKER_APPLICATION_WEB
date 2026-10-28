import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawnSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const api = fileURLToPath(new URL("../../api/", import.meta.url));
// Ignored local/test settings are never printed. Business data uses a separate dedicated test DB.
const values = Object.fromEntries(readFileSync(new URL("../../api/.env.testing", import.meta.url), "utf8").split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#")).map((line) => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)]; }));
const env = { ...values, ...process.env, APP_ENV: "local", APP_URL: "http://localhost:8001", APP_DEBUG: "false", DB_DATABASE: "skillora_e2e_test", QUEUE_CONNECTION: "sync", SESSION_DRIVER: "redis", CACHE_STORE: "redis", REDIS_PREFIX: `skillora_e2e_${randomUUID()}_`, SESSION_COOKIE: "skillora_e2e_session", VERIFICATION_DELIVERY_DRIVER: "local", WHATSAPP_VERIFICATION_DRIVER: "local", SANCTUM_STATEFUL_DOMAINS: "localhost:3400", FRONTEND_URL: "http://localhost:3400", CORS_ALLOWED_ORIGINS: "http://localhost:3400" };
const migrate = spawnSync("php", ["artisan", "migrate", "--force"], { cwd: api, env, stdio: "inherit" });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);
const child = spawn("php", ["artisan", "serve", "--host=127.0.0.1", "--port=8001"], { cwd: api, env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill());
child.on("exit", (code) => process.exit(code ?? 0));
