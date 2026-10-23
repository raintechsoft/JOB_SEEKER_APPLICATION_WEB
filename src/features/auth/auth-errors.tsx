import type { ReactNode } from "react";

export function AuthError({ name, message }: { name: string; message?: string }) {
  return message ? <p id={`auth-error-${name}`} className="auth-field-error" role="alert">{message}</p> : null;
}

/** Field message sits in the gap under the control, so showing it does not move the form. */
export function AuthField({ name, message, children }: { name: string; message?: string; children: ReactNode }) {
  return (
    <div className="auth-field">
      {children}
      <AuthError name={name} message={message} />
    </div>
  );
}
