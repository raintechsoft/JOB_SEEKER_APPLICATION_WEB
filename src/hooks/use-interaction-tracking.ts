"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { recordInteraction, registerDwellCollector } from "@/lib/interactions/tracker";
import { INTERACTION_RULES, type InteractionKind } from "@/lib/validation/interactions";

export interface TrackedItem {
  kind: InteractionKind;
  id: string;
}

export interface TrackingContext {
  surface?: string;
  position?: number;
  requestId?: string;
}

/** Shorter stays are scrolling past, not reading. */
export const MIN_DWELL_MS = 1000;

/**
 * Watch history for one card: a view once at least half of it is on screen, dwell time while it stays half
 * visible in a foreground tab, and a click handler. Dwell is reported when the card leaves view, unmounts or
 * the page is left.
 */
export function useInteractionTracking<T extends Element>(item: TrackedItem | null, context: TrackingContext = {}) {
  const ref = useRef<T>(null);
  const latest = useRef({ item, context });
  useLayoutEffect(() => {
    latest.current = { item, context };
  });
  const key = item ? `${item.kind}:${item.id}` : null;

  useEffect(() => {
    const el = ref.current;
    const tracked = latest.current.item;
    if (!el || !tracked || typeof IntersectionObserver === "undefined") return;
    const dwells = (INTERACTION_RULES.actionKinds.dwell as string[]).includes(tracked.kind);
    let intersecting = false, since: number | null = null, total = 0;
    const foreground = () => typeof document === "undefined" || document.visibilityState !== "hidden";
    const pause = () => { if (since !== null) { total += Date.now() - since; since = null; } };
    const report = () => {
      pause();
      if (dwells && total >= MIN_DWELL_MS) recordInteraction({ action: "dwell", itemKind: tracked.kind, itemId: tracked.id, ...latest.current.context, dwellMs: Math.min(total, INTERACTION_RULES.dwellMsMax) });
      total = 0;
      if (intersecting && foreground()) since = Date.now();
    };
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5);
      if (visible && !intersecting) {
        recordInteraction({ action: "view", itemKind: tracked.kind, itemId: tracked.id, ...latest.current.context });
        if (foreground()) since = Date.now();
      } else if (!visible && intersecting) {
        intersecting = false;
        report();
      }
      intersecting = visible;
    }, { threshold: 0.5 });
    const onVisibility = () => { if (foreground() && intersecting && since === null) since = Date.now(); else if (!foreground()) pause(); };
    observer.observe(el);
    document.addEventListener("visibilitychange", onVisibility);
    const unregister = registerDwellCollector(report);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      unregister();
      intersecting = false;
      report();
    };
  }, [key]);

  const click = useCallback(() => {
    const { item: current, context: ctx } = latest.current;
    if (current) recordInteraction({ action: "click", itemKind: current.kind, itemId: current.id, ...ctx });
  }, []);

  return { ref, click };
}
