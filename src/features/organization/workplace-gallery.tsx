"use client";

import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { MediaImage } from "@/components/ui/media-image";

type WorkplaceImage = { id: string; url: string; alt?: string };

/** Workplace photo carousel: 2 slides on desktop, 1 on mobile. */
export function WorkplaceGallery({ images }: { images: WorkplaceImage[] }) {
  const labelId = useId();
  const [index, setIndex] = useState(0);
  const [perView, setPerView] = useState(2);
  const total = images.length;
  const visible = Math.min(perView, total) || 1;
  const maxIndex = Math.max(0, total - visible);
  const pageCount = maxIndex + 1;
  const canPage = pageCount > 1;

  useEffect(() => {
    const query = window.matchMedia("(max-width: 680px)");
    const sync = () => setPerView(query.matches ? 1 : 2);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setIndex((value) => Math.min(value, maxIndex));
  }, [maxIndex]);

  if (!total) return null;

  const go = (next: number) => setIndex(Math.min(Math.max(next, 0), maxIndex));

  return (
    <div
      className="org-workplace-carousel"
      style={{ ["--per-view" as string]: String(visible) }}
      role="region"
      aria-roledescription="carousel"
      aria-labelledby={labelId}
      tabIndex={canPage ? 0 : undefined}
      onKeyDown={(event) => {
        if (!canPage) return;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(index - 1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          go(index + 1);
        }
      }}
    >
      <span id={labelId} className="sr-only">
        Workplace photos
      </span>
      <div className="org-workplace-carousel-stage">
        <div
          className="org-workplace-carousel-track"
          style={{ transform: `translateX(-${(index * 100) / visible}%)` }}
        >
          {images.map((image, slide) => (
            <figure key={image.id} className="org-workplace-carousel-slide">
              <MediaImage src={image.url} alt={image.alt || `Workplace photo ${slide + 1} of ${total}`} />
            </figure>
          ))}
        </div>
        {canPage ? (
          <>
            <button type="button" className="org-workplace-carousel-arrow previous" aria-label="Previous workplace photos" disabled={index === 0} onClick={() => go(index - 1)}>
              <Icon name="chevron" />
            </button>
            <button type="button" className="org-workplace-carousel-arrow next" aria-label="Next workplace photos" disabled={index >= maxIndex} onClick={() => go(index + 1)}>
              <Icon name="chevron" />
            </button>
          </>
        ) : null}
      </div>
      {canPage ? (
        <div className="org-workplace-carousel-nav" role="tablist" aria-label="Workplace photo pages">
          {Array.from({ length: pageCount }, (_, page) => (
            <button
              key={page}
              type="button"
              role="tab"
              aria-selected={page === index}
              aria-label={`Show workplace photos starting at ${page + 1}`}
              className={page === index ? "active" : undefined}
              onClick={() => go(page)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
