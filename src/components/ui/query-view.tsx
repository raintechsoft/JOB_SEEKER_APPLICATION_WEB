"use client";

import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ScreenError } from "./feedback";
import { ApiError } from "@/services/api/client";
import { ContentSkeleton, FeedSkeleton, type SkeletonLayout } from "./skeleton";

/** For progressively rendered sections whose static controls already sit outside. */
export function QueryFeedback({ data, error, retry, layout = "list", label, cause, compact }: { data: unknown; error?: boolean; retry?: () => unknown; layout?: SkeletonLayout | "feed"; label?: string; cause?: unknown; compact?: boolean }) {
  if (data !== undefined) return null;
  if (error) return <ScreenError error={cause} compact={compact} onRetry={retry ? () => retry() : undefined} />;
  return layout === "feed" ? <FeedSkeleton /> : <ContentSkeleton layout={layout} label={label} />;
}

/**
 * Renders loading, error and success states for a service query. Loading and error states are
 * shared so that swapping the mock for the HTTP API needs no screen changes.
 */
export function QueryView<T>({ query, children, fallback }: { query: UseQueryResult<T>; children: (data: T) => ReactNode; fallback: ReactNode }) {
  const denied = query.error instanceof ApiError && [401, 403, 404, 409, 412, 419].includes(query.error.status);
  if (denied || (query.data === undefined && query.isError)) return <ScreenError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data === undefined) {
    return <>{fallback}</>;
  }
  return <>{query.isError && <p role="status" className="state-inline-note">Couldn’t refresh. Showing the last loaded content. <button type="button" className="link" onClick={() => void query.refetch()}>Try again</button></p>}{children(query.data)}</>;
}
