"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import type { OtpChallenge } from "@/services/registration/registration.service";
import { OTP_RESEND_AFTER_MS } from "@/services/registration/registration.service";
import { EMPLOYER_INDUSTRIES, EMPLOYER_SIZES, PHONE_COUNTRIES, validMobile, validPincode } from "@/lib/validation/auth";
import { useServiceAction, useServices } from "@/hooks/use-services";
import { toast } from "@/stores/toast-store";
import { resetOrganizationDrafts } from "@/features/organization/draft-store";
import { Icon } from "@/components/ui/icon";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { IconButton } from "@/components/ui/primitives";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { AuthHeader, AuthStory } from "@/components/layout/auth-chrome";

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

const EMPTY: Draft = { step: 0, country: "+91", mobile: "", accountType: "company", fullName: "", email: "", hiringFor: "company", companyName: "", industry: "", employees: "", designation: "", pincode: "", address: "" };
const TITLES = ["Continue with mobile", "Verify mobile number", "Your basic details", "Verify email ID", "Company details"];

/** In-memory registration progress (kept while navigating within the session, as in the prototype). */
const useRegistration = create<{ draft: Draft; challenge: OtpChallenge | null; phoneVerified: string; emailVerified: string; error: string; set: (p: Partial<{ draft: Draft; challenge: OtpChallenge | null; phoneVerified: string; emailVerified: string; error: string }>) => void }>((set) => ({
  draft: EMPTY,
  challenge: null,
  phoneVerified: "",
  emailVerified: "",
  error: "",
  set: (p) => set(p),
}));

const maskedPhone = (d: Draft) => d.country + " " + "*".repeat(Math.max(4, d.mobile.length - 4)) + d.mobile.slice(-4);
const maskedEmail = (d: Draft) => {
  const [local = "", domain = ""] = d.email.split("@");
  return local.slice(0, 2) + "*".repeat(Math.max(4, local.length - 2)) + "@" + domain;
};

