"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { useServiceQuery, useServices } from "@/hooks/use-services";
import { apiConfig } from "@/services/api/config";

/** Whether the real-time socket is subscribed; polling slows to a fallback interval while it is. */
export const useRealtimeStatus = create<{ connected: boolean; set: (connected: boolean) => void }>((set) => ({ connected: false, set: (connected) => set({ connected }) }));

/** Poll interval for live data: frequent without a socket, a slow safety net with one. */
export function useLiveInterval(base: number) {
  const connected = useRealtimeStatus((s) => s.connected);
  return connected ? Math.max(base, 60_000) : base;
}

const config = {
  enabled: process.env.NEXT_PUBLIC_REALTIME_ENABLED === "true",
  key: process.env.NEXT_PUBLIC_REALTIME_KEY ?? "",
  host: process.env.NEXT_PUBLIC_REALTIME_HOST ?? "",
  port: Number(process.env.NEXT_PUBLIC_REALTIME_PORT ?? 443),
  scheme: process.env.NEXT_PUBLIC_REALTIME_SCHEME ?? "https",
};

/**
 * Listens on the signed-in user's private identity channel. Signals carry only ids; each one just
 * refetches the affected queries through the REST API, which applies every access rule again.
 */
export function RealtimeBridge() {
  const services = useServices();
  const cache = useQueryClient();
  const setConnected = useRealtimeStatus((s) => s.set);
  const active = apiConfig.dataSource === "http" && config.enabled && !!config.key && !!config.host;
  const session = useServiceQuery(["auth", "session"], (s) => s.auth.me(), { enabled: active });
  const identity = session.data?.selected_identity_id;

  useEffect(() => {
    if (!active || !identity || !services.messaging.authorizeRealtime) return;
    const authorize = services.messaging.authorizeRealtime;
    let disposed = false;
    let disconnect = () => {};
    void import("pusher-js").then(({ default: Pusher }) => {
      if (disposed) return;
      const tls = config.scheme === "https";
      const client = new Pusher(config.key, {
        cluster: "",
        wsHost: config.host,
        wsPort: config.port,
        wssPort: config.port,
        forceTLS: tls,
        enabledTransports: tls ? ["wss"] : ["ws"],
        disableStats: true,
        channelAuthorization: {
          endpoint: "",
          transport: "ajax",
          customHandler: ({ socketId, channelName }, callback) => {
            authorize(socketId, channelName).then((auth) => callback(null, { auth }), (error: Error) => callback(error, null));
          },
        },
      });
      const channel = client.subscribe("private-identity." + identity);
      channel.bind("pusher:subscription_succeeded", () => setConnected(true));
      channel.bind("pusher:subscription_error", () => setConnected(false));
      client.connection.bind("state_change", ({ current }: { current: string }) => {
        if (current !== "connected") setConnected(false);
      });
      channel.bind("conversation.updated", () => {
        void cache.invalidateQueries({ predicate: (q) => ["messaging", "message-history", "messaging-unread", "notification-counts", "notifications"].includes(String(q.queryKey[0])) });
      });
      disconnect = () => {
        setConnected(false);
        client.unsubscribe("private-identity." + identity);
        client.disconnect();
      };
    });
    return () => {
      disposed = true;
      disconnect();
    };
  }, [active, identity, services.messaging.authorizeRealtime, cache, setConnected]);

  return null;
}
