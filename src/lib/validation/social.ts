import { z } from "zod";
import contract from "../../../contracts/validation/social.json";
import jobRules from "../../../contracts/validation/job.json";
import { safeVideoUrl } from "@/lib/utils/url";
import {
  validateMedia,
  validatePostMediaContent,
  getMediaPolicy,
  withResolvedMediaMime,
} from "./profile";
import { linkPreviewContract, previewUrlInBody } from "./link-preview";

const text = (max: number) =>
  z
    .string()
    .trim()
    .refine((v) => [...v].length <= max, `Use at most ${max} characters.`);

const quickJobBaseSchema = z.object({
  enabled: z.boolean(),
  title: text(jobRules.text.title),
  locations: z
    .array(text(jobRules.itemLength).min(1, "Remove empty locations."))
    .max(jobRules.lists.locations)
    .refine(
      (items) => new Set(items.map((x) => x.toLowerCase())).size === items.length,
      "Use distinct locations.",
    ),
  employment: z
    .string()
    .refine(
      (v) => v === "" || (jobRules.employment as string[]).includes(v),
      "Choose an employment type.",
    ),
  arrangement: z
    .string()
    .refine(
      (v) => v === "" || (jobRules.arrangements as string[]).includes(v),
      "Choose a work arrangement.",
    ),
});
export const quickJobDraftSchema = quickJobBaseSchema;
export const quickJobPublishSchema = quickJobBaseSchema.superRefine((v, ctx) => {
  if (!v.enabled) return;
  if (!v.title.trim())
    ctx.addIssue({ code: "custom", path: ["title"], message: "Add a job title." });
  if (!v.locations.length)
    ctx.addIssue({
      code: "custom",
      path: ["locations"],
      message: "Add at least one location.",
    });
  if (!v.employment)
    ctx.addIssue({
      code: "custom",
      path: ["employment"],
      message: "Choose an employment type.",
    });
  if (!v.arrangement)
    ctx.addIssue({
      code: "custom",
      path: ["arrangement"],
      message: "Choose a work arrangement.",
    });
});
export const emptyQuickJob = (): z.infer<typeof quickJobBaseSchema> => ({
  enabled: false,
  title: "",
  locations: [],
  employment: "",
  arrangement: "",
});

