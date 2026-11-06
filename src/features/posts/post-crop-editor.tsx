"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Cropper, { type Area as CropperArea, type MediaSize, type Point } from "react-easy-crop";
import { Button } from "@/components/ui/primitives";
import { modal, useModalStore } from "@/stores/modal-store";
import {
  cropAreaFor,
  cropAreaPercentages,
  cropFromPercentages,
  isDefaultCrop,
  mediaCropOf,
  normalizeRotation,
  POST_CROP_MAX_ZOOM,
  POST_CROP_MIN_ZOOM,
  postAspectPreset,
  resolveAspect,
  rotatedSize,
  setPostAspectRatio,
  setPostMediaCrop,
  type PostAspectRatioId,
  type PostCropRotation,
  type PostMediaEditingState,
  type PostPublishFormat,
  type Size,
} from "@/lib/media/post-crop";
import { PostAspectSelector } from "./post-aspect-selector";

export interface PostCropEditorItem {
  id: string;
  /** Original (uncropped) preview source: blob: or data: URL. */
  src: string;
  type: "image" | "video";
  name: string;
}

/**
 * Post media editor in the same shell as the profile photo editor (stage, hint, zoom, tools,
 * footer). One ratio for the whole post, per-item zoom / position / rotation. Edits are local
 * until Save; Cancel asks before discarding, like the other editors.
 */
