"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Role } from "@/types/domain";
import { useAuthForm } from "./use-auth-form";
import { AuthError, AuthField } from "./auth-errors";
import { authDestination } from "./auth-navigation";
import { apiConfig } from "@/services/api/config";
import { signUpSchema, signInSchema } from "@/lib/validation/auth";
import { useServiceAction, useServices } from "@/hooks/use-services";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { Button } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/field";
import { AuthHeader, AuthStory } from "@/components/layout/auth-chrome";
import { EmployerRegistrationScreen } from "./employer-registration";
import { clearIdentityState } from "./clear-identity-state";
import { GoogleReturnNotice, GoogleSignInButton } from "./google-sign-in";
import {applicationSignInReturn} from "@/features/applications/application-wizard-policy";
import {navigateToApplication} from "@/features/applications/application-signin-return";

export function SignInForm({ role }: { role: Role }) {
  const router = useRouter();
  const services = useServices();
  const cache = useQueryClient();
  const { props, submit, formState: { errors, isSubmitting } } = useAuthForm(signInSchema, { email: "", password: "" });
  return (
    <form
      id="auth-form"
      className="stack"
      noValidate
      onSubmit={submit(async (values) => {
        if (apiConfig.dataSource === "http") {
          const session = await services.auth.login(values, role === "recruiter" ? "employer" : "professional");
          clearIdentityState(); cache.clear();
          const next = new URLSearchParams(window.location.search).get("next");
          const application=role==="professional"?applicationSignInReturn(next):null;
          if(application&&session.user.email_verified){navigateToApplication(application);return;}
          router.push(session.user.email_verified ? next?.startsWith("/accept-invitation?")?next:application??authDestination(session,role) : application?"/verify-email?next="+encodeURIComponent(application):authDestination(session,role));
          return;
        }
        await services.workspace.signIn(role);
        router.push(role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard");
        toast(devCopy("Welcome to the demo. Authentication is simulated.", "Welcome back."));
      })}
    >
      <AuthField name="email" message={errors.email?.message}>
        <TextField label="Email address" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" {...props("email")} />
      </AuthField>
      <AuthField name="password" message={errors.password?.message}>
        <TextField label="Password" type="password" required maxLength={256} autoComplete="current-password" {...props("password")} />
      </AuthField>
      <AuthError name="root" message={errors.root?.message} />
      <Button loading={isSubmitting} variant="primary" type="submit" disabled={isSubmitting} loadingLabel={"Signing in…"}>
        {"LOGIN"}
      </Button>
      <Link className="small muted" href="/forgot-password">Forgot password?</Link>
    </form>
  );
}

export function SignUpForm({ role }: { role: Role }) {
  const router = useRouter();
  const setOnboarding = useUiStore((s) => s.setOnboarding);
  const services = useServices();
  const cache = useQueryClient();
  const { props, submit, formState: { errors, isSubmitting } } = useAuthForm(signUpSchema, { name: "", email: "", password: "" });
  return (
    <form
      id="auth-form"
      className="stack"
      noValidate
      onSubmit={submit(async (v) => {
        if (apiConfig.dataSource === "http") {
          const session = await services.auth.register(v);
          clearIdentityState(); cache.clear();
          const next=role==="professional"?applicationSignInReturn(new URLSearchParams(window.location.search).get("next")):null;
          if(next&&session.user.email_verified){navigateToApplication(next);return;}
          router.push(next?(session.user.email_verified?next:"/verify-email?next="+encodeURIComponent(next)):authDestination(session));
          return;
        }
        await services.workspace.signUp(role, v.name.trim());
        setOnboarding({ role, step: 0 });
        router.push("/onboarding");
      })}
    >
      <AuthField name="name" message={errors.name?.message}>
        <TextField label="Full name" required minLength={2} maxLength={100} autoComplete="name" {...props("name")} />
      </AuthField>
      <AuthField name="email" message={errors.email?.message}>
        <TextField label="Email address" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" {...props("email")} />
      </AuthField>
      <AuthField name="password" message={errors.password?.message}>
        <TextField label="Password" type="password" required minLength={8} maxLength={256} autoComplete="new-password" placeholder="At least 8 characters" {...props("password")} />
      </AuthField>
      <AuthError name="root" message={errors.root?.message} />
      <Button loading={isSubmitting} variant="primary" type="submit" disabled={isSubmitting} loadingLabel={"Creating account…"}>
        {"SUBMIT"}
      </Button>
    </form>
  );
}

/** HTTP mode uses Laravel; the explicitly enabled development prototype has separate mock actions. */
export function AuthScreen({ signup = false, roleParam, employer = false }: { signup?: boolean; roleParam?: string; employer?: boolean }) {
  const stored = useUiStore((s) => s.authRole);
  const setUi = useUiStore((s) => s.setUi);
  const role: Role = employer || roleParam === "recruiter" ? "recruiter" : "professional";
  useEffect(() => {
    if (role !== stored) setUi({ authRole: role });
  }, [role, stored, setUi]);
  if (signup && role === "recruiter") return <EmployerRegistrationScreen />;
  return <AuthLayout signup={signup} role={role} />;
}

function AuthLayout({ signup, role }: { signup: boolean; role: Role }) {
  const params=useSearchParams();
  const application=role==="professional"?applicationSignInReturn(params.get("next")):null;
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
              {!signup && <p>{recruiter ? "Sign in with your employer account." : "Sign in with your professional account."}</p>}
            </div>
            {signup ? (
              <SignUpForm role={role} />
            ) : (
              <div className="auth-methods">
                {!recruiter && <GoogleReturnNotice />}
                <SignInForm role={role} />
                {/* Google sign-in is for job seekers; employer accounts use their verified email. */}
                {!recruiter && <GoogleSignInButton />}
              </div>
            )}
            {!(recruiter && !signup) && (
              <p className="auth-switch-link">
                {signup ? "Already Registered?" : "New around here?"} <Link href={(signup ? "/login" : "/signup") + "?role=" + role+(application?"&next="+encodeURIComponent(application):"")}>{signup ? "Login" : "Create a profile"}</Link>
              </p>
            )}
            {recruiter && !signup ? (
              <Link className="btn auth-create-employer" href="/employer/register">
                Don’t have a registered email? Create account <Icon name="arrow" />
              </Link>
            ) : (
              <DevOnly>
                {apiConfig.dataSource === "mock" && <>
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
                </>}
              </DevOnly>
            )}
          </div>
        </section>
      </div>
      {signup && apiConfig.dataSource === "mock" && (
        <DevOnly>
          <footer className="auth-workspace-footer">
            <Icon name="shield" />A frontend prototype. Your demo data stays in this browser.
          </footer>
        </DevOnly>
      )}
    </main>
  );
}
