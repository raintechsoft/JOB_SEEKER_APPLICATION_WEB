"use client";

import { postAspectPresets, type PostAspectRatioId, type PostPublishFormat } from "@/lib/media/post-crop";

/**
 * Instagram-style ratio picker: one chip per preset with a small rectangle drawn at that ratio.
 * The selection is the post's single global ratio (applies to every slide of the carousel).
 */
export function PostAspectSelector({
  value,
  onChange,
  format = "feed",
  disabled = false,
  compact = false,
  orientation = "row",
  variant = "cards",
  label = "Aspect ratio for all media",
}: {
  value: PostAspectRatioId;
  onChange: (next: PostAspectRatioId) => void;
  format?: PostPublishFormat;
  disabled?: boolean;
  compact?: boolean;
  /** "column": one full-width row per preset (editor side panel). */
  orientation?: "row" | "column";
  /** "icons": shape glyph only, names via tooltip and accessible label. */
  variant?: "cards" | "icons";
  label?: string;
}) {
  return (
    <div className={"post-aspect-selector" + (compact ? " is-compact" : "") + (orientation === "column" ? " is-vertical" : "") + (variant === "icons" ? " is-icons" : "")} role="radiogroup" aria-label={label}>
      {postAspectPresets(format).map((preset) => {
        const ratio = preset.ratio ?? 4 / 3;
        // Rectangle inside an 18×18 box, longest side 18px.
        const w = ratio >= 1 ? 18 : Math.round(18 * ratio);
        const h = ratio >= 1 ? Math.round(18 / ratio) : 18;
        const selected = preset.id === value;
        const name = preset.ratio ? preset.label + " " + preset.id : "Original";
        if (variant === "icons")
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name}
              title={name}
              className={"post-aspect-icon" + (selected ? " is-selected" : "")}
              disabled={disabled}
              onClick={() => onChange(preset.id)}
            >
              <span className="post-aspect-shape" aria-hidden>
                <span className={"post-aspect-rect" + (preset.ratio ? "" : " is-original")} style={{ width: w, height: h }} />
              </span>
            </button>
          );
        return (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={"post-aspect-option" + (selected ? " is-selected" : "") + (orientation === "column" ? " is-row" : "")}
            disabled={disabled}
            title={preset.label + (preset.ratio ? " · " + preset.id : " · keeps the source ratio")}
            onClick={() => onChange(preset.id)}
          >
            <span className="post-aspect-shape" aria-hidden>
              <span className={"post-aspect-rect" + (preset.ratio ? "" : " is-original")} style={{ width: w, height: h }} />
            </span>
            <span className="post-aspect-label">{preset.ratio ? preset.id : "Original"}</span>
            <small className="post-aspect-name">{preset.label}</small>
          </button>
        );
      })}
    </div>
  );
}
