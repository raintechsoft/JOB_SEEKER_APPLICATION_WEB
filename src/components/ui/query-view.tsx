"use client";

import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ScreenError, ScreenFallback } from "./feedback";

/**
 * Renders loading, error and success states for a service query. Loading and error states are
 * shared so that swapping the mock for the HTTP API needs no screen changes.
 */
export function QueryView<T>({ query, children, fallback }: { query: UseQueryResult<T>; children: (data: T) => ReactNode; fallback?: ReactNode }) {
  if (query.isPending) return <>{fallback ?? <ScreenFallback />}</>;
  if (query.isError || query.data === undefined) return <ScreenError onRetry={() => query.refetch()} />;
  return <>{children(query.data)}</>;
}
