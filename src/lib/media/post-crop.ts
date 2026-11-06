/**
 * Instagram-style cropping for Create Post media.
 *
 * One aspect ratio applies to the whole post (every carousel slide shares it); each media item keeps
 * its own zoom and focus. The crop is stored resolution-independently (zoom + focus point as fractions
 * of the source) so it can be re-applied when the ratio changes, re-opened in the editor, and mapped
 * to source pixels for export. The published file is produced from the ORIGINAL file via canvas, so the
 * crop is baked into the uploaded pixels and no backend field is needed.
 */

export type PostPublishFormat = "feed" | "story";

export type PostAspectRatioId = "original" | "1:1" | "4:5" | "3:4" | "1.91:1" | "9:16";

export interface PostAspectPreset {
  id: PostAspectRatioId;
  label: string;
  /** Width / height; null keeps the source ratio. */
  ratio: number | null;
  /** Target output size for the preset (never upscales a smaller source). */
  target: { width: number; height: number } | null;
  formats: PostPublishFormat[];
}

export const POST_ASPECT_PRESETS: readonly PostAspectPreset[] = [
  { id: "original", label: "Original", ratio: null, target: null, formats: ["feed", "story"] },
  { id: "1:1", label: "Square", ratio: 1, target: { width: 1080, height: 1080 }, formats: ["feed"] },
  { id: "4:5", label: "Portrait", ratio: 4 / 5, target: { width: 1080, height: 1350 }, formats: ["feed"] },
  { id: "3:4", label: "Tall portrait", ratio: 3 / 4, target: { width: 1080, height: 1440 }, formats: ["feed"] },
  { id: "1.91:1", label: "Landscape", ratio: 1.91, target: { width: 1080, height: 566 }, formats: ["feed"] },
  { id: "9:16", label: "Vertical", ratio: 9 / 16, target: { width: 1080, height: 1920 }, formats: ["story"] },
];

export function postAspectPresets(format: PostPublishFormat = "feed"): PostAspectPreset[] {
  return POST_ASPECT_PRESETS.filter((p) => p.formats.includes(format));
}

export function isPostAspectRatioId(id: unknown): id is PostAspectRatioId {
  return typeof id === "string" && POST_ASPECT_PRESETS.some((p) => p.id === id);
}

export function postAspectPreset(id: string): PostAspectPreset {
  return POST_ASPECT_PRESETS.find((p) => p.id === id) ?? POST_ASPECT_PRESETS[0];
}

export const POST_CROP_MIN_ZOOM = 1;
export const POST_CROP_MAX_ZOOM = 3;

export interface Size {
  width: number;
  height: number;
}

export interface Area extends Size {
  x: number;
  y: number;
}

export type PostCropRotation = 0 | 90 | 180 | 270;

/**
 * Per-item crop: zoom (1 = largest frame that fits the ratio), the frame centre as fractions of
 * the (rotated) source, and a quarter-turn rotation applied before cropping.
 */
export interface PostMediaCrop {
  zoom: number;
  focus: { x: number; y: number };
  rotation?: PostCropRotation;
}

export interface PostMediaEditingState {
  aspectRatio: PostAspectRatioId;
  media: Record<string, PostMediaCrop>;
}

export const DEFAULT_MEDIA_CROP: PostMediaCrop = { zoom: 1, focus: { x: 0.5, y: 0.5 } };

export function emptyPostMediaEditing(): PostMediaEditingState {
  return { aspectRatio: "original", media: {} };
}

export function mediaCropOf(state: PostMediaEditingState, id: string): PostMediaCrop {
  return state.media[id] ?? DEFAULT_MEDIA_CROP;
}

export function isDefaultCrop(crop: PostMediaCrop): boolean {
  return Math.abs(crop.zoom - 1) < 1e-6 && Math.abs(crop.focus.x - 0.5) < 1e-6 && Math.abs(crop.focus.y - 0.5) < 1e-6 && !(crop.rotation ?? 0);
}

export function normalizeRotation(value: unknown): PostCropRotation {
  const n = typeof value === "number" && Number.isFinite(value) ? (((Math.round(value / 90) * 90) % 360) + 360) % 360 : 0;
  return n as PostCropRotation;
}

/** Source dimensions after the quarter-turn rotation (what the crop frame sees). */
export function rotatedSize(source: Size, rotation: PostCropRotation | undefined): Size {
  return rotation === 90 || rotation === 270 ? { width: source.height, height: source.width } : source;
}

