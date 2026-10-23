"use client";

import { useToastStore } from "@/stores/toast-store";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div id="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={t.tone === "error" ? "toast toast-error" : "toast"} role={t.tone === "error" ? "alert" : "status"}>
          {t.tone === "error" && (
            <span className="toast-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6M12 16.5h.01" />
              </svg>
            </span>
          )}
          <p>{t.message}</p>
          {t.tone === "error" && (
            <button type="button" className="toast-dismiss" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 6 12 12M6 18 18 6" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
