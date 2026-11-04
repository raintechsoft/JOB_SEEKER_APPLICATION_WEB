"use client";
import { useInfiniteQuery, useQueryClient, type QueryKey, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { useObservedSession } from "@/features/auth/use-observed-session";
import { useServices } from "./use-services";
import { useHydrated } from "./use-hydrated";
import { apiConfig } from "@/services/api/config";
import { mergeVisible, type LiveMeta } from "@/services/realtime/social-reconcile";
import type { FeedPage, FeedQuery } from "@/services/feed/feed.service";
import type { PublicFeedQuery } from "@/lib/validation/public-browsing";
import type { PublicBrowsingService } from "@/services/public-browsing/public-browsing.service";
import { PUBLIC_QUERY_OPTIONS } from "@/features/public-browsing/public-routing";

export const FEED_PAGE_SIZE = 12;

type LiveState = { livePending?: boolean; liveHidden?: boolean; liveError?: unknown; liveHeight?: number; liveAcceptHead?: boolean };
type PublicPage = Awaited<ReturnType<PublicBrowsingService["feed"]>>;
type PublicPages = InfiniteData<PublicPage, string | undefined>;
type FeedPages = InfiniteData<FeedPage, string | undefined>;

function liveMeta<T extends object>(cache: QueryClient, key: QueryKey, refresh: (old: T & LiveState, signal: AbortSignal) => Promise<T & LiveState>): LiveMeta {
  return {
    conceal() {
      const height = typeof document === "undefined" ? 0 : document.querySelector('[data-live-feed]')?.getBoundingClientRect().height ?? 0;
      cache.setQueryData<T & LiveState>(key, old => old ? { ...old, liveHidden: true, liveHeight: Math.max(old.liveHidden ? old.liveHeight ?? 0 : 0, height) } : old);
    },
    async refresh(signal) {
      const old = cache.getQueryData<T & LiveState>(key);
      if (!old) { await cache.refetchQueries({ queryKey: key, exact: true, type: "active" }); return; }
      try {
        const next = await refresh(old, signal);
        if (!signal.aborted && cache.getQueryData(key) === old) cache.setQueryData(key, next);
      } catch (error) {
        if (!signal.aborted && cache.getQueryData(key) === old) cache.setQueryData(key, { ...old, liveError: error });
      }
    },
  };
}

export function useLiveFeed(query: Omit<FeedQuery, "cursor">) {
  const services = useServices(), cache = useQueryClient(), session = useObservedSession(), hydrated = useHydrated();
  const real = apiConfig.dataSource === "http", userId = session?.user.id, identityId = session?.selected_identity_id ?? undefined;
  const pageSize = query.limit || FEED_PAGE_SIZE;
  const request = { role: query.role, filter: query.filter, sort: query.sort, q: query.q, limit: pageSize };
  const key = ["feed", real ? userId : "mock", real ? identityId : "mock", query.role, query.filter, query.sort, query.q];
  const meta = liveMeta<FeedPages>(cache, key, async (old, signal) => {
    if (!old.pages) { await cache.refetchQueries({ queryKey: key, exact: true, type: "active" }); return old; }
    const scope = { userId, identityId, signal };
    const ids = [...new Set(old.pages.flatMap(page => page.items.map(row => row.id)))];
    const [head, current] = await Promise.all([
      services.feed.getFeed(request, scope),
      services.feed.refreshEntries!(request, ids, scope),
    ]);
    const merged = mergeVisible(old.pages.flatMap(page => page.items), current, head.items);
    if (old.liveAcceptHead) return { pages: [head], pageParams: [undefined], livePending: false, liveAcceptHead: false, liveHidden: false, liveError: undefined };
    const rows = new Map(merged.items.map(row => [row.id, row]));
    return { ...old, pages: old.pages.map(page => ({ ...page, total: head.total, suggestions: head.suggestions, items: page.items.flatMap(row => rows.has(row.id) ? [rows.get(row.id)!] : []) })), livePending: old.livePending || merged.pending, liveHidden: false, liveError: undefined };
  });
  const feed = useInfiniteQuery({
    queryKey: key, meta: { live: meta }, staleTime: Infinity, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false,
    enabled: hydrated && (!real || !!userId && !!identityId && !!session?.user.email_verified),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => services.feed.getFeed({ ...request, ...(pageParam ? { cursor: pageParam } : {}) }, { userId, identityId, signal }),
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
  const raw = feed.data as (FeedPages & LiveState) | undefined;
  const pages = raw?.liveHidden ? undefined : raw;
  const items = pages ? [...new Map(pages.pages.flatMap(page => page.items).map(entry => [entry.id, entry])).values()] : [];
  const head = pages?.pages[0];
  return {
    ...feed,
    data: pages && head ? { ...head, items, nextCursor: pages.pages.at(-1)?.nextCursor ?? null } : undefined,
    placeholderHeight: raw?.liveHidden ? raw.liveHeight : undefined,
    isError: feed.isError || !!raw?.liveError,
    error: feed.error ?? raw?.liveError,
    newPosts: !!raw?.livePending,
    showNewPosts: async () => {
      await cache.cancelQueries({ queryKey: key, exact: true });
      // Preserve the user's choice if a concurrent permission hint cancels this read.
      cache.setQueryData<FeedPages & LiveState>(key, old => old ? { pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1), liveAcceptHead: true } : old);
      const before = cache.getQueryState(key)?.dataUpdatedAt;
      const result = await feed.refetch();
      const after = cache.getQueryState(key)?.dataUpdatedAt;
      // Only settle when this refetch completed (cancelled reads keep liveAcceptHead for live refresh).
      if (result.status === "success" && after !== before && result.data?.pages[0] && cache.getQueryData<FeedPages & LiveState>(key)?.liveAcceptHead) {
        cache.setQueryData<FeedPages & LiveState>(key, {
          pages: [result.data.pages[0]],
          pageParams: [undefined],
          livePending: false,
          liveAcceptHead: false,
          liveHidden: false,
          liveError: undefined,
        });
      }
      return result;
    },
  };
}

export function useLivePublicFeed(query: PublicFeedQuery) {
  const { publicBrowsing } = useServices(), cache = useQueryClient(), hydrated = useHydrated();
  const key = ["public-browsing", "feed", query];
  const meta = liveMeta<PublicPages>(cache, key, async (old, signal) => {
    const ids = [...new Set(old.pages.flatMap(page => page.items.map(row => row.id)))];
    const [head, current] = await Promise.all([publicBrowsing.feed(query, { signal }), publicBrowsing.refresh(ids, query.filter, { signal })]);
    const merged = mergeVisible(old.pages.flatMap(page => page.items), current, head.items);
    if (old.liveAcceptHead) return { pages: [head], pageParams: [undefined], livePending: false, liveAcceptHead: false, liveHidden: false, liveError: undefined };
    const rows = new Map(merged.items.map(row => [row.id, row]));
    return { ...old, pages: old.pages.map(page => ({ ...page, total: head.total, items: page.items.flatMap(row => rows.has(row.id) ? [rows.get(row.id)!] : []) })), livePending: old.livePending || merged.pending, liveHidden: false, liveError: undefined };
  });
  const feed = useInfiniteQuery({ ...PUBLIC_QUERY_OPTIONS, staleTime: Infinity, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false,
    enabled: hydrated, queryKey: key, meta: { live: meta }, initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => publicBrowsing.feed({ ...query, ...(pageParam ? { cursor: pageParam } : {}) }, { signal }),
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
  const data = feed.data as (PublicPages & LiveState) | undefined;
  return { ...feed, data: data?.liveHidden ? undefined : data, placeholderHeight: data?.liveHidden ? data.liveHeight : undefined, isPending: feed.isPending || !!data?.liveHidden, isError: feed.isError || !!data?.liveError,
    error: feed.error ?? data?.liveError, newPosts: !!data?.livePending,
    showNewPosts: async () => {
      await cache.cancelQueries({ queryKey: key, exact: true });
      cache.setQueryData<PublicPages & LiveState>(key, old => old ? { pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1), liveAcceptHead: true } : old);
      const before = cache.getQueryState(key)?.dataUpdatedAt;
      const result = await feed.refetch();
      const after = cache.getQueryState(key)?.dataUpdatedAt;
      if (result.status === "success" && after !== before && result.data?.pages[0] && cache.getQueryData<PublicPages & LiveState>(key)?.liveAcceptHead) {
        cache.setQueryData<PublicPages & LiveState>(key, {
          pages: [result.data.pages[0]],
          pageParams: [undefined],
          livePending: false,
          liveAcceptHead: false,
          liveHidden: false,
          liveError: undefined,
        });
      }
      return result;
    },
  };
}
