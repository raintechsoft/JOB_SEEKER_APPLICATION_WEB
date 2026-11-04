import { z } from "zod";
import mediaDefaults from "../../../contracts/validation/media.json";
import contract from "../../../contracts/validation/profile.json";
import type { ProfileCollection, ProfileRecord } from "@/types/domain";
import type { ProfileSection } from "@/services/profile/profile.service";

type Values = Record<string, string | boolean | string[] | undefined>;
const count = (value: string) => [...value].length;
const calendar = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const month = (value: string) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1800;
const httpUrl = (value: string) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export function profileFieldsSchema(
  fields: Record<string, string>,
  section?: string,
  collection?: string,
) {
  return z
    .record(z.string(), z.union([z.string(), z.boolean(), z.array(z.string())]))
    .superRefine((values, ctx) => {
      const error = (key: string, message: string) =>
        ctx.addIssue({ code: "custom", path: [key], message });
      for (const [key, rule] of Object.entries(fields)) {
        const raw = values[key];
        const value = typeof raw === "string" ? raw.trim() : "";
        if (raw !== undefined && typeof raw !== "string") {
          error(key, "Enter a text value.");
          continue;
        }
        if (!value) {
          if (rule.endsWith("!")) error(key, "This field is required.");
          continue;
        }
        const [type, a, b] = rule.replace(/!$/, "").split(":");
        if (
          count(value) >
          (type === "text" ? Number(a) : type === "url" ? 2048 : 2500)
        )
          error(key, "This value is too long.");
        if (type === "url" && !httpUrl(value))
          error(key, "Use a complete HTTP or HTTPS URL.");
        if (
          type === "email" &&
          (count(value) > 254 || !z.email().safeParse(value).success)
        )
          error(key, "Enter a valid email address.");
        if (type === "phone" && !/^[+()\d\s.-]{7,25}$/.test(value))
          error(key, "Enter a valid phone number.");
        if (type === "month" && !month(value))
          error(key, "Use a valid month (YYYY-MM).");
        if (type === "date" && !calendar(value))
          error(key, "Use a valid calendar date.");
        if (
          (type === "number" || type === "integer") &&
          (!/^\d+(\.\d+)?$/.test(value) ||
            Number(value) < Number(a) ||
            Number(value) > Number(b) ||
            (type === "integer" && !Number.isInteger(Number(value))))
        )
          error(key, `Enter a number from ${a} to ${b}.`);
        if (type === "enum" && !a.split("|").includes(value))
          error(key, "Choose a supported option.");
        if (type === "proficiency" && !contract.proficiency.includes(value))
          error(key, "Choose a supported proficiency.");
        if (type === "currency" && !/^[A-Z]{3}$/.test(value))
          error(key, "Use a three-letter uppercase currency code.");
        if (type === "listtext") {
          const list = value
            .split(/[,\n]/)
            .map((v) => v.trim())
            .filter(Boolean);
          if (
            !list.length ||
            list.length > 30 ||
            list.some((v) => count(v) > 100) ||
            new Set(list.map((v) => v.toLowerCase())).size !== list.length
          )
            error(
              key,
              "Use up to 30 distinct, nonempty items (100 characters each).",
            );
        }
      }
      for (const flag of [
        "public",
        "current",
        "neverExpires",
        "featured",
        "available",
        "publicEmail",
        "publicPhone",
      ])
        if (values[flag] !== undefined && typeof values[flag] !== "boolean")
          error(flag, "Choose a valid boolean value.");
      for (const [start, end] of [
        ["start", "end"],
        ["issue", "expiry"],
        ["filing", "grant"],
      ]) {
        if (
          (end === "end" && values.current) ||
          (end === "expiry" && values.neverExpires)
        )
          continue;
        if (
          values[start] &&
          values[end] &&
          String(values[end]) < String(values[start])
        )
          error(end, "The end date must be on or after the start date.");
      }
      if (
        ["employment", "careerBreaks"].includes(collection ?? "") &&
        !values.current &&
        !values.end
      )
        error("end", "Add an end month or mark this entry current.");
      if (
        section === "personal" &&
        values.dob &&
        String(values.dob) > new Date().toISOString().slice(0, 10)
      )
        error("dob", "Date of birth cannot be in the future.");
      if (section === "career" && values.salary && !values.currency)
        error("currency", "Choose a currency when entering compensation.");
    })
    .transform(
      (values) =>
        Object.fromEntries(
          Object.entries(values).map(([key, value]) => [
            key,
            typeof value === "string" ? value.trim() : value,
          ]),
        ) as Values,
    );
}

export const profileRecordSchema = (collection: ProfileCollection) =>
  profileFieldsSchema(contract.collections[collection], undefined, collection);
export const profileSectionSchema = (section: ProfileSection) =>
  profileFieldsSchema(contract.sections[section], section);
