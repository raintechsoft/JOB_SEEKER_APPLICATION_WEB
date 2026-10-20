export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const KB = 1024;
export const MB = 1024 * 1024;

export function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}

/** Reads a file and confirms the browser can decode it as an image. */
export async function readImage(file: File) {
  const url = await readAsDataUrl(file);
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("This file could not be read as an image."));
    img.src = url;
  });
  return url;
}

/** Triggers a browser download for generated content. */
export function downloadFile(name: string, content: BlobPart, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
