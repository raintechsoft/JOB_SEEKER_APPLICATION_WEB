// One-off migration helper: splits the prototype's concatenated <style> block back into its
// original source files under src/styles/prototype/, preserving cascade order.
// Usage: node scripts/extract-prototype-css.mjs [path/to/Skillora-Standalone.html]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const source = process.argv[2] ?? "Skillora-Standalone.html";
const html = readFileSync(source, "utf8");
const css = html.slice(html.indexOf("<style>") + "<style>".length, html.indexOf("</style>"));

// Font faces are declared before the first source marker; fonts now live in /public/fonts.
const fontFiles = ["dm-sans-400", "dm-sans-500", "dm-sans-600", "dm-sans-700", "manrope-400", "manrope-500", "manrope-600", "manrope-700", "manrope-800"];
let fontIndex = 0;
const markers = [...css.matchAll(/\/\* \/([a-z-]+)\.css \*\//g)];
const fontCss = css
  .slice(0, markers[0].index)
  .replace(/url\(data:font\/ttf;base64,[A-Za-z0-9+/=]+\)/g, () => `url("/fonts/${fontFiles[fontIndex++]}.ttf")`)
  .trim();

const outDir = join("src", "styles", "prototype");
mkdirSync(outDir, { recursive: true });
writeFileSync(join("src", "styles", "fonts.css"), `/* Self-hosted fonts extracted from the prototype. */\n${fontCss}\n`);

const order = [];
markers.forEach((m, i) => {
  const name = m[1];
  const end = i + 1 < markers.length ? markers[i + 1].index : css.length;
  const body = css.slice(m.index, end).trim();
  if (/data:/.test(body)) throw new Error(`Unexpected data URI in ${name}.css`);
  writeFileSync(join(outDir, `${name}.css`), body + "\n");
  order.push(name);
});

writeFileSync(
  join(outDir, "index.css"),
  "/* Prototype stylesheets in their original cascade order. Do not reorder. */\n" +
    order.map((n) => `@import "./${n}.css";`).join("\n") +
    "\n",
);
console.log(`fonts: ${fontIndex}, stylesheets: ${order.length}`);
