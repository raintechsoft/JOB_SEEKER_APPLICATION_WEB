// Pixel comparison of screenshot pairs produced by compare-screens.mjs.
// Reports the share of differing pixels (per-channel tolerance 24) for every *-prototype.png / *-next.png pair.
// Usage: node scripts/diff-screens.mjs [filter]
import { chromium } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = "screenshots";
const filter = process.argv[2] ?? "";
const pairs = readdirSync(dir)
  .filter((f) => f.endsWith("-prototype.png") && f.includes(filter))
  .map((f) => [f.replace("-prototype.png", ""), join(dir, f), join(dir, f.replace("-prototype.png", "-next.png"))]);

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "msedge" });
const page = await browser.newPage();
const results = [];
for (const [name, a, b] of pairs) {
  const toUrl = (p) => "data:image/png;base64," + readFileSync(p).toString("base64");
  const r = await page.evaluate(
    async ([ua, ub]) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(ua), load(ub)]);
      const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
      const ctx = (img) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
      const da = ctx(ia), db = ctx(ib);
      let diff = 0, firstRow = -1;
      for (let i = 0; i < da.length; i += 4) {
        if (Math.abs(da[i] - db[i]) > 24 || Math.abs(da[i + 1] - db[i + 1]) > 24 || Math.abs(da[i + 2] - db[i + 2]) > 24) {
          diff++;
          if (firstRow < 0) firstRow = Math.floor(i / 4 / w);
        }
      }
      return { ratio: diff / (w * h), firstRow, size: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
    },
    [toUrl(a), toUrl(b)],
  );
  results.push({ name, ...r });
}
await browser.close();
for (const r of results.sort((x, y) => y.ratio - x.ratio)) console.log(`${(r.ratio * 100).toFixed(2).padStart(6)}%  first diff row ${String(r.firstRow).padStart(5)}  ${r.size}  ${r.name}`);
