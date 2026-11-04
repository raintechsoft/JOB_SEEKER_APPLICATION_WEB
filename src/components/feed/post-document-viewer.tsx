"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { MediaItem } from "@/types/domain";
import { Icon } from "@/components/ui/icon";
import { downloadBlob } from "@/lib/utils/files";
import {
  isPdfAttachment,
  loadPdfDocument,
  renderPdfPage,
} from "@/lib/media/pdf-document";

export type DocumentPageNav = {
  move: (delta: number) => void;
  page: number;
  pages: number;
};

function displayName(item: MediaItem) {
  const raw = (item.name || item.alt || "Document").trim();
  return raw.replace(/\.[a-z0-9]+$/i, "") || raw;
}

/** Fetch the file and trigger a same-device download (works without a new tab). */
export async function downloadDocumentFile(item: MediaItem) {
  const name = item.name?.trim() || "document.pdf";
  const response = await fetch(item.src, { credentials: "include" });
  if (!response.ok) throw new Error("The document could not be downloaded.");
  downloadBlob(name, await response.blob());
}

function DocumentFallback({ item }: { item: MediaItem }) {
  const local = /^(data:|blob:)/i.test(item.src);
  return (
    <a
      className="post-document"
      href={item.src}
      {...(local
        ? { download: item.name }
        : { target: "_blank", rel: "noopener noreferrer" })}
    >
      <Icon name="file" />
      <strong>{item.name || "Document"}</strong>
      <small>
        {/\.(doc|docx|ppt|pptx)$/i.test(item.name || "")
          ? "Open document"
          : local
            ? "Download"
            : "Open"}
      </small>
    </a>
  );
}

function PageArrows({
  page,
  pages,
  onPage,
  className = "",
}: {
  page: number;
  pages: number;
  onPage: (delta: number) => void;
  className?: string;
}) {
  if (pages <= 1) return null;
  return (
    <>
      <button
        type="button"
        className={`post-carousel-arrow previous post-doc-arrow ${className}`.trim()}
        data-carousel-control
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPage(-1)}
      >
        <Icon name="chevron" />
      </button>
      <button
        type="button"
        className={`post-carousel-arrow next post-doc-arrow ${className}`.trim()}
        data-carousel-control
        aria-label="Next page"
        disabled={page >= pages}
        onClick={() => onPage(1)}
      >
        <Icon name="chevron" />
      </button>
    </>
  );
}

