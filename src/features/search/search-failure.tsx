"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/services/api/client";
import { Button } from "@/components/ui/primitives";

export function SearchFailure({ error, retry }: { error: unknown; retry: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  const initialSeconds = status === 429 ? error instanceof ApiError ? error.retryAfterSeconds ?? 60 : 60 : 0;
  const [cooldown, setCooldown] = useState({ source: error, remaining: initialSeconds });
  if (cooldown.source !== error) setCooldown({ source: error, remaining: initialSeconds });
  const remaining = cooldown.remaining;
  useEffect(() => { if (remaining <= 0) return; const timer = setTimeout(() => setCooldown(value => ({ ...value, remaining: Math.max(0,value.remaining-1) })), 1000); return () => clearTimeout(timer); }, [remaining, error]);
  const message = [401,419].includes(status) ? "Your session expired. Sign in again to search." : [403,412].includes(status) ? "This search is unavailable in your current workspace. Refresh your workspace." : status === 422 ? "This search or page has expired. Search again with valid filters." : status === 429 ? `Too many searches. ${remaining ? `Try again in ${remaining} seconds.` : "You can try again now."}` : "Search is unavailable. Check your connection and try again.";
  return <p className="header-search-hint" role="alert">{message} {![401,403,412,419,422].includes(status) && <Button disabled={remaining > 0} onClick={retry}>Try again</Button>}</p>;
}