/** Global ratio change: every item keeps its own zoom/focus; only the frame shape changes. */
export function setPostAspectRatio(state: PostMediaEditingState, aspectRatio: PostAspectRatioId): PostMediaEditingState {
  return state.aspectRatio === aspectRatio ? state : { ...state, aspectRatio };
}

export function setPostMediaCrop(state: PostMediaEditingState, id: string, crop: PostMediaCrop): PostMediaEditingState {
  return { ...state, media: { ...state.media, [id]: normalizeCrop(crop) } };
}

export function resetPostMediaCrop(state: PostMediaEditingState, id: string): PostMediaEditingState {
  if (!(id in state.media)) return state;
  const media = { ...state.media };
  delete media[id];
  return { ...state, media };
}

export function removePostMedia(state: PostMediaEditingState, id: string): PostMediaEditingState {
  return resetPostMediaCrop(state, id);
}

export function normalizeCrop(crop: PostMediaCrop): PostMediaCrop {
  const rotation = normalizeRotation(crop.rotation);
  return {
    zoom: clamp(Number.isFinite(crop.zoom) ? crop.zoom : 1, POST_CROP_MIN_ZOOM, POST_CROP_MAX_ZOOM),
    focus: { x: clamp(crop.focus.x, 0, 1), y: clamp(crop.focus.y, 0, 1) },
    ...(rotation ? { rotation } : {}),
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Effective width/height ratio for a preset against a given source. */
export function resolveAspect(presetId: PostAspectRatioId, source: Size): number {
  const preset = postAspectPreset(presetId);
  return preset.ratio ?? (source.height > 0 ? source.width / source.height : 1);
}

/**
 * Source-pixel crop area for a ratio + per-item crop. Zoom 1 is the largest frame of that ratio
 * that fits the source; zoom shrinks the frame; the focus point positions it, clamped inside the source.
 */
export function cropAreaFor(source: Size, presetId: PostAspectRatioId, crop: PostMediaCrop = DEFAULT_MEDIA_CROP): Area {
  const { zoom, focus } = normalizeCrop(crop);
  const ratio = resolveAspect(presetId, source);
  const base = source.width / source.height > ratio ? { width: source.height * ratio, height: source.height } : { width: source.width, height: source.width / ratio };
  const width = base.width / zoom;
  const height = base.height / zoom;
  const x = clamp(focus.x * source.width - width / 2, 0, Math.max(0, source.width - width));
  const y = clamp(focus.y * source.height - height / 2, 0, Math.max(0, source.height - height));
  return { x: Math.round(x), y: Math.round(y), width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

/** Percentages for react-easy-crop's `initialCroppedAreaPercentages`. */
export function cropAreaPercentages(source: Size, area: Area): Area {
  return {
    x: (area.x / source.width) * 100,
    y: (area.y / source.height) * 100,
    width: (area.width / source.width) * 100,
    height: (area.height / source.height) * 100,
  };
}

/** Back from the editor: percentages of the source -> zoom + focus (resolution independent). */
export function cropFromPercentages(source: Size, presetId: PostAspectRatioId, percentages: Area): PostMediaCrop {
  const ratio = resolveAspect(presetId, source);
  const base = source.width / source.height > ratio ? { width: source.height * ratio, height: source.height } : { width: source.width, height: source.width / ratio };
  const width = (percentages.width / 100) * source.width;
  const zoom = width > 0 ? base.width / width : 1;
  return normalizeCrop({
    zoom,
    focus: { x: (percentages.x + percentages.width / 2) / 100, y: (percentages.y + percentages.height / 2) / 100 },
  });
}

/** Output size: scale the cropped area to the preset target (width-bound), never upscale, keep proportions. */
export function outputSizeFor(presetId: PostAspectRatioId, area: Size): Size {
  const preset = postAspectPreset(presetId);
  if (!preset.target) return { width: Math.round(area.width), height: Math.round(area.height) };
  const scale = Math.min(1, preset.target.width / area.width, preset.target.height / area.height);
  return { width: Math.max(1, Math.round(area.width * scale)), height: Math.max(1, Math.round(area.height * scale)) };
}

const CROPPABLE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Images the browser can decode and re-encode. GIF would lose animation, HEIC cannot be decoded on canvas. */
export function isCroppableImage(item: { type: string; src: string; name: string; mime?: string }): boolean {
  if (item.type !== "image") return false;
  if (!(item.src.startsWith("blob:") || item.src.startsWith("data:"))) return false;
  const mime = item.mime || mimeFromName(item.name);
  return CROPPABLE_MIME.has(mime);
}

export function isPreviewableVideo(item: { type: string; src: string }): boolean {
  return item.type === "video" && (item.src.startsWith("blob:") || item.src.startsWith("data:"));
}

export function mimeFromName(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", heic: "image/heic", heif: "image/heif" }[ext] ?? "";
}

/** PNG/WebP keep transparency; everything else exports as JPEG. */
export function exportMimeFor(sourceMime: string, canEncodeWebp = true): "image/png" | "image/jpeg" | "image/webp" {
  if (sourceMime === "image/png") return "image/png";
  if (sourceMime === "image/webp") return canEncodeWebp ? "image/webp" : "image/png";
  return "image/jpeg";
}

export function exportFileName(sourceName: string, mime: string): string {
  const stem = sourceName.replace(/\.[^.]+$/, "") || "image";
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return `${stem}.${ext}`;
}

// ---- Browser-only helpers (decode + export) -------------------------------------------------

export interface DecodedImage {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, area: Area, output: Size, dx?: number, dy?: number) => void;
  close: () => void;
}

/** Decode with EXIF orientation applied (createImageBitmap) and fall back to <img> for older engines. */
export async function decodeImage(source: Blob | string): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, area, output, dx = 0, dy = 0) => ctx.drawImage(bitmap, area.x, area.y, area.width, area.height, dx, dy, output.width, output.height),
        close: () => bitmap.close(),
      };
    } catch {
      /* fall through to the image element */
    }
  }
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("The image could not be decoded."));
    img.src = url;
  });
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    draw: (ctx, area, output, dx = 0, dy = 0) => ctx.drawImage(img, area.x, area.y, area.width, area.height, dx, dy, output.width, output.height),
    close: () => {
      if (typeof source !== "string") URL.revokeObjectURL(url);
    },
  };
}

