import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { acceptsSignal, buildSchema, catalog } from "./realtime-contracts.mjs";

const root = new URL("../../../", import.meta.url);
const uuid = "11111111-1111-4111-8111-111111111111";
const example = (type) => {
  const event = catalog.events.find((item) => item.type === type);
  return {
    schemaVersion: 1, eventId: uuid, type, audience: event.audience, occurredAt: "2026-10-31T12:00:00.000Z",
    data: Object.fromEntries(Object.entries(event.data).map(([key, rule]) => [key, Array.isArray(rule) ? rule[0] : rule === "sequence" ? 1 : uuid])),
  };
};

test("the checked-in schema matches the catalog, and names/phases are explicit", () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL("contracts/realtime/signal.v1.schema.json", root), "utf8")), buildSchema());
  assert.equal(new Set(catalog.events.map((event) => event.type)).size, catalog.events.length);
  assert.equal(catalog.runtimeIntegrated, "partial");
  assert.deepEqual(catalog.runtimePhases, ["R2", "R3", "R4", "R5", "R6"]);
  for (const event of catalog.events) assert.match(event.phase, /^R[2-6]$/);
});

for (const event of catalog.events) {
  test(`${event.type}: valid hint, closed payload and audience isolation`, () => {
    const signal = example(event.type);
    assert.equal(acceptsSignal(signal, event.audience), true);
    for (const audience of ["identity", "account", "public", "portfolio"].filter((value) => value !== event.audience)) {
      assert.equal(acceptsSignal(signal, audience), false);
    }
    assert.equal(acceptsSignal({ ...signal, body: "private message" }, event.audience), false);
    for (const key of ["password", "code", "email", "phone", "token", "signedUrl", "status", "count", "text", "userId"]) {
      assert.equal(acceptsSignal({ ...signal, data: { ...signal.data, [key]: "must not be delivered" } }, event.audience), false);
    }
    for (const key of Object.keys(signal.data)) {
      const missing = structuredClone(signal);
      delete missing.data[key];
      assert.equal(acceptsSignal(missing, event.audience), false);
    }
  });
}

test("reject unknown events/versions, malformed envelopes, IDs, dates and oversized packets", () => {
  const signal = example("conversation.updated");
  const invalid = [
    null, [], "text", { ...signal, schemaVersion: 2 }, { ...signal, type: "message.sent" },
    { ...signal, eventId: "not-a-uuid" }, { ...signal, occurredAt: "yesterday" },
    { ...signal, occurredAt: "2026-10-31T12:00:00+05:30" },
    { ...signal, data: { conversationId: "../private" } },
    { ...signal, data: { conversationId: 1 } }, { ...signal, data: null },
    { ...signal, data: { conversationId: uuid, extra: "a".repeat(4096) } },
  ];
  for (const item of invalid) assert.equal(acceptsSignal(item, "identity"), false);
  assert.equal(acceptsSignal(signal, "administrator"), false);
});

test("public hints cannot carry source identities, private existence or private event types", () => {
  const signal = example("public.changed");
  for (const key of ["entryId", "organizationId", "conversationId", "identityId", "applicationId", "assetId"]) {
    assert.equal(acceptsSignal({ ...signal, data: { ...signal.data, [key]: uuid } }, "public"), false);
  }
  assert.equal(acceptsSignal({ ...signal, data: { surface: "messages", change: "refresh" } }, "public"), false);
  assert.equal(acceptsSignal({ ...signal, data: { surface: "feed", change: "private_post_created" } }, "public"), false);
  assert.equal(acceptsSignal({ ...example("application.changed"), audience: "public" }, "public"), false);
});

test("the polling inventory points to real sources and covers every current refetch interval", () => {
  const inventory = JSON.parse(readFileSync(new URL("contracts/realtime/refresh-inventory.v1.json", root), "utf8"));
  for (const row of inventory.entries) {
    assert.ok(existsSync(new URL(row.file, root)), row.file);
    const source = readFileSync(new URL(row.file, root), "utf8");
    for (const marker of row.markers) assert.ok(source.includes(marker), `${row.id}: ${marker}`);
    assert.ok(["replace", "retain", "replaced"].includes(row.disposition));
    if (row.disposition === "replaced") {
      assert.ok(!/refetchInterval\s*:|useLiveInterval/.test(source), `${row.id}: polling returned`);
      // Timer-shaped original markers (intervals and sleep loops) must stay gone once a loop is replaced.
      for (const marker of row.originalMarkers ?? []) if (/refetchInterval|wait\(/.test(marker)) assert.ok(!source.includes(marker), `${row.id}: ${marker} returned`);
    }
  }
  // R6 replaced the last two inventoried business-data loops (export status and media processing).
  assert.equal(inventory.entries.filter((row) => row.disposition === "replace").length, 0);
  const scan = (directory) => readdirSync(new URL(directory, root), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.name === "__tests__") return [];
    if (entry.isDirectory()) return scan(path);
    return /\.tsx?$/.test(entry.name) && /refetchInterval\s*:/.test(readFileSync(new URL(path, root), "utf8")) ? [path] : [];
  });
  const intervalFiles = scan("apps/web/src");
  const recordedFiles = new Set(inventory.entries.map((entry) => entry.file));
  for (const path of intervalFiles) assert.ok(recordedFiles.has(path), `Unmapped refetch interval: ${path}`);
});
