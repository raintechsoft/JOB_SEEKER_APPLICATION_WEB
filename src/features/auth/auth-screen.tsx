"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/types/domain";
import { useZodForm } from "@/lib/validation/form";
import { signUpSchema, signInSchema } from "@/lib/validation/auth";
import { useServiceAction } from "@/hooks/use-services";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { Button } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/field";
import { AuthHeader, AuthStory } from "@/components/layout/auth-chrome";
import { EmployerRegistrationScreen } from "./employer-registration";

function GoogleSignInButton() {
  return (
    <div className="auth-google-login">
      <div className="auth-method-divider">
        <span>or</span>
      </div>
      <button type="button" className="auth-google-button" onClick={() => toast(devCopy("Google sign-in is not connected yet. Please use email or a demo login.", "Google sign-in is not available yet. Please use your email address."))}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.61 0-4.83-1.76-5.62-4.12H3.03v2.59A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.38 13.92a6.01 6.01 0 0 1 0-3.84V7.49H3.03a10 10 0 0 0 0 9.02l3.35-2.59Z" />
          <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.97 5.49l3.35 2.59C7.17 7.72 9.39 5.96 12 5.96Z" />
        </svg>
        <span>Continue with Google</span>
      </button>
    </div>
  );
}

function SignInForm({ role }: { role: Role }) {
  const run = useServiceAction();
  const router = useRouter();
  const { register, handleSubmit } = useZodForm(signInSchema, { email: "", password: "" });
  return (
    <form
      id="auth-form"
      className="stack"
      onSubmit={handleSubmit(async () => {
        await run((s) => s.workspace.signIn(role));
        router.push(role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard");
        toast(devCopy("Welcome to the demo. Authentication is simulated.", "Welcome back."));
      })}
    >
      <TextField label="Email address" type="email" required autoComplete="email" placeholder="you@example.com" {...register("email")} />
      <TextField label="Password" type="password" required minLength={8} autoComplete="current-password" placeholder="At least 8 characters" {...register("password")} />
      <button className="btn primary" type="submit">
        Submit
        <Icon name="arrow" />
      </button>
    </form>
  );
}

function SignUpForm({ role }: { role: Role }) {
  const run = useServiceAction();
  const router = useRouter();
  const setOnboarding = useUiStore((s) => s.setOnboarding);
  const { register, handleSubmit } = useZodForm(signUpSchema, { name: "", email: "", password: "" });
  return (
    <form
      id="auth-form"
      className="stack"
      onSubmit={handleSubmit(async (v) => {
        await run((s) => s.workspace.signUp(role, v.name.trim()));
        setOnboarding({ role, step: 0 });
        router.push("/onboarding");
      })}
    >
      <TextField label="Full name" required minLength={2} autoComplete="name" {...register("name")} />
      <TextField label="Email address" type="email" required autoComplete="email" placeholder="you@example.com" {...register("email")} />
      <TextField label="Password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" {...register("password")} />
      <button className="btn primary" type="submit">
        Submit
        <Icon name="arrow" />
      </button>
    </form>
  );
}

/** Sign in / create profile. AUTHENTICATION IS SIMULATED: no credentials are checked or stored. */
export function AuthScreen({ signup = false, roleParam, employer = false }: { signup?: boolean; roleParam?: string; employer?: boolean }) {
  const stored = useUiStore((s) => s.authRole);
  const setUi = useUiStore((s) => s.setUi);
  const role: Role = employer ? "recruiter" : roleParam === "professional" || roleParam === "recruiter" ? roleParam : stored;
  useEffect(() => {
    if (role !== stored) setUi({ authRole: role });
  }, [role, stored, setUi]);
  if (signup && role === "recruiter") return <EmployerRegistrationScreen />;
  return <AuthLayout signup={signup} role={role} />;
}

function AuthLayout({ signup, role }: { signup: boolean; role: Role }) {
  const run = useServiceAction();
  const router = useRouter();
  const recruiter = role === "recruiter";
  const demo = async (demoRole: Role) => {
    await run((s) => s.workspace.signIn(demoRole));
    router.push(demoRole === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard");
    toast("Welcome to your " + demoRole + " demo workspace.");
  };
  return (
    <main id="main" className={"auth-page " + (signup ? "is-signup" : "is-login" + (recruiter ? " is-employer-login" : " is-professional-login"))}>
      <AuthHeader />
      <div className="auth-workspace-layout">
        <AuthStory employer={recruiter} />
        <section className="auth-form" aria-label={signup ? "Create an account" : "Sign in"}>
          <div className="auth-inner">
            <div className="auth-form-heading">
              <span className="eyebrow">{signup ? "GET STARTED" : "WELCOME BACK"}</span>
              <h1>{signup ? "Start your next chapter." : "Good to see you again."}</h1>
            </div>
            {signup ? (
              <SignUpForm role={role} />
            ) : (
              <div className="auth-methods">
                <SignInForm role={role} />
                <GoogleSignInButton />
              </div>
            )}
            {!(recruiter && !signup) && (
              <p className="auth-switch-link">
                {signup ? "Already Registered?" : "New around here?"} <Link href={(signup ? "/login" : "/signup") + "?role=" + role}>{signup ? "Login" : "Create a profile"}</Link>
              </p>
            )}
            {recruiter && !signup ? (
              <Link className="btn auth-create-employer" href="/employer/register">
                Don’t have a registered email? Create account <Icon name="arrow" />
              </Link>
            ) : (
              <DevOnly>
                <div className="demo-login">
                  <p>JUST LOOKING AROUND? JUMP RIGHT IN.</p>
                  <div className="grid cols2">
                    <Button icon="user" onClick={() => demo("professional")}>
                      Professional demo
                    </Button>
                    <Button icon="users" onClick={() => demo("recruiter")}>
                      Recruiter demo
                    </Button>
                  </div>
                  <Link className="auth-admin-link" href="/admin/dashboard">
                    Explore the optional admin demo
                  </Link>
                </div>
              </DevOnly>
            )}
          </div>
        </section>
      </div>
      {signup && (
        <DevOnly>
          <footer className="auth-workspace-footer">
            <Icon name="shield" />A frontend prototype. Your demo data stays in this browser.
          </footer>
        </DevOnly>
      )}
    </main>
  );
}