let webpSupport: boolean | null = null;
function canEncodeWebp(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const c = document.createElement("canvas");
    c.width = 2;
    c.height = 2;
    webpSupport = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

export interface CropExportInput {
  source: Blob | string;
  sourceName: string;
  sourceMime: string;
  presetId: PostAspectRatioId;
  crop: PostMediaCrop;
}

export interface CropExportResult {
  file: File;
  source: Size;
  area: Area;
  output: Size;
}

/** Crop + scale the ORIGINAL image on a canvas; transparent formats stay transparent, JPEG keeps 0.92 quality. */
export async function exportCroppedImage(input: CropExportInput): Promise<CropExportResult> {
  const decoded = await decodeImage(input.source);
  try {
    const rotation = normalizeRotation(input.crop.rotation);
    const natural = { width: decoded.width, height: decoded.height };
    const source = rotatedSize(natural, rotation);
    const area = cropAreaFor(source, input.presetId, input.crop);
    const output = outputSizeFor(input.presetId, area);
    const canvas = document.createElement("canvas");
    canvas.width = output.width;
    canvas.height = output.height;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (rotation) {
      // Rotate the whole image once, then crop from the rotated pixels.
      const turned = document.createElement("canvas");
      turned.width = source.width;
      turned.height = source.height;
      const tctx = turned.getContext("2d", { alpha: true });
      if (!tctx) throw new Error("Canvas is not available in this browser.");
      tctx.translate(source.width / 2, source.height / 2);
      tctx.rotate((rotation * Math.PI) / 180);
      decoded.draw(tctx, { x: 0, y: 0, width: natural.width, height: natural.height }, { width: natural.width, height: natural.height }, -natural.width / 2, -natural.height / 2);
      ctx.drawImage(turned, area.x, area.y, area.width, area.height, 0, 0, output.width, output.height);
    } else {
      decoded.draw(ctx, area, output);
    }
    const mime = exportMimeFor(input.sourceMime, canEncodeWebp());
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, mime === "image/png" ? undefined : 0.92));
    if (!blob) throw new Error("The cropped image could not be generated.");
    const file = new File([blob], exportFileName(input.sourceName, mime), { type: mime, lastModified: Date.now() });
    return { file, source, area, output };
  } finally {
    decoded.close();
  }
}
