"use client";

import { MediaVideo } from "@/components/ui/media-video";
import { MediaImage } from "@/components/ui/media-image";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import type { MediaItem } from "@/types/domain";
import { isInlineImage, isSafeMediaSrc } from "@/lib/utils/url";
import { Icon } from "@/components/ui/icon";
import { isPdfAttachment } from "@/lib/media/pdf-document";
import {
  DEFAULT_MEDIA_ASPECT,
  mediaAspectLayout,
  type MediaAspectLayout,
} from "@/lib/media/media-aspect";
import {
  PostDocumentViewer,
  type DocumentPageNav,
} from "@/components/feed/post-document-viewer";

const isSafe = (m: MediaItem, localPreview: boolean) =>
  m.type === "image"
    ? (localPreview && m.src.startsWith("blob:")) ||
      isInlineImage(m.src) ||
      /^https?:\/\//i.test(m.src)
    : isSafeMediaSrc(m.src);

const placeholderLayout = mediaAspectLayout(16, 9);

/**
 * One carousel image with its own lifecycle: skeleton while loading, retry after a failure.
 * The blurred copy fills the frame behind the full, uncropped image.
 */
function CarouselImage({
  src,
  alt,
  onAspect,
}: {
  src: string;
  alt: string;
  onAspect?: (layout: MediaAspectLayout) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const onAspectRef = useRef(onAspect);
  onAspectRef.current = onAspect;
  const report = (image: HTMLImageElement) => {
    if (image.naturalWidth > 0 && image.naturalHeight > 0)
      onAspectRef.current?.(
        mediaAspectLayout(image.naturalWidth, image.naturalHeight),
      );
  };
  if (failed)
    return (
      <span className="post-media-failed" role="img" aria-label={alt}>
        <Icon name="alert" />
        <span>This image couldn’t load.</span>
        <button
          type="button"
          data-carousel-control
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      </span>
    );
  return (
    <span className="post-media-frame" key={attempt}>
      <MediaImage
        className="post-carousel-backdrop"
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        fallback={null}
      />
      <MediaImage
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={(event) => report(event.currentTarget)}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

/** Multi-media post carousel: arrows, dots, ←/→ keys and touch swipe (prototype `postCarousel`). */
export function PostCarousel({
  items,
  id,
  localPreview = false,
}: {
  items: MediaItem[];
  id: string;
  localPreview?: boolean;
}) {
  const media = items.filter((item) => isSafe(item, localPreview));
  const [index, setIndex] = useState(0);
  // Slides stay mounted once shown, so returning to one never reloads it or shows a skeleton again.
  const [seen, setSeen] = useState<string[]>([]);
  const [layouts, setLayouts] = useState<Record<string, MediaAspectLayout>>({});
  const root = useRef<HTMLElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const wheelTime = useRef(0);
  const docNav = useRef<DocumentPageNav | null>(null);
  const [docPages, setDocPages] = useState(0);
  const onDocNav = useCallback((nav: DocumentPageNav | null) => {
    docNav.current = nav;
    setDocPages(nav?.pages ?? 0);
  }, []);
  const setSlideAspect = useCallback((src: string, layout: MediaAspectLayout) => {
    setLayouts((prev) => {
      const existing = prev[src];
      if (
        existing &&
        existing.aspect === layout.aspect &&
        existing.orientation === layout.orientation
      )
        return prev;
      return { ...prev, [src]: layout };
    });
  }, []);
  if (!media.length) return null;
  const current = Math.min(index, media.length - 1);
  const active = media[current];
  const activeLayout = layouts[active.src] ?? placeholderLayout;
  const activePdf = active.type === "document" && isPdfAttachment(active);
  const pageMode = activePdf && docPages > 1;
  const moveMedia = (value: number, absolute = false) => {
    const next =
      ((absolute ? value : current + value) + media.length) % media.length;
    root.current?.querySelectorAll("video").forEach((v) => v.pause());
    setSeen((list) =>
      list.includes(active.src) ? list : [...list, active.src],
    );
    setIndex(next);
  };
  const move = (delta: number) => {
    if (pageMode && docNav.current) {
      const { page, pages } = docNav.current;
      if (delta < 0 && page > 1) {
        docNav.current.move(-1);
        return;
      }
      if (delta > 0 && page < pages) {
        docNav.current.move(1);
        return;
      }
      if (media.length > 1) moveMedia(delta);
      return;
    }
    if (media.length > 1) moveMedia(delta);
  };
  const mounted = media.filter((m) => m === active || seen.includes(m.src));
  const showMediaArrows = media.length > 1 && !pageMode;
  return (
    <section
      ref={root}
      className={
        "post-carousel" + (active.type === "document" ? " has-document" : "")
      }
      data-carousel={id}
      tabIndex={0}
      role="region"
      aria-label="Post media. Use left and right arrow keys."
      onWheel={(event) => {
        const delta = event.shiftKey ? event.deltaY : event.deltaX;
        if (
          Math.abs(delta) < 20 ||
          (!event.shiftKey && Math.abs(event.deltaY) > Math.abs(delta)) ||
          Date.now() - wheelTime.current < 350
        )
          return;
        wheelTime.current = Date.now();
        move(delta > 0 ? 1 : -1);
      }}
      onKeyDown={(e) => {
        if (
          !["ArrowLeft", "ArrowRight"].includes(e.key) ||
          (e.target as Element).matches("input,textarea,select,video")
        )
          return;
        e.preventDefault();
        move(e.key === "ArrowLeft" ? -1 : 1);
      }}
      onPointerDown={(e) => {
        if (
          e.pointerType === "touch" &&
          !(e.target as Element).closest("video, .post-doc-viewer")
        )
          start.current = { x: e.clientX, y: e.clientY };
        if (
          e.pointerType === "touch" &&
          (e.target as Element).closest(".post-doc-stage")
        )
          start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        if (!start.current) return;
        const dx = e.clientX - start.current.x;
        if (
          Math.abs(dx) > 45 &&
          Math.abs(dx) > Math.abs(e.clientY - start.current.y)
        )
          move(dx < 0 ? 1 : -1);
        start.current = null;
      }}
      onPointerCancel={() => (start.current = null)}
    >
      <div className="post-carousel-stage">
        <div
          className="post-carousel-frame"
          data-orientation={activeLayout.orientation}
          style={
            {
              "--media-aspect": String(
                activeLayout.aspect || DEFAULT_MEDIA_ASPECT,
              ),
              "--media-aspect-ratio": activeLayout.aspectRatio,
            } as CSSProperties
          }
        >
          {mounted.map((m) => (
            <figure
              className="post-carousel-slide"
              key={m.src}
              hidden={m !== active}
              aria-hidden={m !== active || undefined}
            >
              {m.type === "video" ? (
                <MediaVideo
                  controls
                  playsInline
                  preload="metadata"
                  src={m.src}
                  aria-label={m.alt || m.name || "Post video"}
                  onLoadedMetadata={(event) => {
                    const video = event.currentTarget;
                    if (video.videoWidth > 0 && video.videoHeight > 0)
                      setSlideAspect(
                        m.src,
                        mediaAspectLayout(video.videoWidth, video.videoHeight),
                      );
                  }}
                />
              ) : m.type === "document" ? (
                <PostDocumentViewer
                  item={m}
                  active={m === active}
                  onNavChange={m === active ? onDocNav : undefined}
                  onAspect={
                    m === active
                      ? (width, height) =>
                          setSlideAspect(m.src, mediaAspectLayout(width, height))
                      : undefined
                  }
                />
              ) : (
                <CarouselImage
                  src={m.src}
                  alt={m.alt || "Post image " + (media.indexOf(m) + 1)}
                  onAspect={
                    m === active
                      ? (layout) => setSlideAspect(m.src, layout)
                      : undefined
                  }
                />
              )}
            </figure>
          ))}
        </div>
        {showMediaArrows && (
          <>
            <button
              type="button"
              className="post-carousel-arrow previous"
              data-carousel-control
              aria-label="Previous media"
              onClick={() => moveMedia(-1)}
            >
              <Icon name="chevron" />
            </button>
            <button
              type="button"
              className="post-carousel-arrow next"
              data-carousel-control
              aria-label="Next media"
              onClick={() => moveMedia(1)}
            >
              <Icon name="chevron" />
            </button>
          </>
        )}
      </div>
      {media.length > 1 && active.type === "document" && (
        <div className="post-carousel-navigation is-document">
          <span className="post-carousel-count" aria-live="polite">
            {current + 1} / {media.length}
          </span>
          <label className="post-carousel-scrub">
            <span className="sr-only">Media position</span>
            <input
              type="range"
              min={0}
              max={media.length - 1}
              step={1}
              value={current}
              data-carousel-control
              aria-valuetext={`Media ${current + 1} of ${media.length}`}
              onChange={(event) =>
                moveMedia(Number(event.currentTarget.value), true)
              }
            />
          </label>
          {activePdf ? (
            <button
              type="button"
              className="post-carousel-expand"
              data-carousel-control
              aria-label="Expand document"
              title="Expand document"
              onClick={() => {
                root.current
                  ?.querySelector<HTMLButtonElement>(
                    ".post-carousel-slide:not([hidden]) .post-doc-expand",
                  )
                  ?.click();
              }}
            >
              <Icon name="expand" />
            </button>
          ) : (
            <span className="post-carousel-expand-spacer" aria-hidden="true" />
          )}
          <div className="post-carousel-dots">
            {media.map((_, i) => (
              <button
                type="button"
                key={i}
                data-carousel-control
                aria-label={"Show media " + (i + 1)}
                aria-pressed={i === current}
                className={i === current ? "active" : ""}
                onClick={() => moveMedia(i, true)}
              />
            ))}
          </div>
        </div>
      )}
      {media.length > 1 && active.type !== "document" && (
        <div className="post-carousel-navigation">
          <div className="post-carousel-dots">
            {media.map((_, i) => (
              <button
                type="button"
                key={i}
                data-carousel-control
                aria-label={"Show media " + (i + 1)}
                aria-pressed={i === current}
                className={i === current ? "active" : ""}
                onClick={() => moveMedia(i, true)}
              />
            ))}
          </div>
          <span className="post-carousel-count sr-only" aria-live="polite">
            {current + 1} / {media.length}
          </span>
        </div>
      )}
      {media.length === 1 && activePdf && (
        <div className="post-carousel-navigation is-document is-single">
          <span className="post-carousel-count sr-only" aria-live="polite">
            1 / 1
          </span>
          <span className="post-carousel-scrub" aria-hidden="true" />
          <button
            type="button"
            className="post-carousel-expand"
            data-carousel-control
            aria-label="Expand document"
            title="Expand document"
            onClick={() => {
              root.current
                ?.querySelector<HTMLButtonElement>(".post-doc-expand")
                ?.click();
            }}
          >
            <Icon name="expand" />
          </button>
        </div>
      )}
    </section>
  );
}
