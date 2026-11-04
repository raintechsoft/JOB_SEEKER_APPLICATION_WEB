import Pusher from "pusher-js";
import { ApiError } from "../api/client";
import { parseSignal, type Signal } from "./signal";

export type ConnectionState = "connecting" | "connected" | "paused" | "disabled";
export const realtimeConfig = {
  enabled: process.env.NEXT_PUBLIC_REALTIME_ENABLED === "true",
  key: process.env.NEXT_PUBLIC_REALTIME_KEY ?? "",
  host: process.env.NEXT_PUBLIC_REALTIME_HOST ?? "",
  port: Number(process.env.NEXT_PUBLIC_REALTIME_PORT ?? 443),
  scheme: process.env.NEXT_PUBLIC_REALTIME_SCHEME ?? "https",
};
type Options = {
  identityId?: string;
  accountId?: string;
  authorizeAccount?: (socketId: string) => Promise<string>;
  portfolioChannel?: string;
  authorizePortfolio?: (socketId: string) => Promise<string>;
  portfolioDenied?: () => void;
  publicFeed?: boolean;
  authorize: (socketId: string) => Promise<string>;
  changed: (signal: Signal) => void;
  ready: () => void;
  denied: () => void;
  state: (state: ConnectionState) => void;
};

/** One WebSocket only. Retries are bounded; there is no HTTP transport or data-polling fallback. */
export function connectRealtime(options: Options, config = realtimeConfig) {
  let disposed = false, generation = 0, attempts = 0;
  let client: Pusher | undefined, timer: ReturnType<typeof setTimeout> | undefined, stable: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    generation++; clearTimeout(timer); clearTimeout(stable);
    const previous = client; client = undefined;
    previous?.unbind_all(); previous?.connection.unbind_all(); previous?.disconnect();
  };
  const enabled = config.enabled && !!config.key && !!config.host && Number.isInteger(config.port) && config.port > 0 && config.port <= 65535;
  const retry = (delay = 0) => {
    stop();
    if (disposed) return;
    if (attempts >= 6) { options.state("paused"); return; }
    options.state("connecting");
    const wait = Math.max(delay, Math.min(30000, 500 * 2 ** attempts) * (0.8 + Math.random() * 0.4));
    attempts++;
    timer = setTimeout(start, wait);
  };
  function start() {
    stop();
    if (disposed) return;
    if (!enabled) { options.state("disabled"); return; }
    if (typeof navigator !== "undefined" && !navigator.onLine) { options.state("paused"); return; }
    const version = generation, current = () => !disposed && generation === version;
    options.state("connecting");
    const tls = config.scheme === "https";
    client = new Pusher(config.key, {
      cluster: "", wsHost: config.host, wsPort: config.port, wssPort: config.port, forceTLS: tls,
      enabledTransports: tls ? ["wss"] : ["ws"], disableStats: true,
      channelAuthorization: { endpoint: "", transport: "ajax", customHandler: ({ socketId, channelName }, callback) => {
        if (!current()) return;
        const authorize = channelName === `private-identity.${options.identityId}` ? options.authorize : channelName === `private-account.${options.accountId}` ? options.authorizeAccount : channelName === options.portfolioChannel ? options.authorizePortfolio : undefined;
        if (!authorize) { callback(new Error("Unauthorized channel"), null); return; }
        void authorize(socketId).then(auth => { if (current()) callback(null, { auth }); }, error => {
          if (!current()) return;
          if (error instanceof ApiError && [401, 403, 404, 412, 419].includes(error.status)) {
            stop(); options.state("paused"); if(channelName===options.portfolioChannel)options.portfolioDenied?.();else options.denied();
          } else retry(error instanceof ApiError ? (error.retryAfterSeconds ?? 0) * 1000 : 0);
        });
      } },
    });
    const channels = [...(options.identityId ? [[`private-identity.${options.identityId}`, "identity"] as const] : []), ...(options.accountId ? [[`private-account.${options.accountId}`, "account"] as const] : []), ...(options.portfolioChannel ? [[options.portfolioChannel, "portfolio"] as const] : []), ...(options.publicFeed ? [["public-feed.v1", "public"] as const] : [])];
    const subscribed = new Set<string>();
    for (const [name, audience] of channels) {
    const channel = client.subscribe(name);
    channel.bind("pusher:subscription_succeeded", () => {
      if (!current()) return;
      subscribed.add(name);
      if (subscribed.size !== channels.length) return;
      clearTimeout(timer); options.state("connected"); options.ready();
      stable = setTimeout(() => { attempts = 0; }, 30000);
    });
    channel.bind("pusher:subscription_error", () => { if (current()) retry(); });
    channel.bind("skillora.changed.v1", (value: unknown) => {
      if (!current()) return;
      const signal = parseSignal(value, audience);
      if (signal) options.changed(signal);
    });
    }
    client.connection.bind("state_change", ({ current: state, previous }: { current: string; previous: string }) => {
      if (current() && (["disconnected", "unavailable", "failed"].includes(state) || state === "connecting" && previous === "connected")) retry();
    });
    // Bound a stalled connection/authorization attempt, including server-side lease closure.
    timer = setTimeout(() => { if (current()) retry(); }, 20000);
  }
  start();
  return { retry: () => { attempts = 0; start(); }, close: () => { disposed = true; stop(); } };
}
