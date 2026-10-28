"use client";

import { LinkPreviewCard, LinkPreviewSkeleton } from "@/components/feed/link-preview-card";
import type { LinkPreviewState } from "./use-link-preview";

/** Composer slot below the text field. Unavailable and dismissed previews render nothing. */
export function ComposerLinkPreview({ state, onRemove }: { state: LinkPreviewState; onRemove: () => void }) {
  if (state.status === "loading") return <div className="post-link-preview"><LinkPreviewSkeleton /></div>;
  if (state.status !== "ready" || !state.preview) return null;
  return (
    <div className="post-link-preview">
      <LinkPreviewCard preview={state.preview} onRemove={onRemove} />
    </div>
  );
}
