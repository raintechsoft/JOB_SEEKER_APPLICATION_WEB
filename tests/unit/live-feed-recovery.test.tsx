import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useLiveFeed, useLivePublicFeed } from "@/hooks/use-live-feed";
import type { LiveMeta } from "@/services/realtime/social-reconcile";
import type { FeedPage } from "@/services/feed/feed.service";
import { publicFeedQuerySchema, publicFeedPageSchema } from "@/lib/validation/public-browsing";
import examples from "../../contracts/examples/public-browsing.json";

const mocks = vi.hoisted(() => ({ feed: vi.fn(), refresh: vi.fn() }));
vi.mock("@/hooks/use-services", () => ({ useServices: () => ({ feed: { getFeed: mocks.feed, refreshEntries: mocks.refresh }, publicBrowsing: { feed: mocks.feed, refresh: mocks.refresh } }) }));
vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => true }));
vi.mock("@/features/auth/use-observed-session", () => ({ useObservedSession: () => ({ user: { id: "u", email_verified: true }, selected_identity_id: "i" }) }));
vi.mock("@/services/api/config", () => ({ apiConfig: { dataSource: "http" } }));
const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); vi.resetAllMocks(); });

it.each(["member", "guest"])("retains %s New posts intent when an availability recheck cancels the manual read", async kind => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } } }); clients.push(cache);
  const first = publicFeedPageSchema.parse({ items: [examples.entry], total: 1, nextCursor: null });
  const fresh = publicFeedPageSchema.parse({ ...first, items: [{ ...examples.entry, id: "10000000-0000-4000-8000-000000000099", path: "/feed/10000000-0000-4000-8000-000000000099" }] });
  const data = kind === "guest" ? first : { items: first.items, total: 1, nextCursor: null } as unknown as FeedPage;
  const next = kind === "guest" ? fresh : { items: fresh.items, total: 1, nextCursor: null } as unknown as FeedPage;
  mocks.feed.mockResolvedValue(data); mocks.refresh.mockResolvedValue(first.items);
  const query = publicFeedQuerySchema.parse({});
  const member = { role: "professional", filter: "all", sort: "recent", q: "", limit: 12 } as const;
  const key = kind === "guest" ? ["public-browsing", "feed", query] : ["feed", "u", "i", member.role, member.filter, member.sort, member.q];
  const hook = kind === "guest" ? () => useLivePublicFeed(query) : () => useLiveFeed(member);
  const { result } = renderHook<ReturnType<typeof useLiveFeed> | ReturnType<typeof useLivePublicFeed>, unknown>(hook, { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.data).toBeDefined());
  mocks.feed.mockImplementationOnce((_query, scope) => new Promise((_resolve, reject) => scope.signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError"))))).mockResolvedValue(next);
  let pending!: Promise<unknown>;
  act(() => { pending = result.current.showNewPosts(); });
  await waitFor(() => expect(mocks.feed).toHaveBeenCalledTimes(2));
  const live = cache.getQueryCache().find({ queryKey: key, exact: true })!.meta!.live as LiveMeta;
  await act(async () => { await cache.cancelQueries({ queryKey: key, exact: true }); live.conceal(); await pending; });
  await act(async () => { await live.refresh(new AbortController().signal); });
  await waitFor(() => {
    const current = result.current.data;
    expect(current).toBeDefined();
    expect(current && ("items" in current ? current.items : current.pages[0].items).map(row => row.id)).toEqual([fresh.items[0].id]);
    expect(result.current.newPosts).toBe(false);
  });
});

it("loads the next workspace feed page from the cursor without replacing the first page", async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } } }); clients.push(cache);
  const first = publicFeedPageSchema.parse({ items: [examples.entry], total: 2, nextCursor: "next-page" });
  const second = publicFeedPageSchema.parse({ items: [{ ...examples.entry, id: "10000000-0000-4000-8000-000000000099", path: "/feed/10000000-0000-4000-8000-000000000099", title: "Later post" }], total: 2, nextCursor: null });
  mocks.feed.mockImplementation(async (query: { cursor?: string }) => query.cursor === "next-page" ? { items: second.items, total: 2, nextCursor: null, suggestions: [] } : { items: first.items, total: 2, nextCursor: "next-page", suggestions: [] });
  const member = { role: "professional", filter: "all", sort: "recent", q: "", limit: 12 } as const;
  const { result } = renderHook(() => useLiveFeed(member), { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.data?.items.map(row => row.id)).toEqual([first.items[0].id]));
  await act(async () => { await result.current.fetchNextPage(); });
  await waitFor(() => expect(result.current.data?.items.map(row => row.id)).toEqual([first.items[0].id, second.items[0].id]));
  expect(mocks.feed.mock.calls[1][0]).toMatchObject({ cursor: "next-page", limit: 12 });
});
