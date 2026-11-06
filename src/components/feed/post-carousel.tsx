"use client";

import { MediaVideo } from "@/components/ui/media-video";
import { MediaImage } from "@/components/ui/media-image";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { MediaItem } from "@/types/domain";
import { isInlineImage, isSafeMediaSrc } from "@/lib/utils/url";
import { Icon } from "@/components/ui/icon";
import { isPdfAttachment } from "@/lib/media/pdf-document";
import {
  DEFAULT_MEDIA_ASPECT,
  clampFeedAspect,
  mediaAspectLayout,
  type MediaAspectLayout,
} from "@/lib/media/media-aspect";
import { isPostAspectRatioId, postAspectPreset } from "@/lib/media/post-crop";
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
const SLIDE_MS = 380;

type SlideMotion = {
  partner: number;
  side: 1 | -1;
  shift: number;
  phase: "drag" | "arm" | "anim";
  commit: boolean;
};

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

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

/** Multi-media post carousel: dots, arrow keys, and a horizontal swipe (prototype `postCarousel`). */
export function PostCarousel({
  items,
  id,
  localPreview = false,
  aspect = null,
}: {
  items: MediaItem[];
  id: string;
  localPreview?: boolean;
  /**
   * Post-level ratio ("1:1", "4:5", …, or "original" = first slide's ratio). Fixes the frame for
   * every slide and before any image loads. Null keeps the legacy per-slide frame.
   */
  aspect?: string | null;
}) {
  const media = items.filter((item) => isSafe(item, localPreview));
  const [index, setIndex] = useState(0);
  // Slides stay mounted once shown, so returning to one never reloads it or shows a skeleton again.
  const [seen, setSeen] = useState<string[]>([]);
  const [layouts, setLayouts] = useState<Record<string, MediaAspectLayout>>({});
  const root = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; pointerId: number; locked: boolean } | null>(null);
  const wheelTime = useRef(0);
  const [motion, setMotion] = useState<SlideMotion | null>(null);
  const motionRef = useRef(motion);
  motionRef.current = motion;
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
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const indexRef = useRef(index);
  indexRef.current = Math.min(index, Math.max(media.length - 1, 0));
  const settle = useCallback((next: number) => {
    const list = mediaRef.current;
    const from = list[indexRef.current];
    root.current?.querySelectorAll("video").forEach((video) => video.pause());
    if (from)
      setSeen((seen) => (seen.includes(from.src) ? seen : [...seen, from.src]));
    setIndex(next);
    setMotion(null);
  }, []);
  const finishMotion = useCallback(() => {
    const running = motionRef.current;
    if (!running || running.phase !== "anim") return;
    motionRef.current = null;
    if (running.commit) settle(running.partner);
    else setMotion(null);
  }, [settle]);
  useLayoutEffect(() => {
    if (motion?.phase !== "arm") return;
    const start = () =>
      setMotion((current) =>
        current?.phase === "arm"
          ? { ...current, phase: "anim", shift: current.side === 1 ? -100 : 100 }
          : current,
      );
    // Paint the incoming photo off-screen first, then ease it in. The timeout covers
    // environments that never flush animation frames.
    const frame = requestAnimationFrame(start);
    const backup = window.setTimeout(start, 20);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(backup);
    };
  }, [motion]);
  useEffect(() => {
    if (motion?.phase !== "anim") return;
    const timer = window.setTimeout(finishMotion, SLIDE_MS + 60);
    return () => window.clearTimeout(timer);
  }, [motion, finishMotion]);
  if (!media.length) return null;
  const current = Math.min(index, media.length - 1);
  const active = media[current];
  const activeLayout = layouts[active.src] ?? placeholderLayout;
  const fixedPreset = aspect && isPostAspectRatioId(aspect) ? postAspectPreset(aspect) : null;
  // Instagram rule: the frame spans the card width and stays inside the 4:5 … 1.91:1 band.
  // Presets are in the band already; "original" and legacy per-slide frames are clamped and
  // the media covers the frame, so an extreme source is cropped rather than letterboxed.
  const frameLayout = clampFeedAspect(
    fixedPreset
      ? fixedPreset.ratio
        ? mediaAspectLayout(Math.round(fixedPreset.ratio * 10000), 10000)
        : layouts[media[0].src] ?? activeLayout
      : activeLayout,
  );
  const activePdf = active.type === "document" && isPdfAttachment(active);
  const pageMode = activePdf && docPages > 1;
  const moveMedia = (value: number, absolute = false) => {
    const next =
      ((absolute ? value : current + value) + media.length) % media.length;
    if (next === current) return;
    if (media.length < 2 || reducedMotion()) {
      settle(next);
      return;
    }
    const forward = (next - current + media.length) % media.length;
    const backward = (current - next + media.length) % media.length;
    const side: 1 | -1 = forward <= backward ? 1 : -1;
    setMotion({ partner: next, side, shift: 0, phase: "arm", commit: true });
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
  const mounted = media.filter(
    (item, itemIndex) =>
      item === active || seen.includes(item.src) || itemIndex === motion?.partner,
  );
  const canSwipe = media.length > 1 || pageMode;
  const shown = motion && motion.phase !== "drag" && motion.commit ? motion.partner : current;
  const slideShift = (itemIndex: number) => {
    if (!motion) return undefined;
    const shift =
      itemIndex === current
        ? motion.shift
        : itemIndex === motion.partner
          ? motion.side * 100 + motion.shift
          : null;
    if (shift == null) return undefined;
    return {
      transform: `translate3d(${shift}%, 0, 0)`,
      zIndex: itemIndex === motion.partner ? 2 : 1,
    } satisfies CSSProperties;
  };
  return (
    <section
      ref={root}
      className={
        "post-carousel" + (active.type === "document" ? " has-document" : "")
      }
      data-carousel={id}
      tabIndex={0}
      role="region"
      aria-label="Post media. Swipe sideways or use the arrow keys."
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
        if (!canSwipe || (e.pointerType === "mouse" && e.button !== 0)) return;
        const target = e.target as Element;
        if (target.closest("video, button, input, a, .post-doc-toolbar")) return;
        swipe.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, locked: false };
      }}
      onPointerMove={(e) => {
        const gesture = swipe.current;
        if (!gesture || gesture.pointerId !== e.pointerId || pageMode || media.length < 2) return;
        const dx = e.clientX - gesture.x;
        const dy = e.clientY - gesture.y;
        if (!gesture.locked) {
          if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
          if (Math.abs(dy) > Math.abs(dx)) {
            swipe.current = null;
            return;
          }
          gesture.locked = true;
          try {
            root.current?.setPointerCapture(e.pointerId);
          } catch {
            /* The pointer can already be gone; the swipe still completes on pointerup. */
          }
        }
        const width = frameRef.current?.clientWidth || 1;
        const ratio = Math.max(-1, Math.min(1, dx / width));
        if (ratio === 0) return;
        const side: 1 | -1 = ratio < 0 ? 1 : -1;
        setMotion({
          partner: (current + side + media.length) % media.length,
          side,
          shift: ratio * 100,
          phase: "drag",
          commit: false,
        });
      }}
      onPointerUp={(e) => {
        const gesture = swipe.current;
        swipe.current = null;
        if (!gesture || gesture.pointerId !== e.pointerId) return;
        const dx = e.clientX - gesture.x;
        const dy = e.clientY - gesture.y;
        if (pageMode || media.length < 2) {
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
          return;
        }
        const running = motionRef.current;
        if (!gesture.locked || !running || running.phase !== "drag") {
          setMotion(null);
          return;
        }
        const commit = Math.abs(running.shift) > 18;
        if (!commit) {
          setMotion({ ...running, shift: 0, phase: "anim", commit: false });
          return;
        }
        if (reducedMotion()) {
          settle(running.partner);
          return;
        }
        setMotion({
          ...running,
          shift: running.side === 1 ? -100 : 100,
          phase: "anim",
          commit: true,
        });
      }}
      onPointerCancel={() => {
        swipe.current = null;
        const running = motionRef.current;
        if (running?.phase === "drag")
          setMotion({ ...running, shift: 0, phase: "anim", commit: false });
      }}
      onTransitionEnd={(event) => {
        if (event.propertyName !== "transform") return;
        if (!(event.target as Element).classList?.contains("post-carousel-slide")) return;
        finishMotion();
      }}
    >
      <div className="post-carousel-stage">
        <div
          ref={frameRef}
          className={
            "post-carousel-frame" +
            (motion ? " is-sliding" : "") +
            (motion?.phase === "drag" || motion?.phase === "arm" ? " is-dragging" : "")
          }
          data-orientation={frameLayout.orientation}
          data-fixed-aspect={fixedPreset ? fixedPreset.id : undefined}
          style={
            {
              "--media-aspect": String(
                frameLayout.aspect || DEFAULT_MEDIA_ASPECT,
              ),
              "--media-aspect-ratio": frameLayout.aspectRatio,
            } as CSSProperties
          }
        >
          {mounted.map((m) => {
            const itemIndex = media.indexOf(m);
            const onScreen = itemIndex === current || itemIndex === motion?.partner;
            return (
            <figure
              className="post-carousel-slide"
              key={m.src}
              data-slide-index={itemIndex}
              hidden={!onScreen}
              aria-hidden={!onScreen || undefined}
              style={slideShift(itemIndex)}
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
            );
          })}
        </div>
      </div>
      {media.length > 1 && active.type === "document" && (
        <div className="post-carousel-navigation is-document">
          <span className="post-carousel-count" aria-live="polite">
            {shown + 1} / {media.length}
          </span>
          <label className="post-carousel-scrub">
            <span className="sr-only">Media position</span>
            <input
              type="range"
              min={0}
              max={media.length - 1}
              step={1}
              value={shown}
              data-carousel-control
              aria-valuetext={`Media ${shown + 1} of ${media.length}`}
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
                    `.post-carousel-slide[data-slide-index="${current}"] .post-doc-expand`,
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
                aria-pressed={i === shown}
                className={i === shown ? "active" : ""}
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
                aria-pressed={i === shown}
                className={i === shown ? "active" : ""}
                onClick={() => moveMedia(i, true)}
              />
            ))}
          </div>
          <span className="post-carousel-count sr-only" aria-live="polite">
            {shown + 1} / {media.length}
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
