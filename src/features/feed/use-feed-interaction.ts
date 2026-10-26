"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useServices } from "@/hooks/use-services";
import { errorMessage } from "@/services/api/client";
import type { FeedEntry } from "@/services/feed/feed.service";
import type { Role } from "@/types/domain";
import { toast } from "@/stores/toast-store";
import { track } from "@/lib/analytics";

type Interaction = "liked" | "reposted";
const locks = new WeakMap<QueryClient, Set<string>>();
const feedQueries = { predicate: (query: { queryKey: readonly unknown[] }) => ["feed", "feed-entry", "activity", "recommendations"].includes(String(query.queryKey[0])) };

/** Update every copy of this entry without replacing other posts or their pending edits. */
function updateEntry(data: unknown, id: string, kind: Interaction, value: boolean): unknown {
  if (Array.isArray(data)) {
    const next = data.map(item => updateEntry(item, id, kind, value));
    return next.some((item, index) => item !== data[index]) ? next : data;
  }
  if (!data || typeof data !== "object") return data;
  if ("id" in data && data.id === id && "viewer" in data && "comments" in data) {
    const entry = data as FeedEntry;
    return { ...entry, viewer: { ...entry.viewer, [kind]: value } };
  }
  if (Object.getPrototypeOf(data) !== Object.prototype) return data;
  let changed = false;
  const next = Object.entries(data).map(([key, item]) => {
    const updated = updateEntry(item, id, kind, value);
    changed ||= updated !== item;
    return [key, updated];
  });
  return changed ? Object.fromEntries(next) : data;
}

export function useFeedInteraction(entry: FeedEntry, role: Role, kind: Interaction) {
  const services = useServices();
  const client = useQueryClient();
  const key = `${role}:${entry.id}:${kind}`;
  const mutation = useMutation({
    mutationKey: ["feed-interaction", role, entry.id, kind],
    mutationFn: (enabled: boolean) => kind === "liked"
      ? services.feed.toggleLike(role, entry.id, enabled)
      : services.feed.setReposted(role, entry.id, enabled),
    async onMutate(enabled) {
      await client.cancelQueries(feedQueries);
      client.setQueriesData(feedQueries, data => updateEntry(data, entry.id, kind, enabled));
    },
    onSuccess(enabled) {
      client.setQueriesData(feedQueries, data => updateEntry(data, entry.id, kind, enabled));
      if (kind === "liked") track("post_liked", { postId: entry.id, liked: enabled });
      else toast(enabled ? "Reposted to your feed." : "Repost removed from your feed.");
    },
    onError(error, enabled) {
      client.setQueriesData(feedQueries, data => updateEntry(data, entry.id, kind, !enabled));
      toast(errorMessage(error), "error");
    },
    async onSettled() {
      try { await client.invalidateQueries(feedQueries); }
      finally { locks.get(client)?.delete(key); }
    },
  });
  return {
    enabled: mutation.isPending ? mutation.variables! : !!entry.viewer[kind],
    pending: mutation.isPending,
    toggle() {
      const active = locks.get(client) ?? new Set<string>();
      if (active.has(key)) return;
      locks.set(client, active);
      active.add(key);
      mutation.mutate(!entry.viewer[kind]);
    },
  };
}
