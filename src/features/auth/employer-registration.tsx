"use client";

import { Button } from "@/components/ui/primitives";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import type { OtpChallenge } from "@/services/registration/registration.service";
import { OTP_RESEND_AFTER_MS } from "@/services/registration/registration.service";
import { EMPLOYER_INDUSTRIES, EMPLOYER_SIZES, callingCode, phoneE164, validMobile } from "@/lib/validation/auth";
import { CountryCodeField } from "./country-code-field";
import { employerMobileSchema, employerDetailsSchema, employerCompanySchema, otpSchema } from "@/lib/validation/auth";
import { apiConfig } from "@/services/api/config";
import { errorMessage, fieldErrors } from "@/services/api/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Challenge } from "@/services/auth/auth.service";
import { useServiceAction, useServices } from "@/hooks/use-services";
import { toast } from "@/stores/toast-store";
import { resetOrganizationDrafts } from "@/features/organization/draft-store";
import { Icon } from "@/components/ui/icon";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { AuthHeader, AuthStory } from "@/components/layout/auth-chrome";
import { OtpFields, OtpResend, OtpExpiry, readOtpCode } from "./otp-ui";

interface Draft {
  step: number;
  country: string;
  mobile: string;
  accountType: "company" | "individual";
  fullName: string;
  email: string;
  hiringFor: "company" | "consultancy";
  companyName: string;
  industry: string;
  employees: string;
  designation: string;
  pincode: string;
  address: string;
}

const EMPTY: Draft = { step: 0, country: "IN", mobile: "", accountType: "company", fullName: "", email: "", hiringFor: "company", companyName: "", industry: "", employees: "", designation: "", pincode: "", address: "" };
const TITLES = ["Continue with mobile", "Verify mobile number", "Your basic details", "Verify email ID", "Company details"];

/** In-memory registration progress (kept while navigating within the session, as in the prototype). */
const useRegistration = create<{ intentId: string | null; draft: Draft; challenge: OtpChallenge | null; phoneVerified: string; emailVerified: string; error: string; set: (p: Partial<{ intentId: string | null; draft: Draft; challenge: OtpChallenge | null; phoneVerified: string; emailVerified: string; error: string }>) => void }>((set) => ({
  intentId: null,
  draft: EMPTY,
  challenge: null,
  phoneVerified: "",
  emailVerified: "",
  error: "",
  set: (p) => set(p),
}));

const maskedPhone = (d: Draft) => callingCode(d.country) + " " + "*".repeat(Math.max(4, d.mobile.length - 4)) + d.mobile.slice(-4);
const maskedEmail = (d: Draft) => {
  const [local = "", domain = ""] = d.email.split("@");
  return local.slice(0, 2) + "*".repeat(Math.max(4, local.length - 2)) + "@" + domain;
};