function OtpFields() {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => refs.current[Math.max(0, Math.min(5, i))]?.focus();
  const onPaste = (e: ClipboardEvent<HTMLInputElement>, start: number) => {
    e.preventDefault();
    const digits = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    for (let i = start; i < 6; i++) if (refs.current[i]) refs.current[i]!.value = digits[i - start] || "";
    focus(start + digits.length);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + (e.key === "ArrowLeft" ? -1 : 1));
    }
    if (e.key === "Backspace" && !e.currentTarget.value && i > 0) focus(i - 1);
  };
  return (
    <fieldset className="er-otp" data-no-floating-label>
      <legend>Enter the 6-digit OTP</legend>
      <div>
        {Array.from({ length: 6 }, (_, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            name={"otp-" + i}
            type="text"
            inputMode="numeric"
            pattern="[0-9]"
            maxLength={1}
            required
            aria-label={"OTP digit " + (i + 1)}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            data-otp-index={i}
            onInput={(e) => {
              const el = e.currentTarget;
              el.value = el.value.replace(/\D/g, "").slice(-1);
              if (el.value && i < 5) focus(i + 1);
            }}
            onPaste={(e) => onPaste(e, i)}
            onKeyDown={(e) => onKey(e, i)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Resend({ challenge, onResend }: { challenge: OtpChallenge | null; onResend: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = challenge ? Math.max(0, Math.ceil((challenge.sentAt + OTP_RESEND_AFTER_MS - now) / 1000)) : 0;
  return (
    <div className="er-resend">
      Didn&apos;t receive it?{" "}
      <button type="button" className="er-text" disabled={seconds > 0} onClick={onResend}>
        Resend OTP
      </button>
      <span id="er-resend-clock" aria-live="off">
        {seconds ? "Resend in " + String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0") : ""}
      </span>
    </div>
  );
}

function Choice({ name, options, value }: { name: "accountType" | "hiringFor"; options: [string, string][]; value: string }) {
  return (
    <fieldset className="er-choice">
      <legend>{name === "accountType" ? "You’re creating account as" : "Hiring for"}</legend>
      {options.map(([id, label]) => (
        <label key={id}>
          <input type="radio" name={name} value={id} defaultChecked={id === value} required />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

/** Five-step employer registration with DEMO OTP verification (codes are shown on screen). */
export function EmployerRegistrationScreen() {
  const services = useServices();
  const run = useServiceAction();
  const router = useRouter();
  const { draft, challenge, phoneVerified, emailVerified, error, set } = useRegistration();
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState(draft.companyName);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [error]);

  const collect = (): Draft => {
    const next = { ...useRegistration.getState().draft };
    const form = formRef.current;
    if (!form) return next;
    const f = new FormData(form);
    for (const key of Object.keys(next) as (keyof Draft)[]) if (key !== "step" && f.has(key)) (next as Record<string, unknown>)[key] = String(f.get(key) || "").trim();
    return next;
  };

  const go = async (step: number, focusSelector?: string, collectFirst = true) => {
    const d = collectFirst ? collect() : { ...useRegistration.getState().draft };
    let c = useRegistration.getState().challenge;
    if (step === 1 && c?.kind !== "sms") c = await services.registration.requestOtp("sms", d.country + d.mobile);
    if (step === 3 && c?.kind !== "email") c = await services.registration.requestOtp("email", d.email);
    set({ draft: { ...d, step }, challenge: c, error: "" });
    if (step === 4) setCompanyName(d.companyName);
    requestAnimationFrame(() => (document.querySelector<HTMLElement>(focusSelector || "#employer-registration-form input") ?? undefined)?.focus());
  };

  const fail = (message: string) => set({ error: message });

  const verify = async (kind: "sms" | "email", target: string) => {
    const f = new FormData(formRef.current!);
    const code = Array.from({ length: 6 }, (_, i) => String(f.get("otp-" + i) || "")).join("");
    const c = useRegistration.getState().challenge;
    if (!c || c.kind !== kind) {
      fail("Request a new OTP to continue.");
      return false;
    }
    const result = await services.registration.verifyOtp(c.id, target, code);
    if (!result.ok) fail(result.error);
    return result.ok;
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!e.currentTarget.reportValidity()) return;
    const d = collect();
    set({ draft: d });
    const phone = d.country + d.mobile;
    switch (d.step) {
      case 0: {
        if (!validMobile(d.country, d.mobile)) return fail("Enter a valid mobile number for the selected country, using digits only.");
        const c = await services.registration.requestOtp("sms", phone);
        set({ phoneVerified: "", emailVerified: "", challenge: c });
        return go(1);
      }
      case 1:
        if (await verify("sms", phone)) {
          set({ phoneVerified: phone });
          await go(2);
        }
        return;
      case 2: {
        if (phoneVerified !== phone) return fail("Verify your mobile number first.");
        const password = String(new FormData(formRef.current!).get("password") || "");
        if (!["company", "individual"].includes(d.accountType) || d.fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) || password.length < 8) return fail("Add your full name, a valid email, and a password of at least 8 characters.");
        const email = d.email.toLowerCase();
        const c = await services.registration.requestOtp("email", email);
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
        if (!d.companyName || !EMPLOYER_INDUSTRIES.includes(d.industry) || !EMPLOYER_SIZES.includes(d.employees) || !d.designation || d.address.length < 8 || !["company", "consultancy"].includes(d.hiringFor)) return fail("Complete the company name, industry, employee range, designation, and address.");
        if (!validPincode(d.country, d.pincode)) return fail(d.country === "+91" ? "Enter a valid 6-digit pin code." : "Enter a valid company postal code.");
        if (phoneVerified !== phone || emailVerified !== d.email) return fail("Verify your mobile number and email ID before creating an account.");
        const result = await run((s) => s.registration.registerEmployer({ ...d }));
        if (!result) return;
        if (!result.ok) return fail(result.error);
        resetOrganizationDrafts();
        set({ draft: EMPTY, challenge: null, phoneVerified: "", emailVerified: "", error: "" });
        router.push("/recruiter/profile");
        toast(devCopy("Demo recruiter account created. Review your profile.", "Your recruiter account is ready. Review your profile."));
      }
    }
  };

  const resend = async () => {
    const d = useRegistration.getState().draft;
    const c = useRegistration.getState().challenge;
    if (![1, 3].includes(d.step) || !c || Date.now() - c.sentAt < OTP_RESEND_AFTER_MS) return;
    set({ challenge: await services.registration.requestOtp(d.step === 1 ? "sms" : "email", d.step === 1 ? d.country + d.mobile : d.email) });
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
      <p className="er-demo">
        Demo verification · No {kind} is sent. Enter <strong data-demo-code>{challenge?.demoCode || ""}</strong> to continue.
      </p>
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
          <form id="employer-registration-form" className="er-form" data-step={step} ref={formRef} onSubmit={submit} key={step} noValidate={false}>
            {step === 0 && (
              <>
                <p className="er-lead">Use your mobile number to get started.</p>
                <div className="er-phone-grid">
                  <SelectField label="Country code" name="country" required defaultValue={draft.country} options={PHONE_COUNTRIES.map((c) => ({ value: c.code, label: c.name + " (" + c.code + ")" }))} />
                  <TextField label="Mobile number" name="mobile" type="tel" defaultValue={draft.mobile} required inputMode="numeric" autoComplete="tel-national" maxLength={15} placeholder="Enter mobile number" />
                </div>
                <p className="er-hint">Choose your country code and enter your mobile number.</p>
              </>
            )}
            {step === 1 && (
              <>
                <p className="er-lead">
                  Enter the OTP sent to SMS on <strong>{maskedPhone(draft)}</strong>
                </p>
                <button type="button" className="er-text" onClick={editMobile}>
                  Edit mobile number <Icon name="edit" />
                </button>
                <OtpFields />
                <Resend challenge={challenge} onResend={resend} />
                {demoCode("SMS")}
              </>
            )}
            {step === 2 && (
              <>
                <p className="er-lead">
                  We need these details to identify you
                  <br />
                  and create your account
                </p>
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
                <div className="er-grid">
                  <div className="er-field-group">
                    <TextField label="Full name" name="fullName" defaultValue={draft.fullName} required minLength={2} maxLength={100} autoComplete="name" placeholder="Name as per PAN" />
                    <p className="er-field-hint">Name as per PAN</p>
                  </div>
                  <TextField label="Official email ID" name="email" type="email" defaultValue={draft.email} required maxLength={150} autoComplete="email" placeholder="Enter email ID" />
                </div>
                <div className="er-password">
                  <TextField label="Create password" name="password" type={showPassword ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Enter new password" />
                  <IconButton icon="eye" label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)} />
                </div>
                <p className="er-hint">{devCopy("At least 8 characters. Passwords are not saved in this demo.", "At least 8 characters.")}</p>
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
                <OtpFields />
                <Resend challenge={challenge} onResend={resend} />
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
                <TextField label="Company" name="companyName" defaultValue={draft.companyName} required maxLength={150} autoComplete="organization" placeholder="Enter company name" onInput={(e) => setCompanyName(e.currentTarget.value)} />
                <div id="er-company-extra" className="er-grid" hidden={!companyName.trim()}>
                  <SelectField label="Industry" name="industry" defaultValue={draft.industry} required={!!companyName.trim()} options={[{ value: "", label: "Select industry" }, ...EMPLOYER_INDUSTRIES]} />
                  <SelectField label="Number of employees" name="employees" defaultValue={draft.employees} required={!!companyName.trim()} options={[{ value: "", label: "Select range" }, ...EMPLOYER_SIZES]} />
                </div>
                <div className="er-grid">
                  <TextField label="Your designation" name="designation" defaultValue={draft.designation} required maxLength={100} autoComplete="organization-title" placeholder="Enter designation" />
                  <TextField label="Pin code" name="pincode" defaultValue={draft.pincode} required maxLength={10} autoComplete="postal-code" placeholder="Enter company pincode" />
                </div>
                <TextAreaField label="Company address" name="address" defaultValue={draft.address} required minLength={8} maxLength={500} autoComplete="street-address" placeholder="Enter company address" />
                <DevOnly>
                  <p className="er-hint">Company details are saved locally in this prototype. No invoice is generated.</p>
                </DevOnly>
              </>
            )}
            <p id="er-error" className="er-error" role="alert" hidden={!error} ref={errorRef}>
              {error}
            </p>
            <footer className="er-actions">
              {step ? (
                <button type="button" className="btn" onClick={() => go(Math.max(0, step - 1))}>
                  <Icon name="arrow" />
                  Back
                </button>
              ) : (
                <Link className="er-text" href="/employer/login">
                  Already registered? Login
                </Link>
              )}
              <button className="btn primary" type="submit">
                {step === 4 ? "Create account" : step === 1 || step === 3 ? "Verify & continue" : step === 0 ? "Submit" : "Continue"}
                <Icon name="arrow" />
              </button>
            </footer>
          </form>
        </section>
      </div>
    </main>
  );
}
