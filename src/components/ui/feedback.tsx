"use client";

import type { ReactNode } from "react";
import { modal } from "@/stores/modal-store";
import { Button, Notice } from "./primitives";
import type { IconName } from "./icon";

/** Confirmation dialog body (prototype `confirm()`). */
export function ConfirmBody({ text, actionLabel = "Delete", icon = "trash", variant = "danger", onConfirm, textClassName = "small muted" }: { text: ReactNode; actionLabel?: string; icon?: IconName; variant?: string; onConfirm: () => void; textClassName?: string }) {
  return (
    <>
      <p className={textClassName}>{text}</p>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button variant={variant} icon={icon} onClick={onConfirm}>
          {actionLabel}
        </Button>
      </div>
    </>
  );
}

export function confirmAction(title: string, text: ReactNode, onConfirm: () => void, actionLabel = "Delete", options: { icon?: IconName; variant?: string; textClassName?: string } = {}) {
  modal.show(title, <ConfirmBody text={text} actionLabel={actionLabel} onConfirm={onConfirm} {...options} />);
}

export function FormError({ message }: { message?: string | null }) {
  return message ? <p className="error">{message}</p> : null;
}

/** Skeleton shown while browser-local data loads (store hydration). */
export function ScreenFallback({ label = "Loading your workspace…" }: { label?: string }) {
  return (
    <div className="skeleton-screen" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="skeleton-block skeleton-heading" />
      <div className="skeleton-block" />
      <div className="skeleton-block" />
      <div className="skeleton-block skeleton-short" />
    </div>
  );
}

/** Error state for a failed service request. */
export function ScreenError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="empty" role="alert">
      <h3>We couldn’t load this view.</h3>
      <p>Please try again. Your saved changes are still in this browser.</p>
      {onRetry && (
        <Button variant="primary" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export { Notice };
