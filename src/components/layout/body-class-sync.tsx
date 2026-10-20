"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { bodyClassesFor, MANAGED_BODY_CLASSES } from "@/lib/routing/body-classes";

/** Keeps route-dependent body classes in sync on client-side navigation (before paint). */
export function BodyClassSync() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const wanted = bodyClassesFor(pathname);
    for (const c of MANAGED_BODY_CLASSES) document.body.classList.toggle(c, wanted.includes(c));
  }, [pathname]);
  // Marks the document as interactive (used by end-to-end tests to avoid clicking before hydration).
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}
