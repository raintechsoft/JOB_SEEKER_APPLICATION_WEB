"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServices } from "@/hooks/use-services";
import { apiConfig } from "@/services/api/config";

/** Reconciles active documents and cached navigation that may skip the server bridge. */
export function RecoveryNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  const { auth } = useServices();
  const cache = useQueryClient();
  const { mutate, isPending, isError, variables } = useMutation({
    mutationFn: (screen: "code" | "password" | "other") => auth.recoveryNavigation(screen),
    onMutate: async (screen) => {
      // Refreshing the password step must not clear its still-valid server deadline.
      if (screen === "password") return;
      await cache.cancelQueries({ queryKey: ["auth", "recovery"], exact: true });
      cache.setQueryData(["auth", "recovery"], { step: "email", expires_at: null });
    },
    retry: false,
  });

  useEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (apiConfig.dataSource !== "http" || (document as Document & { prerendering?: boolean }).prerendering) return;
    // A cached/prerendered document can activate without running the server bridge.
    // Reconcile its actual destination even when there is no previous React route.
    if (from === null) {
      mutate(pathname === "/reset-password" ? "password" : pathname === "/forgot-password" ? "code" : "other");
      return;
    }
    if (from === pathname) return;
    if (from !== "/forgot-password" && from !== "/reset-password") return;
    if (from === "/forgot-password" && pathname === "/reset-password") return;
    mutate(pathname === "/forgot-password" ? "code" : "other");
  }, [pathname, mutate]);

  useEffect(() => {
    if (apiConfig.dataSource !== "http" || !(document as Document & { prerendering?: boolean }).prerendering) return;
    const activated = () => mutate(pathname === "/reset-password" ? "password" : pathname === "/forgot-password" ? "code" : "other");
    // Speculative rendering is not departure. Wait until the browser displays it.
    document.addEventListener("prerenderingchange", activated, { once: true });
    return () => document.removeEventListener("prerenderingchange", activated);
  }, [pathname, mutate]);

  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted && apiConfig.dataSource === "http") mutate("other");
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, [mutate]);

  // Ordinary destinations stay visible while cleanup runs. Only the recovery
  // forms wait for confirmation, so a fast return cannot reuse cached permission.
  const recoveryPage = pathname === "/forgot-password" || pathname === "/reset-password";
  if (recoveryPage && isPending) return null;
  if (recoveryPage && isError) return <div className="stack"><p className="notice" role="alert">Your recovery request could not be confirmed. Please try again.</p><button className="btn primary" onClick={() => mutate(variables ?? "other")}>Retry</button></div>;
  return children;
}
