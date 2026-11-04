"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button, LinkButton } from "@/components/ui/primitives";
import { StatePanel } from "@/components/ui/state-panel";

/** Return only to signed-in destinations the proxy is allowed to retry. */
function retryPath(value: string | null): string | null {
  if (!value || value.length > 500 || !value.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) return null;
  const path = value.split(/[?#]/)[0];
  if (!/^\/(?:app|recruiter|admin|verify-email|change-password|onboarding|accept-invitation)(?:\/|$)/.test(path)) return null;
  return value;
}

function ServiceUnavailablePanel() {
  const router = useRouter();
  const params = useSearchParams();
  const next = retryPath(params.get("next"));
  const signInHref = (next?.startsWith("/recruiter") ? "/employer/login" : "/login") + (next ? `?next=${encodeURIComponent(next)}` : "");
  return (
    <StatePanel
      role="alert"
      icon="hourglass"
      tone="warning"
      title="Account verification is temporarily unavailable"
      description="We couldn’t confirm your signed-in session just now. This is usually brief — try again in a moment."
      actions={
        <>
          <Button
            variant="primary"
            icon="refresh"
            onClick={() => {
              if (next) router.replace(next);
              else window.location.reload();
            }}
          >
            Try again
          </Button>
          <LinkButton href={signInHref}>Sign in again</LinkButton>
        </>
      }
    />
  );
}

export default function ServiceUnavailablePage() {
  return (
    <main id="main" className="container section state-page">
      <Suspense
        fallback={
          <StatePanel
            icon="hourglass"
            tone="warning"
            title="Account verification is temporarily unavailable"
            description="We couldn’t confirm your signed-in session just now. This is usually brief — try again in a moment."
          />
        }
      >
        <ServiceUnavailablePanel />
      </Suspense>
    </main>
  );
}
