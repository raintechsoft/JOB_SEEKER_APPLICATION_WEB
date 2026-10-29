"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServiceQuery, useServices } from "@/hooks/use-services";
import { apiConfig } from "@/services/api/config";
import { REALTIME_INVALIDATIONS, emitRealtime, useRealtimeStatus } from "@/services/realtime/realtime-events";

export { useRealtimeStatus };

/** Poll interval for live data: `base` without a socket, none while the socket pushes changes. */
export function useLiveInterval(base: number): number | false {
  const connected = useRealtimeStatus((s) => s.connected);
  return connected ? false : base;
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
    const invalidate = (keys: string[]) => {
      if (keys.length) void cache.invalidateQueries({ predicate: (q) => keys.includes(String(q.queryKey[0])) });
    };
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
      channel.bind("pusher:subscription_succeeded", () => {
        setConnected(true);
        // Polling is off while connected, so catch up on anything missed before (re)subscribing.
        invalidate([...new Set(Object.values(REALTIME_INVALIDATIONS).flat())]);
      });
      channel.bind("pusher:subscription_error", () => setConnected(false));
      client.connection.bind("state_change", ({ current }: { current: string }) => {
        if (current !== "connected") setConnected(false);
      });
      for (const [event, keys] of Object.entries(REALTIME_INVALIDATIONS)) {
        channel.bind(event, (data: Record<string, unknown> | undefined) => {
          invalidate(keys);
          emitRealtime(event, data ?? {});
        });
      }
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
