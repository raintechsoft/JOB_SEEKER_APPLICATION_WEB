import type { Query, QueryClient } from "@tanstack/react-query";
import type { Signal } from "./signal";

const families = new Set(["feed", "feed-entry", "feed-comments", "network", "activity", "feed-saved-count"]);
export type LiveMeta = { refresh: (signal: AbortSignal) => Promise<void>; conceal: () => void };
export function ownsSocialQuery(q: Query, user?: string, identity?: string) {
  return q.queryKey[0] === "public-browsing" && ["feed", "entry", "comments"].includes(String(q.queryKey[1]))
    || !!user && !!identity && families.has(String(q.queryKey[0])) && q.queryKey[1] === user && q.queryKey[2] === identity;
}

/** Only active surfaces read. Inactive snapshots become stale; reconnect never replays content. */
export function createSocialReconciler(cache: QueryClient, user?: string, identity?: string, visible = () => true) {
  const seen = new Set<string>(), dirty = new Set<string>(), running = new Set<string>();
  const controller = new AbortController();
  let disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
  const owns = (q: Query) => ownsSocialQuery(q, user, identity);
  const schedule = () => { if (!timer && !disposed) timer = setTimeout(flush, 150); };
  function flush() {
    timer = undefined;
    if (disposed || !visible()) return;
    for (const hash of [...dirty]) {
      const q = cache.getQueryCache().get(hash);
      if (!q || !owns(q) || !q.isActive()) { dirty.delete(hash); continue; }
      if (running.has(hash)) continue;
      running.add(hash); dirty.delete(hash);
      const fetching = q.state.fetchStatus === "fetching";
      const live = q.meta?.live as LiveMeta | undefined;
      const read = () => live ? live.refresh(controller.signal) : cache.refetchQueries({ predicate: row => row.queryHash === hash, type: "active" }, { cancelRefetch: false });
      // An in-flight observer read can predate this hint; wait for it, then take one trailing snapshot.
      const work = fetching ? cache.refetchQueries({ predicate: row => row.queryHash === hash, type: "active" }, { cancelRefetch: false }).then(() => { if (!disposed) dirty.add(hash); }) : read();
      void work.catch(() => { /* Query/hook keeps a recoverable error state. */ }).finally(() => {
        running.delete(hash);
        if (disposed) return;
        if (dirty.has(hash)) schedule();
      });
    }
  }
  const mark = (availability: boolean, privateOnly = false, network = false) => {
    const matches = cache.getQueryCache().findAll({ predicate: q => owns(q) && (!privateOnly || q.queryKey[0] !== "public-browsing")
      && (availability || network || q.queryKey[0] !== "network")
      && (availability || privateOnly || q.queryKey[0] !== "feed-saved-count") });
    void cache.invalidateQueries({ predicate: q => matches.some(row => row.queryHash === q.queryHash), refetchType: "none" });
    for (const q of matches) {
      if (availability) {
        const live = q.meta?.live as LiveMeta | undefined;
        // Cancel pre-revocation reads before hiding snapshots. Errors never restore these values.
        void cache.cancelQueries({ predicate: row => row.queryHash === q.queryHash }, { silent: true });
        if (live) live.conceal();
        else q.setState({ data: undefined, status: "pending", error: null });
      }
      if (q.isActive()) dirty.add(q.queryHash);
    }
    schedule();
  };
  return {
    receive(signal: Signal) {
      if (disposed || seen.has(signal.eventId)) return;
      seen.add(signal.eventId); if (seen.size > 1024) seen.delete(seen.values().next().value!);
      if (signal.type === "public.changed" && signal.data.surface === "feed") mark(signal.data.change === "availability");
      if (signal.type === "feed.changed") mark(signal.data.change === "availability", true);
      if (signal.type === "network.changed") mark(false, true, true);
      if (signal.type === "job-tracker.changed" || signal.type === "application.changed") mark(false, true, true);
    },
    resume: () => { if (!disposed) mark(false, false, true); },
    dispose: () => { disposed = true; clearTimeout(timer); controller.abort(); dirty.clear(); seen.clear(); },
  };
}

/** Keep loaded order and the tail; new head entries wait behind the explicit New posts action. */
export function mergeVisible<T extends { id: string; repost?: { createdAt: string } | null }>(old: T[], current: T[], head: T[]) {
  const rows = new Map(current.map(row => [row.id, row]));
  const prior = new Map(old.map(row => [row.id, row]));
  return { items: old.flatMap(row => rows.has(row.id) ? [rows.get(row.id)!] : []), pending: head.some(row => !prior.has(row.id) || row.repost?.createdAt !== prior.get(row.id)?.repost?.createdAt) };
}