/** Page-by-page PDF preview for post attachments. Non-PDF documents keep a download tile. */
export function PostDocumentViewer({
  item,
  active,
  onNavChange,
  onAspect,
}: {
  item: MediaItem;
  active: boolean;
  onNavChange?: (nav: DocumentPageNav | null) => void;
  onAspect?: (width: number, height: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fullCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullStageRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const onAspectRef = useRef(onAspect);
  onAspectRef.current = onAspect;
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const minZoom = 0.5;
  const maxZoom = 3;
  const zoomStep = 0.25;

  const move = useCallback(
    (delta: number) => {
      setPage((current) => {
        if (!pages) return current;
        return Math.min(pages, Math.max(1, current + delta));
      });
      setPan({ x: 0, y: 0 });
    },
    [pages],
  );

  const clampZoom = (value: number) =>
    Math.min(maxZoom, Math.max(minZoom, Math.round(value * 100) / 100));

  const zoomBy = useCallback((delta: number) => {
    setZoom((current) => clampZoom(current + delta));
  }, []);

  const setZoomLevel = useCallback((value: number) => {
    setZoom(clampZoom(value));
    if (value <= 1) setPan({ x: 0, y: 0 });
  }, []);

  const download = useCallback(async () => {
    setDownloadError("");
    setDownloading(true);
    try {
      await downloadDocumentFile(item);
    } catch {
      setDownloadError("Download failed. Try again.");
    } finally {
      setDownloading(false);
    }
  }, [item]);

  useEffect(() => {
    if (!active) {
      onNavChange?.(null);
      return;
    }
    onNavChange?.({ move, page, pages });
    return () => onNavChange?.(null);
  }, [active, move, onNavChange, page, pages]);

  useEffect(() => {
    if (!isPdfAttachment(item)) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setPage(1);
    setPages(0);
    pdfRef.current = null;
    void loadPdfDocument(item.src).then((pdf) => {
      if (cancelled) return;
      if (!pdf) {
        setError("This PDF couldn’t be previewed.");
        setLoading(false);
        return;
      }
      pdfRef.current = pdf;
      setPages(pdf.numPages);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [item.src, item.name]);

  useLayoutEffect(() => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || !pages || error) return;
    let cancelled = false;
    setLoading(true);
    const width = Math.min(stageRef.current?.clientWidth || 640, 900);
    void renderPdfPage(pdf, page, canvas, width).then(
      () => {
        if (cancelled) return;
        setLoading(false);
        if (active) onAspectRef.current?.(16, 9);
      },
      () => {
        if (!cancelled) {
          setError("This page couldn’t be rendered.");
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [page, pages, error, item.src, active]);

  useLayoutEffect(() => {
    if (!expanded) return;
    const pdf = pdfRef.current;
    const canvas = fullCanvasRef.current;
    if (!pdf || !canvas || !pages || error) return;
    const width = Math.min(
      fullStageRef.current?.clientWidth || window.innerWidth * 0.92,
      1100,
    );
    // Render at a sharp base size; zoom is applied with CSS transform for reliable UI.
    void renderPdfPage(pdf, page, canvas, width, 1.25);
  }, [expanded, page, pages, error, item.src]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomBy(zoomStep);
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomBy(-zoomStep);
      }
      if (event.key === "0") {
        event.preventDefault();
        setZoomLevel(1);
      }
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [expanded, move, zoomBy, setZoomLevel]);

  useEffect(() => {
    if (!expanded) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      drag.current = null;
    }
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const stage = fullStageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((current) =>
        clampZoom(current + (event.deltaY < 0 ? zoomStep : -zoomStep)),
      );
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [expanded, page]);

  useEffect(() => {
    if (active && !isPdfAttachment(item)) onAspectRef.current?.(4, 3);
  }, [active, item]);

  if (!isPdfAttachment(item)) return <DocumentFallback item={item} />;

  const title = displayName(item);
  return (
    <>
      <div className="post-doc-viewer" data-document-viewer>
        <header className="post-doc-top">
          <strong className="post-doc-title" title={item.name || title}>
            {title}
          </strong>
          <span className="post-doc-page-label" aria-live="polite">
            {pages
              ? `Preview ${page} of ${pages} page${pages === 1 ? "" : "s"}`
              : loading
                ? "Loading preview…"
                : "Preview"}
          </span>
        </header>
        <div className="post-doc-stage" ref={stageRef}>
          {error ? (
            <div className="post-doc-status" role="alert">
              <Icon name="alert" />
              <span>{error}</span>
              <button type="button" data-carousel-control onClick={() => void download()}>
                Download file
              </button>
            </div>
          ) : (
            <>
              {loading && (
                <div className="post-doc-status" aria-busy="true">
                  Loading page…
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="post-doc-canvas"
                hidden={loading || !!error}
                aria-label={`${title}, page ${page}`}
              />
            </>
          )}
        </div>
        {!error && <PageArrows page={page} pages={pages} onPage={move} />}
        <button
          type="button"
          className="post-doc-expand sr-only"
          data-carousel-control
          aria-label="Expand document"
          onClick={() => setExpanded(true)}
        >
          Expand
        </button>
      </div>
      {expanded &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="post-doc-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="post-doc-viewer is-expanded">
              <header className="post-doc-top">
                <strong className="post-doc-title">{title}</strong>
                <span className="post-doc-page-label" aria-live="polite">
                  {pages
                    ? `Page ${page} of ${pages}`
                    : "Document"}
                </span>
                <div className="post-doc-overlay-actions">
                  <div className="post-doc-zoom" role="group" aria-label="Zoom">
                    <button
                      type="button"
                      className="post-doc-action post-doc-zoom-btn"
                      aria-label="Zoom out"
                      disabled={zoom <= minZoom}
                      onClick={() => zoomBy(-zoomStep)}
                    >
                      <Icon name="minus" />
                    </button>
                    <button
                      type="button"
                      className="post-doc-zoom-label"
                      aria-label="Reset zoom"
                      title="Reset zoom"
                      onClick={() => setZoomLevel(1)}
                    >
                      {Math.round(zoom * 100)}%
                    </button>
                    <button
                      type="button"
                      className="post-doc-action post-doc-zoom-btn"
                      aria-label="Zoom in"
                      disabled={zoom >= maxZoom}
                      onClick={() => zoomBy(zoomStep)}
                    >
                      <Icon name="plus" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="post-doc-action"
                    disabled={downloading}
                    onClick={() => void download()}
                  >
                    <Icon name="download" />
                    {downloading ? "Downloading…" : "Download"}
                  </button>
                  <button
                    type="button"
                    className="post-doc-action"
                    aria-label="Close"
                    onClick={() => setExpanded(false)}
                  >
                    <Icon name="close" />
                    Close
                  </button>
                </div>
              </header>
              {downloadError && (
                <p className="post-doc-download-error" role="alert">
                  {downloadError}
                </p>
              )}
              <div
                className={
                  "post-doc-stage" + (zoom > 1 ? " is-zoomable" : "")
                }
                ref={fullStageRef}
                onPointerDown={(event) => {
                  if (
                    event.button !== 0 ||
                    (event.target as Element).closest(".post-doc-arrow")
                  )
                    return;
                  drag.current = {
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    panX: pan.x,
                    panY: pan.y,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (!drag.current || drag.current.pointerId !== event.pointerId)
                    return;
                  setPan({
                    x: drag.current.panX + (event.clientX - drag.current.x),
                    y: drag.current.panY + (event.clientY - drag.current.y),
                  });
                }}
                onPointerUp={(event) => {
                  if (drag.current?.pointerId === event.pointerId)
                    drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
              >
                <div
                  className="post-doc-zoom-layer"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  }}
                >
                  <canvas
                    ref={fullCanvasRef}
                    className="post-doc-canvas"
                    aria-label={`${title}, page ${page}`}
                  />
                </div>
                <PageArrows page={page} pages={pages} onPage={move} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
