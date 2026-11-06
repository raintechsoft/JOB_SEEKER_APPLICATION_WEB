"use client";

import { useState } from "react";

/**
 * Keeps every item that has been shown since `resetKey` last changed. Fresh data updates items in
 * place and appends new ones; items the next fetch no longer returns stay where they were.
 *
 * Suggestion lists ("people you may know", talent discovery) exclude people the viewer already
 * follows, so a refetch right after Follow would make the card vanish under the user's cursor. With
 * retention the card stays, showing "Following", until the list is loaded fresh (new key or mount).
 */
export function useRetainedList<T extends { id: string }>(items: T[], resetKey: string): T[] {
  const [state, setState] = useState({ key: resetKey, list: items });
  let next = state;
  if (state.key !== resetKey) {
    next = { key: resetKey, list: items };
  } else {
    const fresh = new Map(items.map((item) => [item.id, item]));
    const merged = state.list.map((item) => fresh.get(item.id) ?? item);
    const seen = new Set(merged.map((item) => item.id));
    for (const item of items) if (!seen.has(item.id)) merged.push(item);
    const changed = merged.length !== state.list.length || merged.some((item, index) => item !== state.list[index]);
    if (changed) next = { key: resetKey, list: merged };
  }
  // Derived state reconciled during render (no effect), as React recommends for prop-driven state.
  if (next !== state) setState(next);
  return next.list;
}
