import { z } from "zod";
import catalog from "./contracts/events.v1.json";
import schema from "./contracts/signal.v1.schema.json";

const validator = z.fromJSONSchema(schema as unknown as Parameters<typeof z.fromJSONSchema>[0]);
export type Signal = { schemaVersion: 1; eventId: string; type: string; audience: "identity" | "account" | "public" | "portfolio"; occurredAt: string; data: Record<string, string | number> };

/** The same closed schema as PHP. Unknown fields, wrong audiences and oversized hints are ignored. */
export function parseSignal(value: unknown, audience: Signal["audience"]): Signal | null {
  try {
    if (new TextEncoder().encode(JSON.stringify(value)).length > catalog.maxSignalBytes) return null;
    const result = validator.safeParse(value);
    return result.success && (result.data as Signal).audience === audience ? result.data as Signal : null;
  } catch { return null; }
}
