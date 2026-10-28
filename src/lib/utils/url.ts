/** Returns the normalised URL when it is an absolute http(s) URL, otherwise "". */
export function safeUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}

/** Direct MP4/WebM video URL check used by posts and jobs. */
export function safeVideoUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) && /\.(mp4|webm)$/i.test(u.pathname) ? u.href : "";
  } catch {
    return "";
  }
}

export const isValidEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

/** Only inline images produced by the browser's FileReader are trusted as image sources. */
export const isInlineImage = (value: string | undefined) => !!value && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value);
export const isManagedMediaUrl = (value: string | undefined) => !!value && /^https?:\/\/[^?#]+\/api\/v1\/media\/[0-9a-f-]{36}\/download$/i.test(value);
export const isSafeMediaSrc = (value: string | undefined) => !!value && (/^https?:\/\//i.test(value) || /^data:(image|video|application|text)\//i.test(value) || value.startsWith("blob:"));
