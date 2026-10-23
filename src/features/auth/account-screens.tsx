"use client";

import { Button } from "@/components/ui/primitives";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useServices, useServiceQuery } from "@/hooks/use-services";
import { emailSchema, changePasswordSchema, otpSchema, invitationSchema } from "@/lib/validation/auth";
import { TextField } from "@/components/ui/field";
import { AuthHeader, AuthStory } from "@/components/layout/auth-chrome";
import { useAuthForm } from "./use-auth-form";
import { AuthError, AuthField } from "./auth-errors";
import { authDestination } from "./auth-navigation";
import { ApiError, errorMessage, fieldErrors } from "@/services/api/client";
import { toast } from "@/stores/toast-store";
import type { Challenge } from "@/services/auth/auth.service";
import { OtpFields, OtpResend, readOtpCode } from "./otp-ui";
import { ResetPasswordForm } from "./reset-password-form";
import { RECOVERY_EXPIRED_MESSAGE, RECOVERY_EXPIRED_PATH } from "./recovery-expiry";

export { ResetPasswordForm } from "./reset-password-form";

const RESET_EMAIL_INFO = "Enter the email linked to your account. We’ll send a reset code if that account exists.";

function InfoBadge({ text }: { text: string }) {
  return (
    <span className="auth-info-badge">
      <button type="button" aria-label={text}>
        <span aria-hidden="true">i</span>
      </button>
      <span role="tooltip">{text}</span>
    </span>
  );
}

export function AccountPanel({
  eyebrow,
  title,
  description,
  info,
  footer,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  info?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main id="main" className="auth-page is-login is-professional-login">
      <AuthHeader />
      <div className="auth-workspace-layout">
        <AuthStory />
        <section className="auth-form" aria-label={title}>
          <div className="auth-inner">
            <div className="auth-form-heading">
              <span className="eyebrow">{eyebrow}</span>
              {info ? (
                <div className="auth-heading-line">
                  <h1>{title}</h1>
                  <InfoBadge text={info} />
                </div>
              ) : (
                <h1>{title}</h1>
              )}
              {description ? <p>{description}</p> : null}
            </div>
            {children}
            {footer}
          </div>
        </section>
      </div>
    </main>
  );
}

export function ForgotPasswordForm({ onStep }: { onStep?: (step: "email" | "code" | "password") => void }) {
  const { auth } = useServices();
  const router = useRouter();
  const cache = useQueryClient();
  const search = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<"email" | "code">("email");
  useEffect(() => { onStep?.(step); }, [onStep, step]);
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [codeError, setCodeError] = useState("");
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { props, handleSubmit, formState: { errors, isSubmitting } } = useAuthForm(emailSchema, { email: "" });

  const sendCode = async (address: string) => {
    const next = await auth.forgot({ email: address });
    setEmail(address);
    setChallenge(next);
    setCodeError("");
    setStep("code");
    if (search.get("reason") === "reset-expired") router.replace("/forgot-password", { scroll: false });
  };

  const resend = async () => {
    setResending(true);
    try {
      const next = await auth.forgot({ email });
      setChallenge(next);
      setCodeError("");
      formRef.current?.reset();
      document.querySelector<HTMLElement>('[data-otp-index="0"]')?.focus();
    } catch (error) {
      const message = fieldErrors(error).email?.[0] || errorMessage(error);
      if (fieldErrors(error).email) setStep("email");
      toast(message, "error");
    } finally {
      setResending(false);
    }
  };

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCodeError("");
    const code = readOtpCode(event.currentTarget);
    const checked = otpSchema.safeParse({ code });
    if (!checked.success) {
      setCodeError(checked.error.issues[0]?.message || "Enter the complete 6-digit code.");
      event.currentTarget.querySelector<HTMLElement>('[name="otp-0"]')?.focus();
      return;
    }
    if (!challenge) return;
    setVerifying(true);
    try {
      await auth.verifyReset({ code: checked.data.code });
      const recovery = await auth.recovery();
      if (recovery.step !== "password") throw new Error("Request a new reset code before continuing.");
      cache.setQueryData(["auth", "recovery"], recovery);
      router.push("/reset-password");
    } catch (error) {
      const fields = fieldErrors(error);
      if (fields.code?.[0] === "That code is incorrect.") toast(fields.code[0], "error");
      else if (fields.code?.[0]) setCodeError(fields.code[0]);
      else if (fields.email?.[0]) {
        setStep("email");
        toast(fields.email[0], "error");
      } else toast(errorMessage(error), "error");
    } finally {
      setVerifying(false);
    }
  };

  if (step === "code" && challenge) {
    return (
      <form id="auth-form" ref={formRef} className="stack" noValidate onSubmit={verify}>
        <p className="notice">Enter the 6-digit code sent to {email}.</p>
        <OtpFields error={codeError} legend="Reset code" />
        <OtpResend sentAt={Date.parse(challenge.sent_at)} onResend={resend} disabled={resending || verifying} label="Resend code" />
        <Button loading={verifying || resending} variant="primary" type="submit" disabled={verifying || resending}>
          {verifying ? "Verifying…" : "VERIFY CODE"}
        </Button>
      </form>
    );
  }

  return (
    <form id="auth-form" className="stack" noValidate onSubmit={handleSubmit(async (input) => {
      try {
        await sendCode(input.email);
      } catch (error) {
        const message = fieldErrors(error).email?.[0];
        toast(message || errorMessage(error), "error");
      }
    })}>
      <AuthField name="email" message={errors.email?.message}>
        <TextField label="Email address" type="email" autoComplete="email" required {...props("email")} />
      </AuthField>
      <AuthError name="root" message={errors.root?.message} />
      <Button loading={isSubmitting} variant="primary" type="submit" disabled={isSubmitting} loadingLabel={"Sending…"}>
        {"SEND RESET CODE"}
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const { auth } = useServices();
  const router = useRouter();
  const cache = useQueryClient();
  const { props, submit, formState: { errors, isSubmitting } } = useAuthForm(changePasswordSchema, { current_password: "", password: "", password_confirmation: "" });
  return (
    <form id="auth-form" className="stack" noValidate onSubmit={submit(async (input) => { await auth.changePassword(input); cache.clear(); router.push("/login"); })}>
      <AuthField name="current_password" message={errors.current_password?.message}>
        <TextField label="Current password" type="password" autoComplete="current-password" required {...props("current_password")} />
      </AuthField>
      <AuthField name="password" message={errors.password?.message}>
        <TextField label="New password" type="password" autoComplete="new-password" required {...props("password")} />
      </AuthField>
      <AuthField name="password_confirmation" message={errors.password_confirmation?.message}>
        <TextField label="Confirm new password" type="password" autoComplete="new-password" required {...props("password_confirmation")} />
      </AuthField>
      <AuthError name="root" message={errors.root?.message} />
      <p className="notice">Changing your password signs you out on every device.</p>
      <Button loading={isSubmitting} variant="primary" type="submit" disabled={isSubmitting} loadingLabel={"Saving…"}>
        {"CHANGE PASSWORD"}
      </Button>
    </form>
  );
}

