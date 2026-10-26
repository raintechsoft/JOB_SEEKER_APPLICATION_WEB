/** The same geometry drives the on-screen crop and the saved image. */
export const PHOTO_SIZE = 320;
export const PHOTO_OUTPUT_SIZE = 512;
export interface PhotoTransform { zoom: number; rotation: number; flipX: boolean; x: number; y: number }
export const INITIAL_PHOTO_TRANSFORM: PhotoTransform = { zoom: 1, rotation: 0, flipX: false, x: 0, y: 0 };
export type PhotoFrame = { width: number; height: number; outputWidth: number; outputHeight: number };
export const PHOTO_FRAMES = {
  portrait: { width: PHOTO_SIZE, height: PHOTO_SIZE, outputWidth: PHOTO_OUTPUT_SIZE, outputHeight: PHOTO_OUTPUT_SIZE },
  recruiter_photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, outputWidth: PHOTO_OUTPUT_SIZE, outputHeight: PHOTO_OUTPUT_SIZE },
  logo: { width: PHOTO_SIZE, height: PHOTO_SIZE, outputWidth: PHOTO_OUTPUT_SIZE, outputHeight: PHOTO_OUTPUT_SIZE },
  cover: { width: 640, height: 160, outputWidth: 1600, outputHeight: 400 },
} as const satisfies Record<string, PhotoFrame>;

export function photoGeometry(width: number, height: number, transform: PhotoTransform, frame: PhotoFrame = PHOTO_FRAMES.portrait) {
  if (![width, height, transform.zoom, transform.rotation, transform.x, transform.y, frame.width, frame.height].every(Number.isFinite) || typeof transform.flipX !== "boolean" || width <= 0 || height <= 0 || frame.width <= 0 || frame.height <= 0 || transform.zoom < 1 || transform.zoom > 3 || transform.rotation % 90 !== 0) throw new Error("Choose a valid photo and adjustment.");
  const sideways = Math.abs(transform.rotation % 180) === 90;
  const rotatedWidth = sideways ? height : width, rotatedHeight = sideways ? width : height;
  const scale = Math.max(frame.width / rotatedWidth, frame.height / rotatedHeight) * transform.zoom;
  const maxX = Math.max(0, (rotatedWidth * scale - frame.width) / 2), maxY = Math.max(0, (rotatedHeight * scale - frame.height) / 2);
  return { scale, maxX, maxY, x: Math.max(-maxX, Math.min(maxX, transform.x)), y: Math.max(-maxY, Math.min(maxY, transform.y)) };
}

export async function loadProfilePhoto(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  // Managed media can require the existing session and credentialed CORS permission.
  if (/^https?:/i.test(src)) image.crossOrigin = "use-credentials";
  image.src = src;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error("Choose an image smaller than 40 megapixels.");
  return image;
}

export async function exportProfilePhoto(image: HTMLImageElement, transform: PhotoTransform, maxBytes: number, frame: PhotoFrame = PHOTO_FRAMES.portrait, filename = "profile-photo.jpg"): Promise<File> {
  const geometry = photoGeometry(image.naturalWidth, image.naturalHeight, transform, frame);
  const canvas = document.createElement("canvas");
  canvas.width = frame.outputWidth;
  canvas.height = frame.outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this photo. Try another browser.");
  const ratio = frame.outputWidth / frame.width;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate((frame.width / 2 + geometry.x) * ratio, (frame.height / 2 + geometry.y) * ratio);
  context.scale(transform.flipX ? -1 : 1, 1);
  context.rotate(transform.rotation * Math.PI / 180);
  context.scale(geometry.scale * ratio, geometry.scale * ratio);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  // Raster export applies crop/rotation/flip and omits the source's EXIF metadata.
  for (const quality of [0.92, 0.8, 0.65]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob?.size && blob.size <= maxBytes) return new File([blob], filename, { type: "image/jpeg" });
  }
  throw new Error("This photo is too large to save. Choose a smaller image.");
}
