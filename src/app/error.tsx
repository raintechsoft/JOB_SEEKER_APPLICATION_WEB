"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/primitives";
import { devCopy } from "@/lib/env/app-env";

/** Route error boundary: a calm message without technical details. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="container section">
      <div className="empty" role="alert">
        <h3>Something didn’t load as expected.</h3>
        <p>{devCopy("Please try again. Your saved changes are still in this browser.", "Please try again. Your saved changes are safe.")}</p>
        <div className="row wrap" style={{ justifyContent: "center" }}>
          <Button variant="primary" icon="refresh" onClick={reset}>
            Try again
          </Button>
          <LinkButton href="/">Back to Skillora</LinkButton>
        </div>
      </div>
    </main>
  );
}