export function VerifyEmailScreen() {
  const { auth } = useServices();
  const router = useRouter();
  const cache = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const query = useServiceQuery(["auth", "session"], (s) => s.auth.me());
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [codeError, setCodeError] = useState("");
  const [resending, setResending] = useState(false);
  const [busy, setBusy] = useState(false);
  const requesting = useRef(false);
  const session = query.data;
  const activeChallenge = challenge ?? session?.email_challenge ?? null;
  const sentAt = activeChallenge ? Date.parse(activeChallenge.sent_at) : null;

  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) router.replace("/login");
    else if (session?.user.email_verified) router.replace(authDestination(session));
  }, [query.error, session, router]);

  useEffect(() => {
    if (query.isPending || query.isError || !session || session.user.email_verified || activeChallenge || requesting.current) return;
    requesting.current = true;
    void auth
      .requestEmailCode()
      .then((next) => setChallenge(next))
      .catch((error) => toast(errorMessage(error), "error"))
      .finally(() => {
        requesting.current = false;
      });
  }, [query.isPending, query.isError, session, activeChallenge, auth]);

  const resend = async () => {
    setResending(true);
    try {
      const next = await auth.requestEmailCode();
      setChallenge(next);
      document.querySelector<HTMLElement>('[data-otp-index="0"]')?.focus();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setResending(false);
    }
  };

  const verify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCodeError("");
    const code = readOtpCode(e.currentTarget);
    const checked = otpSchema.safeParse({ code });
    if (!checked.success) {
      setCodeError(checked.error.issues[0]?.message || "Enter the 6-digit code.");
      e.currentTarget.querySelector<HTMLElement>('[name="otp-0"]')?.focus();
      return;
    }
    if (!activeChallenge?.id) {
      toast("Request a verification code first.", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await auth.verifyEmail({ challenge_id: activeChallenge.id, code: checked.data.code });
      cache.clear();
      router.push(authDestination(result));
    } catch (error) {
      const fields = fieldErrors(error);
      toast(fields.code?.[0] || errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main" className="auth-page is-login is-professional-login">
      <AuthHeader />
      <div className="auth-workspace-layout">
        <AuthStory />
        <section className="auth-form" aria-label="Verify your email">
          <div className="auth-inner">
            <div className="auth-form-heading">
              <span className="eyebrow">CONFIRM YOUR EMAIL</span>
              <h1>Verify your email.</h1>
              <p>{session?.user.email ? `Enter the OTP sent to ${session.user.email}.` : "Enter the six-digit OTP we sent to your email."}</p>
            </div>
            {query.isPending ? null : query.isError ? (
              <p className="notice" role="alert">
                {query.error instanceof ApiError && query.error.status === 401 ? (
                  <>
                    Please <Link href="/login?role=professional">sign in</Link> to continue.
                  </>
                ) : (
                  errorMessage(query.error)
                )}
              </p>
            ) : session?.user.email_verified ? (
              <div className="stack">
                <p className="notice" role="status">
                  Your email is already verified.
                </p>
                <Link className="btn primary" href={authDestination(session)}>
                  CONTINUE
                </Link>
              </div>
            ) : (
              <form id="auth-form" ref={formRef} className="stack" noValidate onSubmit={verify}>
                <OtpFields error={codeError} />
                <OtpResend sentAt={sentAt} onResend={resend} disabled={resending || busy} />
                <Button loading={busy} loadingLabel="Verifying email" variant="primary" type="submit" disabled={busy || resending}>
                  VERIFY EMAIL
                </Button>
              </form>
            )}
            <p className="auth-switch-link">
              <Link href="/login?role=professional">Back to login</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export function AcceptInvitationForm({ token }: { token: string }) {
  const { auth } = useServices();
  const router = useRouter();
  const cache = useQueryClient();
  const { submit, formState: { errors, isSubmitting } } = useAuthForm(invitationSchema, { token });
  return (
    <form id="auth-form" className="stack" noValidate onSubmit={submit(async (input) => {
      const session = await auth.acceptInvitation(input.token);
      cache.clear();
      router.push(authDestination(session, "recruiter"));
    })}>
      <p className="notice">Accept this invitation using the verified account with the invited email address.</p>
      <AuthError name="token" message={errors.token?.message} />
      <AuthError name="root" message={errors.root?.message} />
      <Button loading={isSubmitting} variant="primary" type="submit" disabled={isSubmitting} loadingLabel={"Please wait…"}>
        {"ACCEPT INVITATION"}
      </Button>
    </form>
  );
}

const ACCOUNT_COPY = {
  forgot: {
    eyebrow: "ACCOUNT RECOVERY",
    title: "Reset your password.",
    description: "Enter the email linked to your account and we’ll send a reset code.",
    footer: (
      <p className="auth-switch-link">
        Remembered your password? <Link href="/login?role=professional">Back to login</Link>
      </p>
    ),
  },
  reset: {
    eyebrow: "ACCOUNT RECOVERY",
    title: "Choose a new password.",
    description: "Request a reset code, then choose a new password.",
    footer: (
      <p className="auth-switch-link">
        <Link href="/login?role=professional">Back to login</Link>
      </p>
    ),
  },
  change: {
    eyebrow: "SECURITY",
    title: "Change your password.",
    description: "Update your password to keep your account secure.",
    footer: (
      <p className="auth-switch-link">
        <Link href="/app/dashboard">Back to workspace</Link>
      </p>
    ),
  },
  invite: {
    eyebrow: "ORGANIZATION INVITE",
    title: "Join your organization.",
    description: "Confirm this invitation to join the team that invited you.",
    footer: (
      <p className="auth-switch-link">
        <Link href="/login?role=professional">Back to login</Link>
      </p>
    ),
  },
} as const;

export function AccountActionScreen({ mode }: { mode: "forgot" | "reset" | "change" | "invite" }) {
  const search = useSearchParams();
  const copy = ACCOUNT_COPY[mode];
  const [forgotStep, setForgotStep] = useState<"email" | "code" | "password">("email");
  return (
    <AccountPanel eyebrow={copy.eyebrow} title={copy.title} description={mode === "forgot" || mode === "reset" ? undefined : copy.description} info={mode === "forgot" && forgotStep === "email" ? RESET_EMAIL_INFO : undefined} footer={copy.footer}>
      {mode === "forgot" && forgotStep === "email" && search.get("reason") === "reset-expired" ? <p className="notice" role="alert">{RECOVERY_EXPIRED_MESSAGE}</p> : null}
      {mode === "forgot" ? (
        <ForgotPasswordForm onStep={setForgotStep} />
      ) : mode === "reset" ? (
        <RecoveryPasswordStep />
      ) : mode === "change" ? (
        <ChangePasswordForm />
      ) : (
        <AcceptInvitationForm token={search.get("token") ?? ""} />
      )}
    </AccountPanel>
  );
}

function RecoveryPasswordStep() {
  const router = useRouter();
  const cache = useQueryClient();
  const redirected = useRef(false);
  const query = useServiceQuery(["auth", "recovery"], (s) => s.auth.recovery());
  const expire = useCallback(() => {
    if (redirected.current) return;
    redirected.current = true;
    cache.setQueryData(["auth", "recovery"], { step: "email", expires_at: null });
    router.replace(RECOVERY_EXPIRED_PATH);
  }, [cache, router]);
  useEffect(() => {
    if (query.data && (query.data.step !== "password" || !query.data.expires_at)) expire();
  }, [query.data, expire]);
  if (query.isError) return <p role="alert">{errorMessage(query.error)}</p>;
  if (query.data?.step !== "password" || !query.data.expires_at) return null;
  return <ResetPasswordForm expiresAt={query.data.expires_at} onExpired={expire} />;
}