function Choice({ name, options, value }: { name: "accountType" | "hiringFor"; options: [string, string][]; value: string }) {
  return (
    <fieldset className="er-choice">
      <legend>{name === "accountType" ? "You’re creating account as" : "Hiring for"} <span aria-hidden="true">*</span></legend>
      {options.map(([id, label]) => (
        <label key={id}>
          <input type="radio" name={name} value={id} defaultChecked={id === value} required />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

/** Five-step enrollment; the prototype adapter is available only in explicit demo mode. */
export function EmployerRegistrationScreen() {
  const services = useServices();
  const run = useServiceAction();
  const router = useRouter();
  const { intentId, draft, challenge, phoneVerified, emailVerified, set } = useRegistration();
  const [companyName, setCompanyName] = useState(draft.companyName);
  const formRef = useRef<HTMLFormElement>(null);
  const cache = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const real = apiConfig.dataSource === "http";
  const challengeView = (value: Challenge, target: string): OtpChallenge => {
    if (value.kind !== "whatsapp" && value.kind !== "email") throw new Error("Unexpected registration challenge purpose.");
    return { id: value.id, kind: value.kind, target, sentAt: Date.parse(value.sent_at), expiresAt: Date.parse(value.expires_at) };
  };

  const collect = (): Draft => {
    const next = { ...useRegistration.getState().draft };
    const form = formRef.current;
    if (!form) return next;
    const f = new FormData(form);
    for (const key of Object.keys(next) as (keyof Draft)[]) if (key !== "step" && f.has(key)) (next as Record<string, unknown>)[key] = String(f.get(key) || "").trim();
    return next;
  };

  const go = async (step: number, focusSelector?: string, collectFirst = true) => {
    setErrors({});
    const d = collectFirst ? collect() : { ...useRegistration.getState().draft };
    let c = useRegistration.getState().challenge;
    if (!real && step === 1 && c?.kind !== "whatsapp") c = await services.registration.requestOtp("whatsapp", phoneE164(d.country, d.mobile));
    if (!real && step === 3 && c?.kind !== "email") c = await services.registration.requestOtp("email", d.email);
    set({ draft: { ...d, step }, challenge: c, error: "" });
    if (step === 4) setCompanyName(d.companyName);
    requestAnimationFrame(() => (document.querySelector<HTMLElement>(focusSelector || "#employer-registration-form input") ?? undefined)?.focus());
  };

  const fail = (message: string) => toast(message, "error");

  const verify = async (kind: "whatsapp" | "email", target: string) => {
    const code = readOtpCode(formRef.current);
    const c = useRegistration.getState().challenge;
    if (!c || c.kind !== kind) {
      fail("Request a new OTP to continue.");
      return false;
    }
    const checked = otpSchema.safeParse({ code });
    if (!checked.success) { setErrors({ code: checked.error.issues[0].message }); return false; }
    if (kind === "whatsapp" && (!Number.isFinite(c.expiresAt) || Date.now() >= c.expiresAt)) {
      setErrors({ code: "This code has expired. Request a new code." });
      return false;
    }
    if (real) {
      if (!intentId) { fail("Start with your mobile number again."); return false; }
      await services.auth.employerVerify(intentId, { challenge_id: c.id, code });
      return true;
    }
    const result = await services.registration.verifyOtp(c.id, target, code);
    if (!result.ok) fail(result.error);
    return result.ok;
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busyRef.current) return;
    const d = collect();
    const formValues = new FormData(e.currentTarget);
    const password = String(formValues.get("password") || "");
    const schema = d.step === 0 ? employerMobileSchema : d.step === 2 ? employerDetailsSchema : d.step === 4 ? employerCompanySchema : otpSchema;
    const checked = schema.safeParse(d.step === 1 || d.step === 3 ? { code: readOtpCode(e.currentTarget) } : { ...d, password });
    if (!checked.success) {
      const issues = Object.fromEntries(checked.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
      setErrors(issues);
      const first = String(checked.error.issues[0].path[0]);
      e.currentTarget.querySelector<HTMLElement>(first === "code" ? '[name="otp-0"]' : `[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});
    busyRef.current = true;
    setBusy(true);
    try {
    set({ draft: d });
    const phone = phoneE164(d.country, d.mobile);
    switch (d.step) {
      case 0: {
        if (!validMobile(d.country, d.mobile)) return fail("Enter a valid mobile number for the selected country, using digits only.");
        let c: OtpChallenge;
        if (real) {
          const started = await services.auth.startEmployer({ country: d.country, mobile: d.mobile });
          set({ intentId: started.intent_id });
          c = challengeView(started.challenge, phone);
        } else c = await services.registration.requestOtp("whatsapp", phone);
        set({ phoneVerified: "", emailVerified: "", challenge: c });
        return go(1);
      }
      case 1:
        if (await verify("whatsapp", phone)) {
          set({ phoneVerified: phone });
          await go(2);
        }
        return;
      case 2: {
        if (phoneVerified !== phone) return fail("Verify your mobile number first.");
        if (!["company", "individual"].includes(d.accountType) || d.fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) || password.length < 8) return fail("Add your full name, a valid email, and a password of at least 8 characters.");
        const email = d.email.toLowerCase();
        if (real && !intentId) return fail("Start with your mobile number again.");
        const c = real ? challengeView(await services.auth.employerDetails(intentId!, { full_name: d.fullName.trim(), email, password, account_type: d.accountType }), email) : await services.registration.requestOtp("email", email);
        set({ draft: { ...d, email, step: 3 }, emailVerified: "", challenge: c, error: "" });
        requestAnimationFrame(() => document.querySelector<HTMLElement>("#employer-registration-form input")?.focus());
        return;
      }
      case 3:
        if (await verify("email", d.email)) {
          set({ emailVerified: d.email });
          await go(4);
        }
        return;
      case 4: {
        const company = employerCompanySchema.parse(d);
        if (phoneVerified !== phone || emailVerified !== d.email) return fail("Verify your mobile number and email ID before creating an account.");
        if (real) {
          if (!intentId) return fail("Start with your mobile number again.");
          await services.auth.employerFinalize(intentId, { company_name: company.companyName, industry: company.industry, employees: company.employees, designation: company.designation, hiring_for: company.hiringFor, pincode: company.pincode, address: company.address });
          cache.clear();
          set({ intentId: null, draft: EMPTY, challenge: null, phoneVerified: "", emailVerified: "", error: "" });
          router.push("/recruiter/dashboard");
          return;
        }
        const result = await run((s) => s.registration.registerEmployer({ ...d }));
        if (!result) return;
        if (!result.ok) return fail(result.error);
        resetOrganizationDrafts();
        set({ draft: EMPTY, challenge: null, phoneVerified: "", emailVerified: "", error: "" });
        router.push("/recruiter/profile");
        toast(devCopy("Demo recruiter account created. Review your profile.", "Your recruiter account is ready. Review your profile."));
      }
    }
    } catch (error) {
      const names: Record<string, string> = { full_name: "fullName", account_type: "accountType", company_name: "companyName", hiring_for: "hiringFor" };
      const fields = Object.fromEntries(Object.entries(fieldErrors(error)).map(([key, messages]) => [names[key] || key, messages[0]]));
      toast(Object.values(fields)[0] || errorMessage(error), "error");
    } finally { busyRef.current = false; setBusy(false); }
  };

  const resend = async () => {
    const d = useRegistration.getState().draft;
    const c = useRegistration.getState().challenge;
    if (![1, 3].includes(d.step) || !c || Date.now() - c.sentAt < OTP_RESEND_AFTER_MS) return;
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const kind = d.step === 1 ? "whatsapp" : "email";
      const target = kind === "whatsapp" ? phoneE164(d.country, d.mobile) : d.email;
      if (real && !intentId) return fail("Start with your mobile number again.");
      const next = real ? challengeView(await services.auth.employerResend(intentId!, kind), target) : await services.registration.requestOtp(kind, target);
      set({ challenge: next, error: "" });
    } catch (error) { fail(errorMessage(error)); }
    finally { busyRef.current = false; setBusy(false); }
    document.querySelector<HTMLElement>('[data-otp-index="0"]')?.focus();
  };

  const editMobile = () => {
    set({ phoneVerified: "", emailVerified: "", challenge: null });
    void go(0);
  };
  const editEmail = () => {
    set({ emailVerified: "" });
    void go(2, "input[name=email]");
  };

  const step = draft.step;
  const demoCode = (kind: string) => (
    <DevOnly>
      {!real &&
      <p className="er-demo">
        Demo verification · No {kind} is sent. Enter <strong data-demo-code>{challenge?.demoCode || ""}</strong> to continue.
      </p>
      }
    </DevOnly>
  );

  return (
    <main id="main" className="auth-page er-page is-employer-registration">
      <AuthHeader />
      <div className="auth-workspace-layout">
        <AuthStory employer />
        <section className="card er-panel">
          <header className="er-stage-header">
            <span>STEP {step + 1} OF 5</span>
            <h1>{TITLES[step]}</h1>
          </header>
          <form id="employer-registration-form" className="er-form" data-step={step} ref={formRef} onSubmit={submit} key={step} noValidate onInput={(event) => { const name = (event.target as HTMLInputElement).name; setErrors((previous) => ({ ...previous, [name]: "" })); }}>
            {step === 0 && (
              <>
                <p className="er-lead">Use your WhatsApp number to get started.</p>
                <div className="er-phone-grid">
                  <CountryCodeField name="country" error={errors.country} required defaultValue={draft.country} />
                  <TextField label="Mobile number" name="mobile" error={errors.mobile} type="tel" defaultValue={draft.mobile} required inputMode="numeric" autoComplete="tel-national" maxLength={15} placeholder="Enter mobile number" />
                </div>
                <p className="er-hint">Choose your country code and enter a number you use on WhatsApp.</p>
              </>
            )}
            {step === 1 && (
              <>
                <p className="er-lead">
                  Check WhatsApp for the verification code for <strong>{maskedPhone(draft)}</strong>
                </p>
                <button type="button" className="er-text" onClick={editMobile}>
                  Edit mobile number <Icon name="edit" />
                </button>
                <OtpFields error={errors.code} />
                <OtpExpiry expiresAt={challenge?.expiresAt ?? null} />
                <OtpResend sentAt={challenge?.sentAt ?? null} onResend={resend} />
                {demoCode("WhatsApp")}
              </>
            )}
            {step === 2 && (
              <>
                
                <p className="er-verified">
                  <Icon name="check" />
                  Mobile: {maskedPhone(draft)}
                  <button type="button" className="er-text" onClick={editMobile}>
                    Edit
                  </button>
                </p>
                <Choice
                  name="accountType"
                  value={draft.accountType}
                  options={[
                    ["company", "Company/business"],
                    ["individual", "Individual/proprietor"],
                  ]}
                />
                <div className="er-grid is-stacked">
                  <div className="er-field-group">
                    <TextField label="Full name" name="fullName" error={errors.fullName} defaultValue={draft.fullName} required minLength={2} maxLength={100} autoComplete="name" placeholder="Name as per PAN" />
                    <p className="er-field-hint">Name as per PAN</p>
                  </div>
                  <TextField label="Official email ID" name="email" error={errors.email} type="email" defaultValue={draft.email} required maxLength={254} autoComplete="email" placeholder="Enter email ID" />
                </div>
                <TextField label="Create password" name="password" error={errors.password} type="password" required minLength={8} maxLength={256} autoComplete="new-password" placeholder="Enter new password" />
                <p className="er-hint">{apiConfig.dataSource === "mock" ? devCopy("At least 8 characters. Passwords are not saved in this demo.", "At least 8 characters.") : "At least 8 characters."}</p>
              </>
            )}
            {step === 3 && (
              <>
                <p className="er-lead">
                  We have sent an OTP to your email ID
                  <br />
                  <strong>{maskedEmail(draft)}</strong>
                </p>
                <button type="button" className="er-text" onClick={editEmail}>
                  Edit email ID <Icon name="edit" />
                </button>
                <OtpFields error={errors.code} />
                <OtpResend sentAt={challenge?.sentAt ?? null} onResend={resend} />
                {demoCode("email")}
              </>
            )}
            {step === 4 && (
              <>
                <p className="er-lead">We use this information to know about the company you’re hiring for and to generate an invoice.</p>
                <Choice
                  name="hiringFor"
                  value={draft.hiringFor}
                  options={[
                    ["company", "Your company"],
                    ["consultancy", "A consultancy"],
                  ]}
                />
                <TextField label="Company" name="companyName" error={errors.companyName} defaultValue={draft.companyName} required maxLength={150} autoComplete="organization" placeholder="Enter company name" onInput={(e) => setCompanyName(e.currentTarget.value)} />
                <div id="er-company-extra" className="er-grid" hidden={!companyName.trim()}>
                  <SelectField label="Industry" name="industry" error={errors.industry} defaultValue={draft.industry} required={!!companyName.trim()} options={[{ value: "", label: "Select industry" }, ...EMPLOYER_INDUSTRIES]} />
                  <SelectField label="Number of employees" name="employees" error={errors.employees} defaultValue={draft.employees} required={!!companyName.trim()} options={[{ value: "", label: "Select range" }, ...EMPLOYER_SIZES]} />
                </div>
                <div className="er-grid">
                  <TextField label="Your designation" name="designation" error={errors.designation} defaultValue={draft.designation} required maxLength={100} autoComplete="organization-title" placeholder="Enter designation" />
                  <TextField label="Pin code" name="pincode" error={errors.pincode} defaultValue={draft.pincode} required maxLength={10} autoComplete="postal-code" placeholder="Enter company pincode" />
                </div>
                <TextAreaField label="Company address" name="address" error={errors.address} defaultValue={draft.address} required minLength={8} maxLength={500} autoComplete="street-address" placeholder="Enter company address" />
                {!real && <DevOnly>
                  <p className="er-hint">Company details are saved locally in this prototype. No invoice is generated.</p>
                </DevOnly>}
              </>
            )}
            <footer className="er-actions">
              {step ? (
                <Button type="button" disabled={busy} onClick={() => go(real && step === 4 ? 2 : real && step === 2 ? 0 : Math.max(0, step - 1))}>
                  <Icon name="arrow" />
                  Back
                </Button>
              ) : (
                <Link className="er-text" href="/employer/login">
                  Already registered? Login
                </Link>
              )}
              <Button loading={busy} loadingLabel="Please wait" variant="primary" type="submit" disabled={busy}>
                {step === 4 ? "Create account" : step === 1 || step === 3 ? "Verify & continue" : step === 0 ? "Submit" : "Continue"}
                <Icon name="arrow" />
              </Button>
            </footer>
          </form>
        </section>
      </div>
    </main>
  );
}
