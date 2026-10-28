"use client";

import { MediaVideo } from "@/components/ui/media-video";
import { MediaImage } from "@/components/ui/media-image";

import { useRef, useState } from "react";
import type { MediaItem } from "@/types/domain";
import { isInlineImage, isSafeMediaSrc } from "@/lib/utils/url";
import { Icon } from "@/components/ui/icon";

const isSafe = (m: MediaItem, localPreview: boolean) =>
  m.type === "image"
    ? (localPreview && m.src.startsWith("blob:")) ||
      isInlineImage(m.src) ||
      /^https?:\/\//i.test(m.src)
    : isSafeMediaSrc(m.src);

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
  const root = useRef<HTMLElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const wheelTime = useRef(0);
  if (!media.length) return null;
  const current = Math.min(index, media.length - 1);
  const active = media[current];
  const move = (value: number, absolute = false) => {
    const next =
      ((absolute ? value : current + value) + media.length) % media.length;
    root.current?.querySelectorAll("video").forEach((v) => v.pause());
    setIndex(next);
  };
  return (
    <section
      ref={root}
      className="post-carousel"
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
          !(e.target as Element).closest("video")
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
        {[active].map((m) => (
          <figure className="post-carousel-slide" key={m.src}>
            {m.type === "video" ? (
              <MediaVideo
                controls
                playsInline
                preload="metadata"
                src={m.src}
                aria-label={m.alt || m.name || "Post video"}
              />
            ) : m.type === "document" ? (
              <a
                className="post-document"
                href={m.src}
                {...(/^(data:|blob:)/i.test(m.src)
                  ? { download: m.name }
                  : { target: "_blank", rel: "noopener noreferrer" })}
              >
                <Icon name="file" />
                <strong>{m.name || "Document"}</strong>
                <small>
                  {/^(data:|blob:)/i.test(m.src) ? "Download" : "Open"}
                </small>
              </a>
            ) : (
              <MediaImage
                src={m.src}
                alt={m.alt || "Post image " + (current + 1)}
                loading="lazy"
              />
            )}
          </figure>
        ))}
        {media.length > 1 && (
          <>
            <button
              type="button"
              className="post-carousel-arrow previous"
              data-carousel-control
              aria-label="Previous media"
              onClick={() => move(-1)}
            >
              <Icon name="chevron" />
            </button>
            <button
              type="button"
              className="post-carousel-arrow next"
              data-carousel-control
              aria-label="Next media"
              onClick={() => move(1)}
            >
              <Icon name="chevron" />
            </button>
          </>
        )}
      </div>
      {media.length > 1 && (
        <div className="post-carousel-navigation">
          <div>
            {media.map((_, i) => (
              <button
                type="button"
                key={i}
                data-carousel-control
                aria-label={"Show media " + (i + 1)}
                aria-pressed={i === current}
                className={i === current ? "active" : ""}
                onClick={() => move(i, true)}
              />
            ))}
          </div>
          <span className="post-carousel-count sr-only" aria-live="polite">
            {current + 1} / {media.length}
          </span>
        </div>
      )}
    </section>
  );
}
