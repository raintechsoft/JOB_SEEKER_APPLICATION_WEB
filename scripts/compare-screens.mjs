// Visual comparison: screenshots the original prototype (hash routes in the standalone HTML) and the
// Next.js app (real routes) at the same viewport, side by side in ./screenshots.
//
// Usage: node scripts/compare-screens.mjs [baseUrl] [route ...] [--width=1440] [--height=900] [--full]
// Requires a running app (npm run dev / npm start) and Microsoft Edge or Chrome (no browser download).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const positional = args.filter((a) => !a.startsWith("--"));
const baseUrl = positional[0] ?? "http://localhost:3000";
const routes = positional.length > 1 ? positional.slice(1) : ["/"];
const width = Number(flags.width ?? 1440);
const height = Number(flags.height ?? 900);
const fullPage = "full" in flags;
const prototype = pathToFileURL(resolve("Skillora-Standalone.html")).href;

mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "msedge" });
const errors = [];

async function shoot(url, file) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${url}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${url}: console: ${m.text()}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: file, fullPage });
  await context.close();
}

for (const route of routes) {
  const slug = (route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home") + `-${width}`;
  await shoot(`${prototype}#${route}`, `screenshots/${slug}-prototype.png`);
  await shoot(`${baseUrl}${route}`, `screenshots/${slug}-next.png`);
  console.log(`captured ${route} → screenshots/${slug}-{prototype,next}.png`);
}
await browser.close();
if (errors.length) {
  console.log("\nPage errors:\n" + errors.join("\n"));
  process.exitCode = 1;
}
