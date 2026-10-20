"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Fires once when at least half of the element has been visible, so analytics impressions reflect
 * what people actually saw rather than everything an API returned.
 */
export function useImpression<T extends Element>(onImpression: () => void) {
  const ref = useRef<T>(null);
  const callback = useRef(onImpression);
  useLayoutEffect(() => {
    callback.current = onImpression;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) {
          observer.disconnect();
          callback.current();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}
