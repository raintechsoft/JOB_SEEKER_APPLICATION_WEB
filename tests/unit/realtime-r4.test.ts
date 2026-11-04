import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { createSocialReconciler, mergeVisible, type LiveMeta } from "@/services/realtime/social-reconcile";
import type { Signal } from "@/services/realtime/signal";
import { createHttpFeedService } from "@/services/feed/feed.http";
import type { HttpClient } from "@/services/api/client";
import type { AuthService } from "@/services/auth/auth.service";

const hint = (change = "refresh", audience = "public"): Signal => ({ schemaVersion: 1, eventId: crypto.randomUUID(), type: audience === "public" ? "public.changed" : "feed.changed", audience: audience as Signal["audience"], occurredAt: new Date().toISOString(), data: audience === "public" ? { surface: "feed", change } : { change } });
afterEach(() => vi.useRealTimers());
function setup() {
  vi.useFakeTimers();
  const cache = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } } });
  const stops: (() => void)[] = [];
  const watch = (key: unknown[], fn = vi.fn().mockResolvedValue(["fresh"]), live?: LiveMeta) => {
    cache.setQueryData(key, ["old"]);
    const observer = new QueryObserver(cache, { queryKey: key, queryFn: fn, staleTime: Infinity, meta: { live } });
    stops.push(observer.subscribe(() => {})); return fn;
  };
  let visible = true;
  const live = createSocialReconciler(cache, "u", "i", () => visible);
  return { cache, watch, live, hide: () => { visible = false; }, show: () => { visible = true; }, close: () => { live.dispose(); stops.forEach(stop => stop()); cache.clear(); } };
}

it("coalesces public hints for active public and current-identity surfaces without polling or foreign reads", async () => {
  const s = setup();
  const guest = s.watch(["public-browsing", "comments", "p"]), own = s.watch(["feed-comments", "u", "i", "professional", "p"]), foreign = s.watch(["feed-comments", "u", "other"]), unrelated = s.watch(["notifications", "u", "i"]);
  s.cache.setQueryData(["network", "u", "i"], []);
  const signal = hint(); s.live.receive(signal); s.live.receive(signal); s.live.receive(hint());
  await vi.advanceTimersByTimeAsync(151);
  expect(guest).toHaveBeenCalledOnce(); expect(own).toHaveBeenCalledOnce(); expect(foreign).not.toHaveBeenCalled(); expect(unrelated).not.toHaveBeenCalled();
  expect(s.cache.getQueryState(["network", "u", "i"])?.isInvalidated).toBe(false);
  await vi.advanceTimersByTimeAsync(65000); expect(guest).toHaveBeenCalledOnce(); s.close();
});

it("hides revoked snapshots immediately, including while hidden, and never restores them on read failure", async () => {
  const s = setup(), key = ["public-browsing", "entry", "p"];
  const read = s.watch(key, vi.fn().mockRejectedValue(new Error("offline")));
  s.hide(); s.live.receive(hint("availability"));
  expect(s.cache.getQueryData(key)).toBeUndefined();
  await vi.advanceTimersByTimeAsync(2000); expect(read).not.toHaveBeenCalled();
  s.show(); s.live.resume(); await vi.advanceTimersByTimeAsync(151);
  expect(read).toHaveBeenCalledOnce(); expect(s.cache.getQueryData(key)).toBeUndefined(); s.close();
});

it("private block hints do not touch anonymous projections and pending requests receive a trailing read", async () => {
  const s = setup(), key = ["feed-comments", "u", "i"];
  let resolve!: (value: string[]) => void;
  const read = s.watch(key, vi.fn().mockImplementationOnce(() => new Promise<string[]>(r => { resolve = r; })).mockResolvedValue(["current"]));
  const guest = s.watch(["public-browsing", "feed"]);
  const pending = s.cache.refetchQueries({ queryKey: key });
  s.live.receive(hint("refresh", "identity")); await vi.advanceTimersByTimeAsync(151);
  resolve(["old"]); await pending; await vi.advanceTimersByTimeAsync(151);
  expect(read).toHaveBeenCalledTimes(2); expect(guest).not.toHaveBeenCalled(); s.close();
});

