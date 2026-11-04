"use client";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useObservedSession } from "@/features/auth/use-observed-session";
import { clearIdentityState } from "@/features/auth/clear-identity-state";
import { useServices } from "@/hooks/use-services";
import { apiConfig } from "@/services/api/config";
import { ApiError } from "@/services/api/client";
import { createReconciler, ownsCommunicationQuery } from "@/services/realtime/reconcile";
import { createSocialReconciler, ownsSocialQuery } from "@/services/realtime/social-reconcile";
import { createHiringReconciler, ownsHiringQuery } from "@/services/realtime/hiring-reconcile";
import type { ConnectionState } from "@/services/realtime/transport";
import { createWorkspaceReconciler, ownsWorkspaceQuery } from "@/services/realtime/workspace-reconcile";

const RealtimeContext = createContext<{ state: ConnectionState; retry: () => void }>({ state: "disabled", retry: () => {} });
const emptySubscription = () => () => {};
const emptySnapshot = () => undefined;
export const useRealtime = () => useContext(RealtimeContext);

/** Mounted once above shells and dialogs; observing a guest page never starts a session probe. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const session = useObservedSession(), services = useServices(), cache = useQueryClient(), router = useRouter();
  const [state, setState] = useState<ConnectionState>("disabled");
  const retry = useRef<() => void>(() => {});
  const admin = usePathname().startsWith("/admin");
  const portfolioToken = useSyncExternalStore(services.realtime?.hub.subscribePortfolio ?? emptySubscription, services.realtime?.hub.portfolioSnapshot ?? emptySnapshot, emptySnapshot);
  const user = session?.user.id, identity = session?.user.email_verified ? session.selected_identity_id : null;
  useEffect(() => {
    if (apiConfig.dataSource !== "http" || !services.realtime) return;
    let disposed = false, checking = false;
    let connection: { close: () => void; retry: () => void } | undefined;
    const visible = () => document.visibilityState === "visible" && navigator.onLine;
    const reconcile = createReconciler(cache, user ?? "", identity ?? "", visible);
    const social = createSocialReconciler(cache, user, identity ?? undefined, visible);
    const hiring = createHiringReconciler(cache, user, identity ?? undefined, visible);
    const workspace = createWorkspaceReconciler(cache, user, identity ?? undefined, visible);
    const resumeAll = () => { reconcile.resume(); social.resume(); hiring.resume(); workspace.resume(); services.realtime!.hub.emit({type:"resume"}); };
    const ownsPrivate = (q: Parameters<typeof ownsSocialQuery>[0]) => !!user && (ownsWorkspaceQuery(q,user,identity ?? undefined) || !!identity && (ownsHiringQuery(q, user, identity) || ownsCommunicationQuery(q, user, identity) || q.queryKey[0] !== "public-browsing" && ownsSocialQuery(q, user, identity)));
    const denied = async () => {
      if (checking || disposed) return;
      checking = true;
      services.realtime!.hub.emit({type:"context-ended"});
      // Clear private communication snapshots immediately, even if the following probe cannot complete.
      await cache.cancelQueries({ predicate: ownsPrivate });
      if (disposed) return;
      cache.removeQueries({ predicate: ownsPrivate });
      try {
        const next = await services.auth.refreshSession!();
        if (disposed) return;
        if (next.user.id !== user || next.selected_identity_id !== identity || !next.user.email_verified) {
          clearIdentityState(); cache.clear(); cache.setQueryData(["auth", "session"], next);
        }
      } catch (error) {
        if (!disposed && error instanceof ApiError && [401,403,419].includes(error.status)) {
          clearIdentityState(); cache.clear(); cache.setQueryData(["auth", "session"], null); router.replace("/login");
        }
      } finally { checking = false; }
    };
    void import("@/services/realtime/transport").then(async ({ connectRealtime, realtimeConfig }) => {
      const share = realtimeConfig.enabled && portfolioToken ? await services.realtime!.portfolio(portfolioToken) : undefined;
      if (disposed) return;
      connection = connectRealtime({ identityId: identity ?? undefined, publicFeed: true,
        portfolioChannel: share?.channel,
        authorizePortfolio: async socket => {
          const grant = await services.realtime!.portfolio(portfolioToken!, socket);
          if (grant.channel !== share?.channel || !grant.auth) throw new ApiError("Shared portfolio access changed.", 403);
          return grant.auth;
        },
        portfolioDenied: () => workspace.conceal(),
        accountId: admin ? user : undefined,
        authorizeAccount: socket => services.realtime!.authorizeAccount(socket, user!),
        authorize: socket => services.realtime!.authorize(socket, identity!, user!),
        changed: signal => { if (signal.type === "access.changed") { connection?.close(); setState("paused"); void denied(); } else { reconcile.receive(signal); social.receive(signal); hiring.receive(signal); workspace.receive(signal); services.realtime!.hub.emit(signal); } },
        ready: resumeAll, denied: () => void denied(), state: setState,
      });
      retry.current = () => { resumeAll(); connection?.retry(); };
    }).catch(() => { if (!disposed) { setState("paused"); workspace.resume(); } });
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    const resume = () => { if (visible()) { clearTimeout(resumeTimer); resumeTimer = setTimeout(resumeAll, 200); } };
    const online = () => { resume(); connection?.retry(); };
    window.addEventListener("focus", resume); window.addEventListener("pageshow", resume); window.addEventListener("online", online);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true; retry.current = () => {}; clearTimeout(resumeTimer); connection?.close(); reconcile.dispose(); social.dispose(); hiring.dispose(); workspace.dispose();
      void cache.cancelQueries({ predicate: ownsPrivate });
      window.removeEventListener("focus", resume); window.removeEventListener("pageshow", resume); window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [user, identity, admin, portfolioToken, services, cache, router]);
  return <RealtimeContext.Provider value={{ state, retry: () => retry.current() }}>{children}</RealtimeContext.Provider>;
}

