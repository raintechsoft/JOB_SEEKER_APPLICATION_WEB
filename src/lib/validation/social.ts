import { z } from "zod";
import contract from "../../../../../contracts/validation/social.json";
import { safeVideoUrl } from "@/lib/utils/url";
import { validateMedia } from "./profile";

const text = (max: number) => z.string().trim().refine((v) => [...v].length <= max, `Use at most ${max} characters.`);
export const postTextSchema = z.object({ title: text(contract.titleMax).min(1, "Add a post title."), body: text(contract.bodyMax).min(1, "Add your story.") });
export const commentSchema = text(contract.commentMax).min(1, "Write a comment.");
export const socialRoleSchema = z.enum(["professional", "recruiter"]);
export const directVideoSchema = text(2048).refine((v) => !!safeVideoUrl(v) && !new URL(v).username && !new URL(v).password, "Use a direct HTTP or HTTPS MP4 or WebM video URL without credentials.");
const media = z.object({ type: z.enum(["image", "video"]), src: text(2048).min(1), alt: text(contract.altMax), name: text(180).min(1).regex(/^[^\\/\u0000-\u001f]+$/, "Use a file name without path separators or control characters."), bytes: z.number().int().min(1).max(contract.imageBytesMax).optional() }).superRefine((m, ctx) => {
  if (m.type === "video" && !directVideoSchema.safeParse(m.src).success) ctx.addIssue({ code: "custom", path: ["src"], message: "Use a direct MP4 or WebM URL." });
  if (m.type === "image" && !/^https?:\/\/[^?#]+\/api\/v1\/media\/[0-9a-f-]{36}\/download$/i.test(m.src)) ctx.addIssue({ code: "custom", path: ["src"], message: "Upload this image before saving." });
});
export const postDraftValuesSchema = z.object({ title: text(contract.titleMax), body: text(contract.bodyMax), project: z.union([z.uuid(), z.literal("")]), media: z.array(media).max(contract.mediaMax), videoUrl: text(2048), step: z.number().int().min(0).max(2), reached: z.number().int().min(0).max(2) }).superRefine((v, ctx) => {
  if (v.step > v.reached) ctx.addIssue({ code: "custom", path: ["step"], message: "Complete the earlier steps first." });
  if (v.media.reduce((n, m) => n + (m.type === "image" ? m.bytes ?? 0 : 0), 0) > contract.totalImageBytesMax) ctx.addIssue({ code: "custom", path: ["media"], message: "Keep post images within 2 MB in total." });
  if (new Set(v.media.map((m) => m.src)).size !== v.media.length) ctx.addIssue({ code: "custom", path: ["media"], message: "Choose each media item once." });
});
export const postPublishSchema = z.object({ ...postTextSchema.shape, project: z.union([z.uuid(), z.literal("")]), attachments: z.array(media).max(contract.mediaMax) }).superRefine((v, ctx) => {
  for (const [i, m] of v.attachments.entries()) if (!m.alt) ctx.addIssue({ code: "custom", path: ["attachments", i, "alt"], message: "Describe this media for accessibility." });
  if (new Set(v.attachments.map((m) => m.src)).size !== v.attachments.length || v.attachments.reduce((n, m) => n + (m.type === "image" ? m.bytes ?? 0 : 0), 0) > contract.totalImageBytesMax) ctx.addIssue({ code: "custom", path: ["attachments"], message: "Choose distinct media within the 2 MB image limit." });
});
export const socialFeedSchema = z.object({ role: socialRoleSchema, filter: z.enum(["all", "following", "jobs", "saved", "reposts"]), sort: z.enum(["recent", "popular", "recommended"]), q: text(200), limit: z.number().int().min(1).max(1000) });
export const shareSearchSchema = text(contract.searchMax);
export const feedSearchSchema = text(200);
export const peopleSearchSchema = z.object({ role: socialRoleSchema, q: feedSearchSchema.min(1, "Enter a name or headline."), limit: z.number().int().min(1).max(1000) });
export const shareFollowersSchema = z.object({
  selectedIds: z
    .array(z.string().trim().min(1, "Choose a follower.").max(64))
    .min(1, "Choose at least one follower.")
    .max(contract.shareFollowersMax, `Choose up to ${contract.shareFollowersMax} followers.`),
}).superRefine((value, ctx) => {
  if (new Set(value.selectedIds).size !== value.selectedIds.length) ctx.addIssue({ code: "custom", path: ["selectedIds"], message: "Choose each follower once." });
});
export function parseShareFollowers(selectedIds: string[], allowedIds: Iterable<string>): { success: true; data: string[] } | { success: false; error: string } {
  const parsed = shareFollowersSchema.safeParse({ selectedIds });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const allowed = new Set(allowedIds);
  if (parsed.data.selectedIds.some((id) => !allowed.has(id))) return { success: false, error: "Choose followers from your current list." };
  return { success: true, data: parsed.data.selectedIds };
}
export function validatePostFiles(files: File[], existing: { type: string; bytes?: number }[]): string | null {
  if (files.length + existing.length > contract.mediaMax) return "Choose up to five media items.";
  if (files.reduce((n, f) => n + f.size, 0) + existing.reduce((n, m) => n + (m.type === "image" ? m.bytes ?? 0 : 0), 0) > contract.totalImageBytesMax) return "Keep post images within 2 MB in total.";
  for (const file of files) { const error = validateMedia(file, "post_image"); if (error) return error; }
  return null;
}
