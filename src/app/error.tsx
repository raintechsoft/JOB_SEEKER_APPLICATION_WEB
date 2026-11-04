"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/primitives";
import { StatePanel } from "@/components/ui/state-panel";

/** Route error boundary: a calm message without technical details. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="container section state-page">
      <StatePanel
        role="alert"
        icon="alert"
        tone="danger"
        title="Something went wrong"
        description="This page hit an unexpected problem. Try again, or head back and continue from there."
        actions={<>
          <Button variant="primary" icon="refresh" onClick={reset}>Try again</Button>
          <LinkButton href="/">Back to Skillora</LinkButton>
        </>}
      />
    </main>
  );
}
