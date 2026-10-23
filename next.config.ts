import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// npm workspaces hoist `next` to the monorepo root, but this app's git root is
// apps/web — tell Turbopack where the real workspace root is.
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Isolated staging builds preserve the normal app's build and runtime output.
  distDir: process.env.SKILLORA_STAGING_BUILD === "true" ? ".next-staging" : ".next",
  typescript: { tsconfigPath: process.env.SKILLORA_STAGING_BUILD === "true" ? "tsconfig.staging.json" : "tsconfig.json" },
  // Keeps development screenshots comparable with the prototype.
  devIndicators: false,
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
