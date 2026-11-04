"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServices } from "@/hooks/use-services";
import { errorMessage } from "@/services/api/client";
import type { FeedEntry } from "@/services/feed/feed.service";
import type { Role } from "@/types/domain";
import { toast } from "@/stores/toast-store";
import { track } from "@/lib/analytics";
import {useAuthAction} from "@/features/auth/use-auth-action";

type Interaction = "liked" | "reposted";
const feedQueries = { predicate: (query: { queryKey: readonly unknown[] }) => ["feed", "feed-entry", "activity", "recommendations"].includes(String(query.queryKey[0])) && query.queryKey[1] !== "identity" };

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

/**
 * Like/repost toggles update instantly. Clicks made while a save is in flight are coalesced:
 * only the final state is sent once the current request finishes, so rapid like/unlike never
 * waits on the network or on the feed refresh.
 */
export function useFeedInteraction(entry: FeedEntry, role: Role, kind: Interaction) {
  const gate=useAuthAction();
  const services = useServices();
  const client = useQueryClient();
  // What the person last asked for; null once the server agrees with it.
  const [desired, setDesired] = useState<boolean | null>(null);
  const inFlight = useRef(false);
  const queued = useRef<boolean | null>(null);
  const mutation = useMutation({
    mutationKey: ["feed-interaction", role, entry.id, kind],
    mutationFn: (enabled: boolean) => kind === "liked"
      ? services.feed.toggleLike(role, entry.id, enabled)
      : services.feed.setReposted(role, entry.id, enabled),
    onMutate(enabled) {
      void client.cancelQueries(feedQueries);
      client.setQueriesData(feedQueries, data => updateEntry(data, entry.id, kind, enabled));
    },
    onSuccess(enabled) {
      client.setQueriesData(feedQueries, data => updateEntry(data, entry.id, kind, enabled));
      if (kind === "liked") track("post_liked", { postId: entry.id, liked: enabled });
      else toast(enabled ? "Reposted to your feed." : "Repost removed from your feed.");
    },
    onError(error, enabled) {
      client.setQueriesData(feedQueries, data => updateEntry(data, entry.id, kind, !enabled));
      queued.current = null;
      setDesired(null);
      toast(errorMessage(error), "error");
    },
  });
  const send = (value: boolean) => {
    inFlight.current = true;
    mutation.mutate(value, {
      onSettled(_data, error) {
        inFlight.current = false;
        const next = queued.current;
        queued.current = null;
        // A later click changed the mind while this request ran: send only the final state.
        if (!error && next !== null && next !== value) { send(next); return; }
        if (!error) setDesired(null);
        // Refresh counts in the background; the button never waits for it.
        void client.invalidateQueries(feedQueries);
      },
    });
  };
  const enabled = desired ?? (mutation.isPending ? mutation.variables! : !!entry.viewer[kind]);
  return {
    enabled,
    pending: mutation.isPending,
    toggle() {
      const next = !enabled;
      setDesired(next);
      void gate.run(kind==="liked"?"like":"repost",()=>{
        if (inFlight.current) { queued.current = next; return; }
        send(next);
      },{workspace:role,target:{kind:"entry",id:entry.id}}).then((allowed)=>{ if (!allowed) setDesired(null); });
    },
  };
}
