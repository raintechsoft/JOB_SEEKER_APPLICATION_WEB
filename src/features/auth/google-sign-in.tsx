"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apiConfig } from "@/services/api/config";
import { useServices } from "@/hooks/use-services";
import { errorMessage } from "@/services/api/client";
import { toast } from "@/stores/toast-store";
import { devCopy } from "@/lib/env/app-env";
import { authDestination } from "./auth-navigation";
import { clearIdentityState } from "./clear-identity-state";
import {rememberApplicationSignInReturn,takeApplicationSignInReturn,navigateToApplication} from "@/features/applications/application-signin-return";

/** Job-seeker Google sign-in needs the real API and the public flag; Laravel holds the credentials. */
export const googleSignInEnabled = () => apiConfig.dataSource === "http" && process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN_ENABLED === "true";

/** Laravel's browser OAuth entry point lives beside, not under, the versioned API path. */
export function googleRedirectUrl(): string {
  return new URL("/auth/google/redirect", apiConfig.baseUrl).toString();
}

export const GOOGLE_ERRORS: Record<string, string> = {
  unavailable: "Google sign-in isn’t available right now. Please use your email address.",
  failed: "Google sign-in couldn’t be completed. Please try again.",
  unverified_google_email: "Your Google account’s email address isn’t verified. Verify it with Google, or sign in with your email and password.",
  use_password: "We couldn’t sign you in with Google. Please sign in with your email and password.",
  signed_in: "You’re already signed in.",
};

/**
 * Finishes the round trip on /login: `?google=success` adopts the session Laravel created,
 * `?google_error=` explains why it did not in an error toast.
 */
export function useGoogleReturn(): { completing: boolean } {
  const params = useSearchParams();
  const router = useRouter();
  const services = useServices();
  const cache = useQueryClient();
  const success = params.get("google") === "success";
  const code = params.get("google_error");
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (!success || started.current) return;
    started.current = true;
    services.auth
      .completeExternalSignIn()
      .then((session) => {
        clearIdentityState();
        cache.clear();
        const next=takeApplicationSignInReturn();
        if(next&&session.user.email_verified){navigateToApplication(next);return;}
        router.replace(session.user.email_verified&&next?next:authDestination(session,"professional"));
      })
      .catch((e) => {
        setFailed(true);
        toast(errorMessage(e) || GOOGLE_ERRORS.failed, "error");
      });
  }, [success, services, cache, router]);
  const reported = useRef("");
  useEffect(() => {
    if (!code || reported.current === code) return;
    reported.current = code;
    // Backing out at Google is the user's own choice, so the page simply returns to the form.
    if (code !== "cancelled") toast(GOOGLE_ERRORS[code] ?? GOOGLE_ERRORS.failed, "error");
    // Drop the code so a refresh does not repeat the toast.
    const rest = new URLSearchParams(params.toString());
    rest.delete("google_error");
    const next=takeApplicationSignInReturn();
    if(next)rest.set("next",next);
    router.replace(`${window.location.pathname}${rest.size ? `?${rest}` : ""}`);
  }, [code, params, router]);
  return { completing: success && !failed };
}

export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);
  const enabled = googleSignInEnabled();
  const start = () => {
    if (!enabled) {
      toast(devCopy("Google sign-in is not connected yet. Please use email or a demo login.", GOOGLE_ERRORS.unavailable));
      return;
    }
    setPending(true);
    rememberApplicationSignInReturn(new URLSearchParams(window.location.search).get("next"));
    // A full navigation: Google's consent page cannot run inside the SPA or a fetch.
    window.location.assign(googleRedirectUrl());
  };
  return (
    <div className="auth-google-login">
      <div className="auth-method-divider">
        <span>or</span>
      </div>
      <button type="button" className="auth-google-button" onClick={start} disabled={pending} aria-busy={pending || undefined}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.61 0-4.83-1.76-5.62-4.12H3.03v2.59A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.38 13.92a6.01 6.01 0 0 1 0-3.84V7.49H3.03a10 10 0 0 0 0 9.02l3.35-2.59Z" />
          <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.97 5.49l3.35 2.59C7.17 7.72 9.39 5.96 12 5.96Z" />
        </svg>
        <span>{pending ? "Redirecting to Google…" : "Continue with Google"}</span>
      </button>
    </div>
  );
}

/** Progress for the Google round trip above the sign-in form; failures surface as error toasts. */
export function GoogleReturnNotice() {
  const { completing } = useGoogleReturn();
  return completing ? <p className="auth-google-status" role="status">Signing you in with Google…</p> : null;
}
