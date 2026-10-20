"use client";

import { useEffect } from "react";
import { workspaceDialogs } from "@/features/workspace/dialogs";

/** ⌘K / Ctrl+K opens the "Find your way around" dialog anywhere, as in the prototype. */
export function GlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        workspaceDialogs.globalSearch();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
