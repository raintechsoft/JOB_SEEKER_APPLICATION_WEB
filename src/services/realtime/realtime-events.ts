import { create } from "zustand";

/** Whether the real-time socket is subscribed; polling stops while it is. */
export const useRealtimeStatus = create<{ connected: boolean; set: (connected: boolean) => void }>((set) => ({ connected: false, set: (connected) => set({ connected }) }));

/** True while pushed signals replace polling (for code outside React, such as services). */
export function realtimeConnected(): boolean {
  return useRealtimeStatus.getState().connected;
}

/** Signals the server sends, and the queries (by first key segment) each one makes stale. */
export const REALTIME_INVALIDATIONS: Record<string, string[]> = {
  "conversation.updated": ["messaging", "message-history", "messaging-unread", "notification-counts", "notifications"],
  "notification.updated": ["notification-counts", "notifications"],
  "application.updated": ["application", "applications", "responses", "hiring-summary", "jobs-manager", "candidate", "notification-counts"],
  "export.updated": ["export-status"],
  "media.updated": [],
};

export type RealtimeListener = (data: Record<string, unknown>) => void;
const listeners = new Map<string, Set<RealtimeListener>>();

/** Subscribe to a raw signal outside React Query (the media upload loop waits on `media.updated`). */
export function onRealtime(event: string, listener: RealtimeListener): () => void {
  const set = listeners.get(event) ?? new Set<RealtimeListener>();
  set.add(listener);
  listeners.set(event, set);
  return () => {
    set.delete(listener);
  };
}

/** Deliver a received signal to raw listeners (called by the realtime bridge). */
export function emitRealtime(event: string, data: Record<string, unknown>): void {
  listeners.get(event)?.forEach((listener) => listener(data));
}
