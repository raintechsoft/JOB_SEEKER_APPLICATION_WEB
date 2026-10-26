"use client";

import { useEffect } from "react";
import { workspaceDialogs } from "@/features/workspace/dialogs";

/** Prefer the workspace's people search; retain public navigation search elsewhere. */
export function GlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>("#feed-search-form input");
        if (search && search.getClientRects().length) { search.focus(); search.select(); }
        else workspaceDialogs.globalSearch();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
