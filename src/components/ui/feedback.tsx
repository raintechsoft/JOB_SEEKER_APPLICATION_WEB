"use client";

import type { ReactNode } from "react";
import { modal } from "@/stores/modal-store";
import { Button, Notice } from "./primitives";
import type { IconName } from "./icon";
import { ContentSkeleton, type SkeletonLayout } from "./skeleton";
import { ErrorState } from "./state-views";

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
export function ScreenFallback({ label = "Loading content", layout = "list" }: { label?: string; layout?: SkeletonLayout }) {
  return <ContentSkeleton label={label} layout={layout} />;
}

/** Error state for a failed service request; pass the error for status-aware copy and actions. */
export function ScreenError({ onRetry, error, compact, title, description, homeHref, homeLabel }: { onRetry?: () => void; error?: unknown; compact?: boolean; title?: string; description?: string; homeHref?: string; homeLabel?: string }) {
  return <ErrorState error={error} onRetry={onRetry} compact={compact} title={title} description={description} homeHref={homeHref} homeLabel={homeLabel} />;
}

export { Notice };