export const postTextSchema = z.object({
  title: text(contract.titleMax),
  body: text(contract.bodyMax),
});
export const commentSchema = text(contract.commentMax).min(
  1,
  "Write a comment.",
);
export const socialRoleSchema = z.enum(["professional", "recruiter"]);
export const directVideoSchema = text(2048).refine(
  (v) => !!safeVideoUrl(v) && !new URL(v).username && !new URL(v).password,
  "Use a direct HTTP or HTTPS MP4 or WebM video URL without credentials.",
);
const managedDownload = (src: string) =>
  /^https?:\/\/[^?#]+\/api\/v1\/media\/[0-9a-f-]{36}\/download$/i.test(src);
export function postMediaKind(file: File): "image" | "video" | "document" {
  const resolved = withResolvedMediaMime(file, "post_image") ?? file;
  if (resolved.type.startsWith("image/")) return "image";
  if (
    resolved.type.startsWith("video/") ||
    resolved.type === "application/mp4" ||
    resolved.type === "application/webm"
  )
    return "video";
  return "document";
}
const mediaSchema = (localSelection = false) =>
  z
    .object({
      type: z.enum(["image", "video", "document"]),
      src: text(2048).min(1),
      alt: text(contract.altMax),
      name: text(180)
        .min(1)
        .regex(
          /^[^\\/\u0000-\u001f]+$/,
          "Use a file name without path separators or control characters.",
        ),
      bytes: z
        .number()
        .int()
        .min(1)
        .refine(
          (n) => n <= getMediaPolicy().rules.post_image[0],
          "The file exceeds the configured size limit.",
        )
        .optional(),
    })
    .superRefine((m, ctx) => {
      if (
        localSelection &&
        (/^blob:/.test(m.src) ||
          /^data:(image|video|application|text)\//.test(m.src))
      )
        return;
      if (m.type === "video") {
        if (
          !managedDownload(m.src) &&
          !directVideoSchema.safeParse(m.src).success
        )
          ctx.addIssue({
            code: "custom",
            path: ["src"],
            message: "Use a direct MP4 or WebM URL or upload a video file.",
          });
        return;
      }
      if (!managedDownload(m.src))
        ctx.addIssue({
          code: "custom",
          path: ["src"],
          message: "Upload this file before saving.",
        });
    });
const media = mediaSchema();
export const postDraftValuesSchema = z
  .object({
    title: text(contract.titleMax),
    body: text(contract.bodyMax),
    project: z.union([z.uuid(), z.literal("")]),
    media: z
      .array(media)
      .refine(
        (items) => items.length <= getMediaPolicy().postMaxItems,
        "The selection exceeds the configured upload limit.",
      ),
    videoUrl: text(2048),
    previewDismissedUrls: z
      .array(text(linkPreviewContract.urlMax).min(1))
      .max(linkPreviewContract.dismissedMax)
      .optional(),
    step: z.number().int().min(0).max(2),
    reached: z.number().int().min(0).max(2),
    commentsEnabled: z.boolean().default(true),
    quickJob: quickJobDraftSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.step > v.reached)
      ctx.addIssue({
        code: "custom",
        path: ["step"],
        message: "Complete the earlier steps first.",
      });
    if (
      v.media.reduce((n, m) => n + (m.bytes ?? 0), 0) >
      getMediaPolicy().postTotalBytes
    )
      ctx.addIssue({
        code: "custom",
        path: ["media"],
        message: "The selection exceeds the configured upload budget.",
      });
    if (new Set(v.media.map((m) => m.src)).size !== v.media.length)
      ctx.addIssue({
        code: "custom",
        path: ["media"],
        message: "Choose each media item once.",
      });
  });
const publicationSchema = (attachment: ReturnType<typeof mediaSchema>) =>
  z
    .object({
      ...postTextSchema.shape,
      project: z.union([z.uuid(), z.literal("")]),
      attachments: z
        .array(attachment)
        .refine(
          (items) => items.length <= getMediaPolicy().postMaxItems,
          "The selection exceeds the configured upload limit.",
        ),
      previewUrl: text(linkPreviewContract.urlMax).optional(),
      commentsEnabled: z.boolean().default(true),
      quickJob: quickJobPublishSchema.optional(),
    })
    .superRefine((v, ctx) => {
      if (v.previewUrl && !previewUrlInBody(v.previewUrl, v.body))
        ctx.addIssue({
          code: "custom",
          path: ["previewUrl"],
          message: "The previewed link must appear in your story.",
        });
      if (!v.title && !v.body && v.attachments.length === 0 && !v.project)
        ctx.addIssue({
          code: "custom",
          message: "Add a caption or media before publishing.",
        });
      if (
        new Set(v.attachments.map((m) => m.src)).size !==
          v.attachments.length ||
        v.attachments.reduce((n, m) => n + (m.bytes ?? 0), 0) >
          getMediaPolicy().postTotalBytes
      )
        ctx.addIssue({
          code: "custom",
          path: ["attachments"],
          message: "Choose distinct files within the configured upload budget.",
        });
      if (v.quickJob?.enabled) {
        const checked = quickJobPublishSchema.safeParse(v.quickJob);
        if (!checked.success) {
          for (const issue of checked.error.issues) {
            ctx.addIssue({
              code: "custom",
              path: ["quickJob", ...issue.path],
              message: issue.message,
            });
          }
        }
      }
    });
export const postPublishSchema = publicationSchema(media);
/** Editor-only validation; registered local files are resolved before strict transport validation. */
export const postSelectionSchema = publicationSchema(mediaSchema(true));
export const socialFeedSchema = z.object({
  role: socialRoleSchema,
  filter: z.enum(["all", "following", "jobs", "saved", "reposts"]),
  sort: z.enum(["recent", "popular", "recommended"]),
  q: text(200),
  limit: z.number().int().min(1).max(1000),
  cursor: z.string().trim().min(1).max(4096).optional(),
});
export const shareSearchSchema = text(contract.searchMax);
export const feedSearchSchema = text(200);
export const peopleSearchSchema = z.object({
  role: socialRoleSchema,
  q: feedSearchSchema.min(1, "Enter a name or headline."),
  limit: z.number().int().min(1).max(1000),
});
export const shareFollowersSchema = z
  .object({
    selectedIds: z
      .array(z.string().trim().min(1, "Choose a follower.").max(64))
      .min(1, "Choose at least one follower.")
      .max(
        contract.shareFollowersMax,
        `Choose up to ${contract.shareFollowersMax} followers.`,
      ),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.selectedIds).size !== value.selectedIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["selectedIds"],
        message: "Choose each follower once.",
      });
  });
export function parseShareFollowers(
  selectedIds: string[],
  allowedIds: Iterable<string>,
): { success: true; data: string[] } | { success: false; error: string } {
  const parsed = shareFollowersSchema.safeParse({ selectedIds });
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };
  const allowed = new Set(allowedIds);
  if (parsed.data.selectedIds.some((id) => !allowed.has(id)))
    return {
      success: false,
      error: "Choose followers from your current list.",
    };
  return { success: true, data: parsed.data.selectedIds };
}
export async function validatePostFiles(
  files: File[],
  existing: { type: string; bytes?: number }[],
): Promise<string | null> {
  if (files.length + existing.length > getMediaPolicy().postMaxItems)
    return "The selection exceeds the configured upload limit.";
  if (
    files.reduce((n, f) => n + f.size, 0) +
      existing.reduce((n, m) => n + (m.bytes ?? 0), 0) >
    getMediaPolicy().postTotalBytes
  )
    return "The selection exceeds the configured upload budget.";
  for (const file of files) {
    const error = validateMedia(file, "post_image");
    if (error) return error;
    const content = await validatePostMediaContent(file);
    if (content) return content;
  }
  return null;
}
