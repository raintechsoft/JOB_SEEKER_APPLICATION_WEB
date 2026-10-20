"use client";

import { useToastStore } from "@/stores/toast-store";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div id="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.message}
        </div>
      ))}
    </div>
  );
}
