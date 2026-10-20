"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes a `<details>` menu on outside click and on Escape (returning focus to its summary),
 * as the prototype did for the employer, account, job-card and message option menus.
 */
export function useDismissableDetails(ref: RefObject<HTMLDetailsElement | null>, options: { closeOnAction?: boolean } = {}) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = ref.current;
      if (!el?.open) return;
      const target = e.target as Element;
      if (!el.contains(target) || (options.closeOnAction && target.closest("button:not(summary), a") && !target.closest("summary"))) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (e.key !== "Escape" || !el?.open) return;
      el.open = false;
      el.querySelector("summary")?.focus();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, options.closeOnAction]);
}
