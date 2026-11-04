import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";

const root = new URL("../../../", import.meta.url);
export const catalog = JSON.parse(readFileSync(new URL("contracts/realtime/events.v1.json", root), "utf8"));
const closed = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

export function buildSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Skillora realtime v1 change signal",
    description: "Versioned change hints. Channel authorization and encoded byte limits are enforced separately.",
    oneOf: catalog.events.map((event) => closed({
      schemaVersion: { type: "integer", const: catalog.version },
      eventId: catalog.definitions.uuid,
      type: { type: "string", const: event.type },
      audience: { type: "string", const: event.audience },
      occurredAt: { type: "string", format: "date-time", maxLength: 30, pattern: "Z$" },
      data: closed(Object.fromEntries(Object.entries(event.data).map(([key, rule]) => [
        key, Array.isArray(rule) ? { type: "string", enum: rule } : catalog.definitions[rule],
      ]))),
    })),
  };
}

// Offline contract validator. R2 supplies the PHP adapter; the shared browser adapter follows in R3.
const validator = z.fromJSONSchema(buildSchema());
export function acceptsSignal(signal, subscriptionAudience) {
  if (!["identity", "account", "public", "portfolio"].includes(subscriptionAudience)) return false;
  let bytes;
  try { bytes = Buffer.byteLength(JSON.stringify(signal), "utf8"); } catch { return false; }
  return bytes <= catalog.maxSignalBytes && validator.safeParse(signal).success && signal.audience === subscriptionAudience;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const target = new URL("contracts/realtime/signal.v1.schema.json", root);
  const content = JSON.stringify(buildSchema(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, content);
  else if (readFileSync(target, "utf8") !== content) throw new Error("Realtime schema differs; run npm run realtime:contracts to regenerate.");
  for (const name of ["events.v1.json", "signal.v1.schema.json"]) {
    const source = readFileSync(new URL(`contracts/realtime/${name}`, root), "utf8");
    for (const directory of ["apps/api/contracts/realtime", "apps/web/src/services/realtime/contracts"]) {
    const mirror = new URL(`${directory}/${name}`, root);
    if (process.argv.includes("--write")) {
      mkdirSync(new URL(".", mirror), { recursive: true });
      writeFileSync(mirror, source);
    } else if (readFileSync(mirror, "utf8") !== source) throw new Error(`Realtime API mirror differs: ${name}`);
    }
  }
  console.log(`Realtime schema and API mirrors ${process.argv.includes("--write") ? "generated" : "match"}; ${catalog.events.length} event types.`);
}
