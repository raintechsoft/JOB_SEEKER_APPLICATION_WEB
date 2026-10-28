"use client";

import { Icon } from "@/components/ui/icon";
import { MediaImage } from "@/components/ui/media-image";
import { linkSegments, normalizeLinkUrl, type LinkPreview } from "@/lib/validation/link-preview";

const EXTERNAL_REL = "noopener noreferrer nofollow ugc";

/**
 * Compact preview for a link in a post. Used by the composer and every feed surface through
 * FeedCard. Navigation always uses the post's own URL, not the page-reported canonical URL.
 */
export function LinkPreviewCard({ preview, onRemove }: { preview: LinkPreview; onRemove?: () => void }) {
  // Stored metadata is still remote content: unsafe destinations render nothing, unsafe images no thumbnail.
  if (!normalizeLinkUrl(preview.url)) return null;
  const image = preview.imageUrl && normalizeLinkUrl(preview.imageUrl) ? preview.imageUrl : null;
  const title = preview.title || preview.siteName || preview.domain;
  const source = preview.siteName && preview.siteName.toLowerCase() !== preview.domain.toLowerCase() ? `${preview.siteName} · ${preview.domain}` : preview.domain;
  const fallback = (
    <span className="link-preview-placeholder" aria-hidden>
      <Icon name="globe" />
    </span>
  );
  return (
    <div className="link-preview-card">
      <a className="link-preview-main" href={preview.url} target="_blank" rel={EXTERNAL_REL} referrerPolicy="no-referrer">
        <span className="link-preview-thumb">
          {image ? <MediaImage src={image} alt="" referrerPolicy="no-referrer" width={1200} height={630} fallback={fallback} /> : fallback}
        </span>
        <span className="link-preview-text">
          <strong className="link-preview-title">{title}</strong>
          {preview.description && <span className="link-preview-description">{preview.description}</span>}
          <span className="link-preview-domain">
            {source}
            <span className="sr-only"> (opens in a new tab)</span>
          </span>
        </span>
      </a>
      {onRemove && (
        <button type="button" className="link-preview-remove" aria-label={`Remove link preview for ${preview.domain}`} title="Remove preview" onClick={onRemove}>
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

/** Reserved-size placeholder while metadata loads, so the composer does not shift. */
export function LinkPreviewSkeleton() {
  return (
    <div className="link-preview-card link-preview-loading" role="status" aria-live="polite">
      <span className="link-preview-thumb" />
      <span className="link-preview-text" aria-hidden>
        <span className="link-preview-line" />
        <span className="link-preview-line short" />
      </span>
      <span className="sr-only">Loading link preview</span>
    </div>
  );
}

/** Post text with every safe public URL rendered as an external link; everything else stays text. */
export function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {linkSegments(text).map((segment, i) =>
        segment.href ? (
          <a key={i} className="feed-post-link" href={segment.href} target="_blank" rel={EXTERNAL_REL} referrerPolicy="no-referrer">
            {segment.text}
          </a>
        ) : (
          segment.text
        ),
      )}
    </>
  );
}
