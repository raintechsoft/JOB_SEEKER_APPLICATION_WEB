"use client";

import { MediaImage } from "@/components/ui/media-image";

import { useRef, useState } from "react";
import type { MediaItem } from "@/types/domain";
import { isInlineImage } from "@/lib/utils/url";
import { Icon } from "@/components/ui/icon";

const isSafe = (m: MediaItem) => (m.type === "image" ? isInlineImage(m.src) || /^https?:\/\//i.test(m.src) : /^https?:\/\//i.test(m.src));

/** Multi-media post carousel: arrows, dots, ←/→ keys and touch swipe (prototype `postCarousel`). */
export function PostCarousel({ items, id }: { items: MediaItem[]; id: string }) {
  const media = items.filter(isSafe);
  const [index, setIndex] = useState(0);
  const root = useRef<HTMLElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  if (!media.length) return null;
  const move = (value: number, absolute = false) => {
    const next = ((absolute ? value : index + value) + media.length) % media.length;
    root.current?.querySelectorAll("video").forEach((v, n) => n !== next && v.pause());
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
      onKeyDown={(e) => {
        if (!["ArrowLeft", "ArrowRight"].includes(e.key) || (e.target as Element).matches("input,textarea,select,video")) return;
        e.preventDefault();
        move(e.key === "ArrowLeft" ? -1 : 1);
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "touch" && !(e.target as Element).closest("video")) start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        if (!start.current) return;
        const dx = e.clientX - start.current.x;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(e.clientY - start.current.y)) move(dx < 0 ? 1 : -1);
        start.current = null;
      }}
      onPointerCancel={() => (start.current = null)}
    >
      <div className="post-carousel-stage">
        {media.map((m, i) => (
          <figure className="post-carousel-slide" hidden={i !== index} key={i}>
            {m.type === "video" ? (
              <video controls playsInline preload="metadata" src={m.src} aria-label={m.alt || "Post video"} />
            ) : (
              <MediaImage src={m.src} alt={m.alt || "Post image " + (i + 1)} loading="lazy" />
            )}
          </figure>
        ))}
        {media.length > 1 && (
          <>
            <button type="button" className="post-carousel-arrow previous" data-carousel-control aria-label="Previous media" onClick={() => move(-1)}>
              <Icon name="chevron" />
            </button>
            <button type="button" className="post-carousel-arrow next" data-carousel-control aria-label="Next media" onClick={() => move(1)}>
              <Icon name="chevron" />
            </button>
          </>
        )}
      </div>
      {media.length > 1 && (
        <div className="post-carousel-navigation">
          <div>
            {media.map((_, i) => (
              <button type="button" key={i} data-carousel-control aria-label={"Show media " + (i + 1)} aria-pressed={i === index} className={i === index ? "active" : ""} onClick={() => move(i, true)} />
            ))}
          </div>
          <span className="post-carousel-count sr-only" aria-live="polite">
            {index + 1} / {media.length}
          </span>
        </div>
      )}
    </section>
  );
}
