export type MediaOrientation = "landscape" | "portrait" | "square";

export type MediaAspectLayout = {
  aspect: number;
  orientation: MediaOrientation;
  /** CSS aspect-ratio value as width/height. */
  aspectRatio: string;
};

export const DEFAULT_MEDIA_ASPECT = 16 / 9;

/** Map pixel dimensions to orientation + CSS aspect ratio for the post media stage. */
export function mediaAspectLayout(
  width: number,
  height: number,
): MediaAspectLayout {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return {
      aspect: DEFAULT_MEDIA_ASPECT,
      orientation: "landscape",
      aspectRatio: `${DEFAULT_MEDIA_ASPECT}`,
    };
  }
  const aspect = width / height;
  const orientation: MediaOrientation =
    Math.abs(aspect - 1) < 0.03 ? "square" : aspect > 1 ? "landscape" : "portrait";
  return {
    aspect,
    orientation,
    aspectRatio: `${width} / ${height}`,
  };
}