it("does not keep refetching a slow feed after a single hint", async () => {
  const s = setup();
  let resolve!: (value: string[]) => void;
  const read = s.watch(["feed-comments", "u", "i"], vi.fn().mockImplementationOnce(() => new Promise<string[]>(r => { resolve = r; })).mockResolvedValue(["later"]));
  const pending = s.cache.refetchQueries({ queryKey: ["feed-comments", "u", "i"] });
  s.live.receive(hint("refresh", "identity"));
  await vi.advanceTimersByTimeAsync(151);
  await vi.advanceTimersByTimeAsync(65000);
  expect(read).toHaveBeenCalledTimes(1);
  resolve(["old"]);
  await pending;
  await vi.advanceTimersByTimeAsync(151);
  expect(read).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(65000);
  expect(read).toHaveBeenCalledTimes(2);
  s.close();
});
it("refreshes registered feed snapshots once per burst and aborts their reads on workspace disposal", async () => {
  const s = setup(); let request: AbortSignal | undefined;
  const meta = { conceal: vi.fn(), refresh: vi.fn(async (signal: AbortSignal) => { request = signal; }) };
  const fallback = s.watch(["feed", "u", "i"], vi.fn(), meta);
  s.live.receive(hint()); s.live.receive(hint()); await vi.advanceTimersByTimeAsync(151);
  expect(meta.refresh).toHaveBeenCalledOnce(); expect(fallback).not.toHaveBeenCalled();
  s.live.receive(hint("availability")); expect(meta.conceal).toHaveBeenCalledOnce();
  s.live.dispose(); expect(request?.aborted).toBe(true); await vi.advanceTimersByTimeAsync(2000); expect(meta.refresh).toHaveBeenCalledOnce(); s.close();
});

it("keeps loaded order and the older tail, updates counts, removes inaccessible entries and announces new posts/reposts", () => {
  const old: { id: string; likes?: number; repost?: { createdAt: string } }[] = [{ id: "a", likes: 0 }, { id: "b", likes: 0 }, { id: "c", likes: 0 }];
  const result = mergeVisible(old, [{ id: "a", likes: 1 }, { id: "c", likes: 2 }], [{ id: "new", likes: 0 }, { id: "a", likes: 1 }]);
  expect(result).toEqual({ items: [{ id: "a", likes: 1 }, { id: "c", likes: 2 }], pending: true });
  expect(mergeVisible(old, old, old).pending).toBe(false);
  expect(mergeVisible(old, old, [{ id: "a", repost: { createdAt: "now" } }]).pending).toBe(true);
});

it("validates visible-entry refresh before transport and fences stale social responses after account changes", async () => {
  const id = crypto.randomUUID();
  const auth = { me: vi.fn().mockResolvedValue({ user: { id }, selected_identity_id: id, workspaces: [{ id, kind: "professional" }] }) } as unknown as AuthService;
  let resolve!: (value: unknown) => void;
  const http = { get: vi.fn().mockImplementation(() => new Promise(r => { resolve = r; })) } as unknown as HttpClient;
  const service = createHttpFeedService(http, auth), query = { role: "professional", filter: "all", sort: "recent", q: "", limit: 12 } as const;
  await expect(service.feed.refreshEntries!(query, ["invalid"])).rejects.toThrow(); expect(http.get).not.toHaveBeenCalled();
  await expect(service.feed.getEntry("professional", id, { identityId: crypto.randomUUID() })).rejects.toMatchObject({ status: 412 });
  expect(http.get).not.toHaveBeenCalled();
  const pending = service.feed.refreshEntries!(query, [id], { userId: id, identityId: id }); await Promise.resolve(); await Promise.resolve();
  service.reset(); resolve({ data: [] }); await expect(pending).rejects.toMatchObject({ status: 412 });
});
