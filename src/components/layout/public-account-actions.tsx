"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useServiceQuery } from "@/hooks/use-services";
import { apiConfig } from "@/services/api/config";
import { ApiError } from "@/services/api/client";
import { authDestination } from "@/features/auth/auth-navigation";
import { Button, LinkButton } from "@/components/ui/primitives";

/** Public pages retain the authenticated workspace, including after a full reload. */
export function PublicAccountActions({ children, variant = "header" }: { children: ReactNode; variant?: "header" | "mobile" | "hero" }) {
  const connected = apiConfig.dataSource === "http";
  const session = useServiceQuery(["auth", "session"], s => s.auth.me(), { enabled: connected });
  if (!connected) return children;
  if (session.isPending) return null;
  const guest = session.error instanceof ApiError && session.error.status === 401;
  if (!guest && session.data) {
    const destination = authDestination(session.data);
    const label = session.data.user.email_verified ? "Your workspace" : "Verify your account";
    if (variant === "mobile") return <Link href={destination}>{label}</Link>;
    const action = <LinkButton href={destination} variant="primary" icon="arrow">{label}</LinkButton>;
    return variant === "hero" ? <div className="ph-actions">{action}<LinkButton href="/talent" icon="search">Explore talent</LinkButton></div> : action;
  }
  // An outage is not evidence that the person signed out.
  if (!guest && session.isError) return <Button variant="text sm" onClick={() => session.refetch()}>Retry account check</Button>;
  return children;
}
