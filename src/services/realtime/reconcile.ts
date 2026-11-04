import type { Query, QueryClient } from "@tanstack/react-query";
import { applyReceiptToMessages } from "@/services/messaging/message-status";
import type { ConversationView, Inbox } from "@/services/messaging/messaging.service";
import type { Signal } from "./signal";

export const communicationFamilies = new Set(["messaging", "message-history", "messaging-unread", "notification-counts", "notifications"]);
export function ownsCommunicationQuery(query: Query, user: string, identity: string) {
  return communicationFamilies.has(String(query.queryKey[0])) && query.queryKey[1] === user && query.queryKey[2] === identity;
}

/** Event bursts collapse per query; a hint received during a fetch always gets a trailing read. */
export function createReconciler(cache: QueryClient, user: string, identity: string, visible = () => true) {
  const seen = new Set<string>(), dirty = new Set<string>(), running = new Set<string>();
  let disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
  const owns = (q: Query) => ownsCommunicationQuery(q, user, identity);
  const schedule = () => { if (!timer && !disposed) timer = setTimeout(flush, 100); };
  function flush() {
    timer = undefined;
    if (disposed || !visible()) return;
    for (const hash of [...dirty]) {
      const query = cache.getQueryCache().get(hash);
      if (!query || !owns(query) || !query.isActive()) { dirty.delete(hash); continue; }
      if (running.has(hash)) continue;
      dirty.delete(hash); running.add(hash);
      // If a pre-event request is already in flight, its response may predate the event.
      const wasFetching = query.state.fetchStatus === "fetching";
      void cache.refetchQueries({ predicate: q => q.queryHash === hash, type: "active" }, { cancelRefetch: false }).finally(() => {
        running.delete(hash);
        if (disposed) return;
        if (wasFetching) dirty.add(hash);
        if (dirty.has(hash)) schedule();
      });
    }
  }
  const mark = (matches: (q: Query) => boolean) => {
    for (const q of cache.getQueryCache().findAll({ predicate: q => owns(q) && matches(q) })) {
      q.invalidate();
      if (q.isActive()) dirty.add(q.queryHash);
    }
    schedule();
  };
  return {
    receive(signal: Signal) {
      if (disposed || seen.has(signal.eventId)) return;
      seen.add(signal.eventId); if (seen.size > 1024) seen.delete(seen.values().next().value!);
      if (signal.type === "notifications.changed") mark(q => ["notifications", "notification-counts"].includes(String(q.queryKey[0])));
      if (signal.type === "messaging.changed") mark(() => true);
      if (signal.type === "conversation.updated") mark(q => ["messaging", "messaging-unread"].includes(String(q.queryKey[0])) || q.queryKey[0] === "message-history" && q.queryKey[4] === signal.data.conversationId);
      if (signal.type === "conversation.receipt") {
        const kind = signal.data.kind;
        const through = Number(signal.data.throughSequence);
        if ((kind !== "delivered" && kind !== "seen") || !Number.isInteger(through) || through < 0) return;
        const conversationId = signal.data.conversationId;
        const patchView = (view: ConversationView): ConversationView => ({
          ...view,
          messages: applyReceiptToMessages(view.messages, kind, through),
          peerDeliveredSequence: kind === "delivered" ? Math.max(view.peerDeliveredSequence ?? 0, through) : view.peerDeliveredSequence,
          peerReadSequence: kind === "seen" ? Math.max(view.peerReadSequence ?? 0, through) : view.peerReadSequence,
        });
        for (const q of cache.getQueryCache().findAll({ predicate: q => owns(q) && q.queryKey[0] === "message-history" && q.queryKey[4] === conversationId })) {
          cache.setQueryData(q.queryKey, (current: ConversationView | undefined) => current ? patchView(current) : current);
        }
        for (const q of cache.getQueryCache().findAll({ predicate: q => owns(q) && q.queryKey[0] === "messaging" })) {
          cache.setQueryData(q.queryKey, (current: Inbox | undefined) => current ? {
            ...current,
            selected: current.selected?.id === conversationId ? patchView(current.selected) : current.selected,
            threads: current.threads.map(thread => thread.id !== conversationId || !thread.lastMessage ? thread : { ...thread, lastMessage: applyReceiptToMessages([thread.lastMessage], kind, through)[0] }),
          } : current);
        }
      }
    },
    resume: () => { if (!disposed) mark(() => true); },
    dispose: () => { disposed = true; clearTimeout(timer); dirty.clear(); seen.clear(); },
  };
}
