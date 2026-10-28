import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type HttpClient } from "@/services/api/client";
import type { AuthSession } from "@/services/auth/auth.service";
import { createHttpInteractionsService } from "@/services/interactions/interactions.http";
import { recordInteraction, registerDwellCollector, type InteractionInput } from "@/lib/interactions/tracker";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const item = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const session = (identity: string) => ({ user: { id: "33333333-3333-4333-8333-333333333333" }, selected_identity_id: identity }) as unknown as AuthSession;
const view = (n: number, extra: Partial<InteractionInput> = {}): InteractionInput => ({ action: "view", itemKind: "post", itemId: item(n), surface: "feed", ...extra });

const created: { reset(): void }[] = [];
function setup(personalize = true) {
  const post = vi.fn(async (..._args: unknown[]) => ({ data: { accepted: 1, dropped: 0 } }));
  const beacon = vi.fn((..._args: unknown[]) => true);
  const get = vi.fn(async () => ({ data: { personalize, searchHistory: true } }));
  const http = { post, beacon, get } as unknown as HttpClient;
  const service = createHttpInteractionsService(http);
  created.push(service);
  const sent = () => post.mock.calls.map((c) => c[1] as { identityId: string; events: { action: string; itemId: string }[] });
  return { post, beacon, service, sent };
}

describe("interactions service: personalisation off (F12)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { created.splice(0).forEach((s) => s.reset()); vi.useRealTimers(); });

  it("stops before anything is sent when the account has personalisation off", async () => {
    const { service, sent } = setup(false);
    service.attach(session(ME));
    recordInteraction(view(1));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(sent()).toHaveLength(0);
    recordInteraction(view(2));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(sent()).toHaveLength(0);
  });

  it("switching off drops what is queued; switching on resumes", async () => {
    const { service, sent } = setup(true);
    service.attach(session(ME));
    await vi.advanceTimersByTimeAsync(0);
    recordInteraction(view(1));
    service.setEnabled(false, null);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(sent()).toHaveLength(0);
    service.setEnabled(true, session(ME));
    await vi.advanceTimersByTimeAsync(0);
    recordInteraction(view(2));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent().flatMap((b) => b.events.map((e) => e.itemId))).toEqual([item(2)]);
  });
});

describe("interactions service", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { created.splice(0).forEach((s) => s.reset()); vi.useRealTimers(); });

  it("sends nothing until a workspace is attached, then batches every 10 seconds", async () => {
    const { service, sent } = setup();
    recordInteraction(view(1));
    service.attach(session(ME));
    recordInteraction(view(2));
    recordInteraction({ action: "click", itemKind: "job", itemId: item(3), surface: "jobs-rail", position: 0 });
    recordInteraction({ action: "dwell", itemKind: "post", itemId: item(2), surface: "feed", dwellMs: 4200 });
    expect(sent()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent()).toHaveLength(1);
    expect(sent()[0].identityId).toBe(ME);
    expect(sent()[0].events.map((e) => e.action)).toEqual(["view", "click", "dwell"]);
  });

  it("sends a full batch of 20 right away", async () => {
    const { service, sent } = setup();
    service.attach(session(ME));
    for (let n = 1; n <= 20; n++) recordInteraction(view(n));
    await vi.advanceTimersByTimeAsync(0);
    expect(sent()).toHaveLength(1);
    expect(sent()[0].events).toHaveLength(20);
  });

  it("counts a repeated view of the same card once per 30 minutes", async () => {
    const { service, sent } = setup();
    service.attach(session(ME));
    recordInteraction(view(1));
    recordInteraction(view(1));
    recordInteraction(view(1, { surface: "professional-feed" }));
    await vi.advanceTimersByTimeAsync(31 * 60_000);
    recordInteraction(view(1));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent().flatMap((b) => b.events)).toHaveLength(3);
  });

  it("silently drops input the server would reject", async () => {
    const { service, sent } = setup();
    service.attach(session(ME));
    recordInteraction({ action: "dwell", itemKind: "organization", itemId: item(1), dwellMs: 2000 });
    recordInteraction({ action: "dwell", itemKind: "post", itemId: item(2) });
    recordInteraction({ action: "view", itemKind: "post", itemId: "not-a-uuid" });
    recordInteraction({ action: "like" as "view", itemKind: "post", itemId: item(3) });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent()).toHaveLength(0);
  });

  it("never carries events into another workspace", async () => {
    const { service, sent, post } = setup();
    service.attach(session(ME));
    recordInteraction(view(1));
    service.attach(session(OTHER));
    recordInteraction(view(2));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent().map((b) => [b.identityId, b.events.map((e) => e.itemId)])).toEqual([[OTHER, [item(2)]]]);

    post.mockImplementationOnce(() => new Promise((_, reject) => setTimeout(() => reject(new ApiError("down", 503)), 100)));
    recordInteraction(view(3));
    await vi.advanceTimersByTimeAsync(10_000);
    service.reset();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent()).toHaveLength(2);
  });

  it("retries after a network or server error, waits for Retry-After, and drops rejected batches", async () => {
    const { service, sent, post } = setup();
    service.attach(session(ME));
    post.mockRejectedValueOnce(new TypeError("offline"));
    recordInteraction(view(1));
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent().map((b) => b.events.length)).toEqual([1, 1]);

    post.mockRejectedValueOnce(new ApiError("slow down", 429, undefined, 30));
    recordInteraction(view(2));
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(sent()).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent()).toHaveLength(4);

    post.mockRejectedValueOnce(new ApiError("invalid", 422));
    recordInteraction(view(3));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent()).toHaveLength(5);
  });

  it("collects open dwell time and sends everything when the page is hidden", () => {
    const { service, beacon, post } = setup();
    service.attach(session(ME));
    recordInteraction(view(1));
    const unregister = registerDwellCollector(() => recordInteraction({ action: "dwell", itemKind: "post", itemId: item(1), dwellMs: 2500 }));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    unregister();
    expect(post).not.toHaveBeenCalled();
    expect(beacon).toHaveBeenCalledTimes(1);
    const body = beacon.mock.calls[0][1] as { identityId: string; events: { action: string }[] };
    expect(body.identityId).toBe(ME);
    expect(body.events.map((e) => e.action)).toEqual(["view", "dwell"]);
    window.dispatchEvent(new Event("pagehide"));
    expect(beacon).toHaveBeenCalledTimes(1);
    service.reset();
  });

  it("keeps at most 100 queued events", async () => {
    const { service, sent, post } = setup();
    service.attach(session(ME));
    post.mockRejectedValue(new TypeError("offline"));
    for (let n = 1; n <= 130; n++) recordInteraction(view(n));
    await vi.advanceTimersByTimeAsync(0);
    post.mockResolvedValue({ data: { accepted: 20, dropped: 0 } });
    await vi.advanceTimersByTimeAsync(10 * 10_000);
    const delivered = new Set(sent().slice(-5).flatMap((b) => b.events.map((e) => e.itemId)));
    expect(delivered.size).toBe(100);
    expect(delivered.has(item(130))).toBe(true);
  });
});