export function profileDuplicate(
  collection: ProfileCollection,
  record: ProfileRecord,
  existing: { id: string; name?: unknown }[],
) {
  return (
    ["skills", "technicalSkills", "languages"].includes(collection) &&
    existing.some(
      (row) =>
        row.id !== record.id &&
        String(row.name).trim().toLowerCase() ===
          String(record.name).trim().toLowerCase(),
    )
  );
}
export function validationFields(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

export type MediaPurpose = keyof typeof mediaDefaults.rules;
export type PostMediaLimits = {
  maxPages: number;
  maxWords: number;
  maxImagePixels: number;
  maxGifFrames: number;
  maxGifPixels: number;
};
export type MediaPolicy = {
  rules: Record<MediaPurpose, [number, string[], string[]]>;
  fileConcurrency: number;
  partConcurrency: number;
  retries: number;
  postMaxItems: number;
  postTotalBytes: number;
  postLimits?: PostMediaLimits;
  jobTotalBytes: number;
};
const defaultPostLimits: PostMediaLimits = (
  mediaDefaults as { postLimits?: PostMediaLimits }
).postLimits ?? {
  maxPages: 300,
  maxWords: 1_000_000,
  maxImagePixels: 36_000_000,
  maxGifFrames: 500,
  maxGifPixels: 36_152_320,
};
const extensionMime: Record<string, string[]> = {
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  heic: ["image/heic", "image/heif"],
  heif: ["image/heif", "image/heic"],
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  rtf: ["application/rtf", "text/rtf"],
  txt: ["text/plain"],
  mp4: ["video/mp4", "application/mp4"],
  mov: ["video/quicktime"],
  webm: ["video/webm", "application/webm"],
  mkv: ["video/x-matroska", "video/mkv"],
};
let policy: MediaPolicy = {
  ...mediaDefaults,
  rules: mediaDefaults.rules as unknown as MediaPolicy["rules"],
  postLimits: defaultPostLimits,
};
export const mediaRules = Object.fromEntries(
  Object.entries(policy.rules).map(([key, [max, extensions, types]]) => [
    key,
    { max, extensions, types },
  ]),
) as Record<
  MediaPurpose,
  { max: number; extensions: string[]; types: string[] }
>;
export const getMediaPolicy = () => policy;
export function setMediaPolicy(next: MediaPolicy) {
  for (const key of Object.keys(mediaRules) as MediaPurpose[]) {
    const rule = next.rules[key];
    if (!rule || !Number.isSafeInteger(rule[0]) || rule[0] < 1)
      throw new Error("Invalid media policy.");
    mediaRules[key] = { max: rule[0], extensions: rule[1], types: rule[2] };
  }
  policy = {
    ...next,
    postLimits: next.postLimits ?? policy.postLimits ?? defaultPostLimits,
  };
}
export function mediaSizeLabel(bytes: number): string {
  return bytes >= 1048576
    ? `${Math.round(bytes / 1048576)} MB`
    : `${bytes / 1024} KB`;
}
export function resolveMediaMime(
  file: File,
  purpose: MediaPurpose,
): string | null {
  const rule = mediaRules[purpose];
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!(rule.extensions as readonly string[]).includes(extension)) return null;
  if ((rule.types as readonly string[]).includes(file.type)) return file.type;
  const candidates = extensionMime[extension] ?? [];
  const match = candidates.find((type) =>
    (rule.types as readonly string[]).includes(type),
  );
  return !file.type && match ? match : null;
}
export function withResolvedMediaMime(
  file: File,
  purpose: MediaPurpose,
): File | null {
  const mime = resolveMediaMime(file, purpose);
  if (!mime) return null;
  return mime === file.type
    ? file
    : new File([file], file.name, {
        type: mime,
        lastModified: file.lastModified,
      });
}
export function validateMedia(
  file: File | null,
  purpose: MediaPurpose,
  sizeLimit = mediaRules[purpose].max,
): string | null {
  if (!file || !file.size) return "Choose a nonempty file.";
  if ([...file.name].length > 180 || /[\\/\u0000-\u001f]/.test(file.name))
    return "Rename the file using at most 180 characters without path separators or control characters.";
  if (file.size > sizeLimit)
    return `Choose a file up to ${mediaSizeLabel(sizeLimit)}.`;
  if (!resolveMediaMime(file, purpose)) return "Choose a supported file type.";
  return null;
}
function gifFrameCount(bytes: Uint8Array): number | null {
  const header = String.fromCharCode(...bytes.slice(0, 6));
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  let i = 6;
  let frames = 0;
  while (i < bytes.length) {
    const marker = bytes[i++];
    if (marker === 0x3b) break;
    if (marker === 0x2c) {
      frames++;
      if (i + 9 > bytes.length) return null;
      i += 8;
      const packed = bytes[i++];
      if (packed & 0x80) {
        const table = 3 * (2 << (packed & 0x07));
        i += table;
      }
      i++;
      while (i < bytes.length) {
        const size = bytes[i++];
        if (!size) break;
        i += size;
      }
    } else if (marker === 0x21) {
      i++;
      while (i < bytes.length) {
        const size = bytes[i++];
        if (!size) break;
        i += size;
      }
    }
  }
  return frames;
}
async function imageMetrics(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await Promise.race([
      createImageBitmap(file),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 250)),
    ]);
    if (!bitmap) return null;
    const metrics = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return metrics;
  } catch {
    return null;
  }
}
export async function validatePostMediaContent(
  file: File,
): Promise<string | null> {
  const limits = getMediaPolicy().postLimits ?? defaultPostLimits;
  const mime = resolveMediaMime(file, "post_image");
  if (!mime) return "Choose a supported file type.";
  if (mime.startsWith("image/") && mime !== "image/heic" && mime !== "image/heif") {
    if (mime === "image/gif") {
      const frames = gifFrameCount(new Uint8Array(await file.arrayBuffer()));
      if (frames === null || frames < 1) return "Choose a valid GIF file.";
      if (frames > limits.maxGifFrames)
        return "Choose a GIF with at most 500 frames.";
    }
    const metrics = await imageMetrics(file);
    if (metrics) {
      if (metrics.width * metrics.height > limits.maxImagePixels)
        return "Choose an image up to 36 megapixels.";
      if (
        mime === "image/gif" &&
        metrics.width * metrics.height > limits.maxGifPixels
      )
        return "Choose a GIF within the pixel limit.";
    }
  }
  return null;
}
