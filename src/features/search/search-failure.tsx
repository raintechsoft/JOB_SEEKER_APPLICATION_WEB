"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/services/api/client";
import { Button, LinkButton } from "@/components/ui/primitives";
import { StatePanel } from "@/components/ui/state-panel";
import { ErrorState } from "@/components/ui/state-views";

const signInHref = () => typeof window === "undefined" ? "/login" : `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;

/** Search-specific failure copy on the shared state panel; keeps its own rate-limit countdown. */
export function SearchFailure({ error, retry, compact = false }: { error: unknown; retry: () => void; compact?: boolean }) {
  const status = error instanceof ApiError ? error.status : 0;
  const initialSeconds = status === 429 ? error instanceof ApiError ? error.retryAfterSeconds ?? 60 : 60 : 0;
  const [cooldown, setCooldown] = useState({ source: error, remaining: initialSeconds });
  if (cooldown.source !== error) setCooldown({ source: error, remaining: initialSeconds });
  const remaining = cooldown.remaining;
  useEffect(() => { if (remaining <= 0) return; const timer = setTimeout(() => setCooldown(value => ({ ...value, remaining: Math.max(0,value.remaining-1) })), 1000); return () => clearTimeout(timer); }, [remaining, error]);
  if ([401, 419].includes(status)) return <StatePanel compact={compact} role="alert" icon="logIn" tone="info" title="Sign in to search" description="Your session expired. Sign in again to search." actions={<LinkButton variant="primary" icon="logIn" href={signInHref()}>Sign in</LinkButton>} />;
  if ([403, 412].includes(status)) return <StatePanel compact={compact} role="alert" icon="lock" tone="warning" title="Search isn’t available here" description="This search is unavailable in your current workspace. Reload the page to refresh your workspace." actions={<Button icon="refresh" onClick={() => window.location.reload()}>Reload page</Button>} />;
  if (status === 422) return <StatePanel compact={compact} role="alert" icon="compass" title="This search has expired" description="Search again with valid filters using the search box." />;
  if (status === 429) return <StatePanel compact={compact} role="alert" icon="hourglass" tone="warning" title="Too many searches" description={remaining ? `Try again in ${remaining} seconds.` : "You can try again now."} actions={<Button variant="primary" icon="refresh" disabled={remaining > 0} onClick={retry}>Try again</Button>} />;
  return <ErrorState compact={compact} error={error} onRetry={retry} title="Search is unavailable" description="Check your connection and try again." />;
}
