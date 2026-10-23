"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { OTP_RESEND_AFTER_MS } from "@/services/registration/registration.service";

export function readOtpCode(form: HTMLFormElement | null): string {
  if (!form) return "";
  const data = new FormData(form);
  return Array.from({ length: 6 }, (_, i) => String(data.get("otp-" + i) || "")).join("");
}

export function OtpFields({ error, legend = "Enter the 6-digit OTP" }: { error?: string; legend?: string }) {
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
    <fieldset className="er-otp" data-no-floating-label aria-describedby={error ? "otp-code-error" : undefined} aria-invalid={!!error}>
      <legend>{legend}</legend>
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
      {error && (
        <p id="otp-code-error" role="alert" className="auth-field-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function OtpResend({ sentAt, onResend, disabled = false, label = "Resend OTP" }: { sentAt: number | null; onResend: () => void; disabled?: boolean; label?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = sentAt ? Math.max(0, Math.ceil((sentAt + OTP_RESEND_AFTER_MS - now) / 1000)) : 0;
  return (
    <div className="er-resend">
      Didn&apos;t receive it?{" "}
      <button type="button" className="er-text" disabled={disabled || seconds > 0} onClick={onResend}>
        {label}
      </button>
      <span id="er-resend-clock" aria-live="polite">
        {seconds ? "Resend in " + String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0") : ""}
      </span>
    </div>
  );
}
