"use client";

import {useEffect, useId, useRef, useState} from "react";
import {z} from "zod";
import {Button} from "@/components/ui/button";
import {FloatingInput} from "@/components/ui/field";
import {contactCountdown, type ApplicationChallengeStatus} from "@/lib/domain/application-contact";
import {applicationContactChallengeSchema, applicationContactVerifySchema} from "@/lib/validation/application-wizard";
import {ApiError, fieldErrors as apiFieldErrors} from "@/services/api/client";
import type {createHttpApplicationDraftService} from "@/services/applications/application-wizard.http";

type Props = {
  draftId: string;
  input: z.infer<typeof applicationContactChallengeSchema>;
  verified: boolean;
  service: Pick<ReturnType<typeof createHttpApplicationDraftService>, "challenge" | "verify">;
  onVerified: () => void;
};
/** A3 reusable control. A5 mounts this after saving the selected contact to its owned draft. */
export function ApplicationContactVerification(props: Props) {
  return <ApplicationContactControl key={`${props.draftId}:${JSON.stringify(props.input)}`} {...props}/>;
}

function ApplicationContactControl({draftId, input, verified, service, onVerified}: Props) {
  const identity = `${draftId}:${JSON.stringify(input)}`;
  const [result, setResult] = useState<{identity: string; status: ApplicationChallengeStatus; receivedAt: number} | null>(null);
  const [code, setCode] = useState({identity, value: ""});
  const [error, setError] = useState({identity, value: ""});
  const [pending, setPending] = useState(false);
  const [clock, setClock] = useState(0);
  const [cooldown, setCooldown] = useState({identity, until: 0});
  const lock = useRef(false);
  const mounted = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const active = result?.identity === identity ? result : null;
  const timing = active ? contactCountdown(active.status, active.receivedAt, Math.max(clock, active.receivedAt)) : null;
  const message = error.identity === identity ? error.value : "";
  const value = code.identity === identity ? code.value : "";
  const retrySeconds = cooldown.identity === identity ? Math.max(0, Math.ceil((Math.round(cooldown.until) - Math.round(clock)) / 1000)) : 0;
  useEffect(() => {
    mounted.current = true;
    return () => {mounted.current = false;};
  }, []);
  useEffect(() => {
    if ((!active || active.status.status === "verified") && !retrySeconds) return;
    const timer = setInterval(() => setClock(performance.now()), 250);
    return () => clearInterval(timer);
  }, [active, retrySeconds]);

  async function run(verify: boolean) {
    if (lock.current) return;
    setError({identity, value: ""});
    try {
      // Runtime shape checks precede the service and every session/CSRF request.
      if (verify) applicationContactVerifySchema.parse({schemaVersion: 2, code: value});
      else applicationContactChallengeSchema.parse(input);
      if (verify && (!active || timing?.expired)) throw new Error("This code has expired. Request a new code.");
      lock.current = true;
      setPending(true);
      if (verify && active) {
        await service.verify(draftId, active.status.id, {schemaVersion: 2, code: value});
        if (!mounted.current) return;
        setCode({identity, value: ""});
        onVerified(); // Refetch authoritative proof; never grant proof locally.
      } else {
        const status = await service.challenge(draftId, input);
        if (!mounted.current) return;
        setResult({identity, status, receivedAt: performance.now()});
        setCode({identity, value: ""});
        if (status.status === "verified") onVerified();
      }
    } catch (e) {
      if (!mounted.current) return;
      const fields = apiFieldErrors(e);
      const first = fields && Object.values(fields).flat().find(v => typeof v === "string");
      const text = e instanceof z.ZodError ? e.issues[0]?.message : first || (e instanceof Error ? e.message : "Verification failed. Try again.");
      setError({identity, value: text || "Verification failed. Try again."});
      if (e instanceof ApiError && e.status === 429 && e.retryAfterSeconds) {
        const now = performance.now();
        setClock(now);
        setCooldown({identity, until: now + e.retryAfterSeconds * 1000});
      }
      if (verify) inputRef.current?.focus();
    } finally {
      lock.current = false;
      if (mounted.current) setPending(false);
    }
  }

  if (verified || active?.status.status === "verified") return null;
  return <div className="grid gap-3" aria-busy={pending}>
    {active && <>
      <p role="status">{timing?.expired ? "Code expired. Request a new code." : `Code sent to ${active.status.maskedDestination}.`}</p>
      {!timing?.expired && <>
        <FloatingInput ref={inputRef} label="Verification code" value={value} onChange={e => setCode({identity, value: e.target.value})} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required aria-invalid={!!message} aria-describedby={message ? errorId : undefined}/>
        <p className="text-sm text-muted-foreground">Code expires in {Math.floor((timing?.expires ?? 0) / 60)}:{String((timing?.expires ?? 0) % 60).padStart(2, "0")}.</p>
        <Button disabled={pending || retrySeconds > 0} onClick={() => run(true)}>Verify code</Button>
      </>}
    </>}
    {message && <p id={errorId} role="alert" className="text-sm text-red-600">{message}</p>}
    <Button disabled={pending || retrySeconds > 0 || !!active && !timing?.canResend} onClick={() => run(false)}>{retrySeconds ? `Try again in ${retrySeconds}s` : active ? timing?.resend ? `Resend in ${timing.resend}s` : "Request a new code" : "Send verification code"}</Button>
  </div>;
}
