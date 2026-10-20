"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` during server rendering and the hydration render, `true` afterwards (and immediately on
 * client-side navigation). Browser-local data must not render until then, otherwise late-hydrating
 * Suspense boundaries would see cached data that the server HTML did not contain.
 */
export const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
