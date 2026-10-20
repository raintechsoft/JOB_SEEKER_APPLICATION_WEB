"use client";

import { useEffect, type RefObject } from "react";

/**
 * Spring-animated icon magnification for the workspace navigation (prototype `navigation-dock.js`).
 * Only active for fine pointers ≥768px and when reduced motion is not requested.
 */
export function useNavigationDock(navRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const finePointer = matchMedia("(min-width:768px) and (hover:hover) and (pointer:fine)");
    const reducedMotion = matchMedia("(prefers-reduced-motion:reduce)");
    const enabled = () => finePointer.matches && !reducedMotion.matches;
    const items = [...nav.querySelectorAll<HTMLAnchorElement>(":scope>a")]
      .map((link) => {
        const wrap = link.querySelector<HTMLElement>(":scope>.nav-dock-icon");
        return wrap ? { link, wrap, value: 0, velocity: 0, target: 0 } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    let frame = 0;
    let last = 0;
    const paint = (item: (typeof items)[number]) => {
      item.wrap.style.setProperty("--dock-scale", (1 + Math.min(1, Math.max(0, item.value)) * 0.45).toFixed(4));
      item.wrap.style.setProperty("--dock-emphasis", item.value.toFixed(4));
    };
    const tick = (time: number) => {
      const dt = Math.min((time - last) / 1e3 || 1 / 60, 1 / 60);
      last = time;
      let moving = false;
      for (const item of items) {
        const acceleration = 180 * (item.target - item.value) - 22 * item.velocity;
        item.velocity += acceleration * dt;
        item.value += item.velocity * dt;
        if (Math.abs(item.target - item.value) < 1e-3 && Math.abs(item.velocity) < 5e-3) {
          item.value = item.target;
          item.velocity = 0;
        } else moving = true;
        paint(item);
      }
      if (moving) frame = requestAnimationFrame(tick);
      else {
        frame = 0;
        last = 0;
      }
    };
    const animate = () => {
      if (!frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const reset = (immediate = false) => {
      for (const item of items) {
        item.target = 0;
        if (immediate) {
          item.value = 0;
          item.velocity = 0;
          paint(item);
        }
      }
      if (immediate) {
        cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
      } else animate();
    };
    const point = (x: number) => {
      if (!enabled()) return;
      for (const item of items) {
        const b = item.link.getBoundingClientRect();
        item.target = Math.max(0, 1 - Math.abs(x - b.left - b.width / 2) / 150);
      }
      animate();
    };
    const onMove = (e: PointerEvent) => e.pointerType === "mouse" && point(e.clientX);
    const onLeave = () => reset();
    const onFocusIn = (e: FocusEvent) => {
      const link = (e.target as Element).closest("a");
      if (!enabled() || !link) return;
      const b = link.getBoundingClientRect();
      point(b.left + b.width / 2);
    };
    const onFocusOut = (e: FocusEvent) => !nav.contains(e.relatedTarget as Node) && reset();
    const onScroll = () => reset(true);
    const onImmediate = () => reset(true);
    nav.addEventListener("pointermove", onMove);
    nav.addEventListener("pointerleave", onLeave);
    nav.addEventListener("pointercancel", onLeave);
    nav.addEventListener("focusin", onFocusIn);
    nav.addEventListener("focusout", onFocusOut);
    nav.addEventListener("click", onLeave);
    nav.addEventListener("scroll", onScroll, { passive: true });
    finePointer.addEventListener("change", onImmediate);
    reducedMotion.addEventListener("change", onImmediate);
    window.addEventListener("blur", onImmediate);
    window.addEventListener("resize", onImmediate, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      nav.removeEventListener("pointermove", onMove);
      nav.removeEventListener("pointerleave", onLeave);
      nav.removeEventListener("pointercancel", onLeave);
      nav.removeEventListener("focusin", onFocusIn);
      nav.removeEventListener("focusout", onFocusOut);
      nav.removeEventListener("click", onLeave);
      nav.removeEventListener("scroll", onScroll);
      finePointer.removeEventListener("change", onImmediate);
      reducedMotion.removeEventListener("change", onImmediate);
      window.removeEventListener("blur", onImmediate);
      window.removeEventListener("resize", onImmediate);
    };
  }, [navRef]);
}
