"use client";

import { useEffect, useState, type ReactNode } from "react";
import { describeError, type ErrorKind } from "@/lib/errors/error-state";
import type { IconName } from "./icon";
import { Button, LinkButton } from "./primitives";
import { StatePanel, type StateTone } from "./state-panel";

const ERROR_LOOK: Record<ErrorKind, { icon: IconName; tone: StateTone }> = {
  offline: { icon: "wifiOff", tone: "warning" },
  signedOut: { icon: "logIn", tone: "info" },
  forbidden: { icon: "lock", tone: "warning" },
  notFound: { icon: "compass", tone: "neutral" },
  expired: { icon: "refresh", tone: "info" },
  rateLimited: { icon: "hourglass", tone: "warning" },
  unavailable: { icon: "alert", tone: "danger" },
  unknown: { icon: "alert", tone: "danger" },
};

function useCountdown(seconds?: number) {
  const [left, setLeft] = useState(seconds ?? 0);
  useEffect(() => {
    if (!left) return;
    const timer = setTimeout(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return left;
}

/**
 * Status-aware failure state. Retry is offered only when retrying can help; access, missing
 * and signed-out states offer the next sensible step instead.
 */
export function ErrorState({ error, onRetry, title, description, compact, signInHref = "/login", homeHref, homeLabel = "Go back", secondary }: {
  error?: unknown;
  onRetry?: () => unknown;
  title?: ReactNode;
  description?: ReactNode;
  compact?: boolean;
  signInHref?: string;
  /** Escape link for missing or forbidden content. */
  homeHref?: string;
  homeLabel?: string;
  secondary?: ReactNode;
}) {
  const state = describeError(error);
  const wait = useCountdown(state.retryAfter);
  const look = ERROR_LOOK[state.kind];
  const expired = state.kind === "expired";
  // Custom copy describes generic failures; specific situations keep their accurate wording.
  const generic = state.kind === "unknown" || state.kind === "unavailable";
  const actions = <>
    {state.kind === "signedOut" && <LinkButton variant="primary" icon="logIn" href={signInHref}>Sign in</LinkButton>}
    {expired && <Button variant="primary" icon="refresh" onClick={() => window.location.reload()}>Reload page</Button>}
    {state.retryable && onRetry && <Button variant="primary" icon="refresh" disabled={wait > 0} onClick={() => void onRetry()}>{wait > 0 ? `Try again in ${wait}s` : "Try again"}</Button>}
    {!state.retryable && !expired && state.kind !== "signedOut" && (homeHref ? <LinkButton href={homeHref}>{homeLabel}</LinkButton> : <Button icon="arrow" onClick={() => window.history.back()}>Go back</Button>)}
    {secondary}
  </>;
  return <StatePanel role="alert" compact={compact} icon={look.icon} tone={look.tone} title={generic ? title ?? state.title : state.title} description={generic ? description ?? state.message : state.message} actions={actions} />;
}

/** Empty data with a next step; pick an icon that describes what is missing. */
export function EmptyPanel({ icon = "inbox", title, description, action, compact }: { icon?: IconName; title: ReactNode; description?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return <StatePanel icon={icon} title={title} description={description} actions={action} compact={compact} />;
}