export function PostCropEditor({
  items,
  activeId,
  state,
  format = "feed",
  onApply,
  onCancel,
}: {
  items: PostCropEditorItem[];
  activeId: string;
  state: PostMediaEditingState;
  format?: PostPublishFormat;
  onApply: (next: PostMediaEditingState) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(state);
  const [active, setActive] = useState(items.some((i) => i.id === activeId) ? activeId : items[0]?.id ?? "");
  const [naturalSizes, setNaturalSizes] = useState<Record<string, Size>>({});
  const [view, setView] = useState<{ crop: Point; zoom: number }>({ crop: { x: 0, y: 0 }, zoom: 1 });
  const [seed, setSeed] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const item = items.find((i) => i.id === active);
  const natural = item ? naturalSizes[item.id] : undefined;
  const crop = item ? mediaCropOf(draft, item.id) : undefined;
  const rotation: PostCropRotation = normalizeRotation(crop?.rotation);
  // The frame sees the rotated source.
  const size = natural ? rotatedSize(natural, rotation) : undefined;
  const preset = postAspectPreset(draft.aspectRatio);
  const aspect = size ? resolveAspect(draft.aspectRatio, size) : preset.ratio ?? 4 / 3;
  const initialPercentages = useMemo(
    () => (size && crop ? cropAreaPercentages(size, cropAreaFor(size, draft.aspectRatio, crop)) : undefined),
    // Re-seeding happens on remount only (key below); crop/zoom edits must not loop back in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, draft.aspectRatio, active, seed],
  );
  const remount = () => setSeed((n) => n + 1);
  const markDirty = () => useModalStore.getState().setDirty(true);

  useEffect(() => {
    useModalStore.setState({ title: items.length > 1 ? "Edit media" : "Edit image" });
    heading.current?.focus();
  }, [items.length]);
  useEffect(() => {
    if (!item || item.type !== "image" || naturalSizes[item.id]) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled && img.naturalWidth > 0) setNaturalSizes((s) => (s[item.id] ? s : { ...s, [item.id]: { width: img.naturalWidth, height: img.naturalHeight } }));
    };
    img.src = item.src;
    return () => {
      cancelled = true;
    };
  }, [item, naturalSizes]);

  const changeAspect = (next: PostAspectRatioId) => {
    if (next === draft.aspectRatio) return;
    // Global: every item keeps its zoom/focus, only the frame shape changes.
    setDraft((prev) => setPostAspectRatio(prev, next));
    markDirty();
    remount();
  };
  const selectItem = (id: string) => {
    if (id === active) return;
    setActive(id);
    setView({ crop: { x: 0, y: 0 }, zoom: 1 });
  };
  const onCropComplete = (percentages: CropperArea) => {
    if (!item || !size) return;
    setDraft((prev) => {
      const current = mediaCropOf(prev, item.id);
      const next = cropFromPercentages(size, prev.aspectRatio, percentages);
      return setPostMediaCrop(prev, item.id, { ...next, rotation: current.rotation });
    });
  };
  const edited = (id: string) => !isDefaultCrop(mediaCropOf(draft, id));
  const stageAspect = size ? `${size.width} / ${size.height}` : preset.ratio ? `${preset.ratio} / 1` : "4 / 3";
  const frameAspect = preset.ratio ? `${preset.ratio} / 1` : stageAspect;

  return (
    <section className="photo-editor is-post-media" data-testid="post-crop-editor">
      <h3 className="sr-only" ref={heading} tabIndex={-1}>
        {items.length > 1 ? "Edit media" : "Edit image"}
      </h3>

      <div className="post-crop-layout">
        <div className="post-crop-main">
          <div className="photo-crop-stage is-post-media">
            <div
              className="photo-crop-circle is-post-media"
              role="group"
              aria-label="Media crop area"
              aria-describedby="post-crop-help"
              style={{ aspectRatio: frameAspect, "--post-crop-aspect": String(preset.ratio ?? (size ? size.width / size.height : 4 / 3)) } as React.CSSProperties}
            >
              {item && (item.type === "video" || natural) ? (
                <Cropper
                  key={`${item.id}:${draft.aspectRatio}:${rotation}:${seed}`}
                  {...(item.type === "video" ? { video: item.src } : { image: item.src })}
                  crop={view.crop}
                  zoom={view.zoom}
                  rotation={rotation}
                  minZoom={POST_CROP_MIN_ZOOM}
                  maxZoom={POST_CROP_MAX_ZOOM}
                  aspect={aspect}
                  objectFit="cover"
                  showGrid
                  restrictPosition
                  zoomWithScroll
                  initialCroppedAreaPercentages={initialPercentages}
                  onCropChange={(next) => setView((v) => ({ ...v, crop: next }))}
                  onZoomChange={(zoom) => setView((v) => ({ ...v, zoom }))}
                  onCropComplete={onCropComplete}
                  onInteractionEnd={markDirty}
                  onMediaLoaded={(media: MediaSize) =>
                    setNaturalSizes((s) => (s[item.id] ? s : { ...s, [item.id]: { width: media.naturalWidth, height: media.naturalHeight } }))
                  }
                  mediaProps={item.type === "video" ? { muted: true, playsInline: true, loop: true, autoPlay: true, controls: false } : { alt: item.name, draggable: false }}
                />
              ) : item ? null : (
                <span className="photo-editor-empty">Nothing to edit.</span>
              )}
              {item && !natural ? <span className="post-crop-loading">Loading media…</span> : null}
            </div>
          </div>
          {items.length > 1 ? (
            <div className="post-crop-strip" role="tablist" aria-label="Media to edit">
              {items.map((it, index) => (
                <button
                  key={it.id}
                  type="button"
                  role="tab"
                  aria-selected={it.id === active}
                  aria-label={`Edit ${it.name}`}
                  className={"post-crop-thumb" + (it.id === active ? " is-active" : "")}
                  onClick={() => selectItem(it.id)}
                >
                  {/* Local blob/data previews: next/image cannot optimise them. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.type === "video" ? <video src={it.src} muted playsInline preload="metadata" /> : <img src={it.src} alt="" draggable={false} />}
                  <span className="post-crop-thumb-index" aria-hidden>
                    {index + 1}
                  </span>
                  {edited(it.id) ? <span className="post-crop-thumb-edited" aria-hidden /> : null}
                </button>
              ))}
            </div>
          ) : null}
          
        </div>

        <aside className="post-crop-side" aria-label="Media editing controls">
          <div className="post-crop-side-group">
            <span className="post-crop-row-label"> Ratio</span>
            <PostAspectSelector value={draft.aspectRatio} onChange={changeAspect} format={format} variant="icons" />
          </div>
          <label className="photo-zoom-control">
            Zoom
            <input
              type="range"
              min={POST_CROP_MIN_ZOOM}
              max={POST_CROP_MAX_ZOOM}
              step="0.05"
              value={view.zoom}
              disabled={!size}
              onChange={(event) => {
                setView((v) => ({ ...v, zoom: Number(event.target.value) }));
                markDirty();
              }}
            />
            <output>{Math.round(view.zoom * 100)}%</output>
          </label>
        </aside>
      </div>

      <div className="modal-footer">
        <Button onClick={() => modal.requestClose(onCancel)}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => {
            useModalStore.getState().setDirty(false);
            onApply(draft);
          }}
        >
          Save media
        </Button>
      </div>
    </section>
  );
}
