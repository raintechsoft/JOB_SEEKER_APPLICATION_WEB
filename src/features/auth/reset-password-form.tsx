"use client";

import { Button } from "@/components/ui/primitives";
import { Spinner } from "@/components/ui/spinner";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { TextField } from "@/components/ui/field";
import { useServices } from "@/hooks/use-services";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { ApiError, fieldErrors } from "@/services/api/client";
import { AuthError, AuthField } from "./auth-errors";
import { RECOVERY_EXPIRED_MESSAGE } from "./recovery-expiry";
import { useAuthForm } from "./use-auth-form";

export function ResetPasswordForm({ expiresAt, onExpired }: { expiresAt: string; onExpired: () => void }) {
  const { auth } = useServices();
  const router = useRouter();
  const cache = useQueryClient();
  const completed = useRef(false);
  const deadline = Date.parse(expiresAt);
  const [now, setNow] = useState(() => Date.now());
  const remaining = Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const { props, submit, formState: { errors, isSubmitting } } = useAuthForm(resetPasswordSchema, { password: "", password_confirmation: "" });

  useEffect(() => {
    // Recompute from the absolute server deadline, including after a sleeping/background tab.
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 250);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    // An in-flight request may have been accepted before expiry. Let Laravel decide its result.
    if (remaining === 0 && !isSubmitting && !completed.current) onExpired();
  }, [remaining, isSubmitting, onExpired]);

  if (remaining === 0) return isSubmitting ? <span role="status" aria-label="Submitting password reset" aria-busy="true"><Spinner /></span> : <p className="notice" role="alert">{RECOVERY_EXPIRED_MESSAGE}</p>;

  return (
    <form id="auth-form" className="stack" noValidate onSubmit={(event) => { void submit(async (input) => {
      // Recheck immediately before transport; timer callbacks can be delayed by the browser.
      if (!Number.isFinite(deadline) || Date.now() >= deadline) { onExpired(); return; }
      try {
        await auth.reset(input);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 419 || error.status === 422 && fieldErrors(error).challenge_id)) {
          onExpired();
          return;
        }
        throw error;
      }
      completed.current = true;
      cache.clear();
      router.push("/login");
    })(event); }}>
      <p className="notice">Reset session expires in <span role="timer" aria-live="off" aria-label="Time remaining to reset your password">{String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</span>.</p>
      <AuthField name="password" message={errors.password?.message}>
        <TextField label="New password" type="password" autoComplete="new-password" required {...props("password")} />
      </AuthField>
      <AuthField name="password_confirmation" message={errors.password_confirmation?.message}>
        <TextField label="Confirm new password" type="password" autoComplete="new-password" required {...props("password_confirmation")} />
      </AuthField>
      <AuthError name="root" message={errors.root?.message} />
      <Button loading={isSubmitting} variant="primary" type="submit" disabled={isSubmitting} loadingLabel={"Saving…"}>{"RESET PASSWORD"}</Button>
    </form>
  );
}
