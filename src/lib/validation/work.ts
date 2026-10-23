import { z } from "zod";
import contract from "../../../../../contracts/validation/work.json";
import { today } from "@/lib/utils/date";
import { validateMedia } from "./profile";

const length = (value: string, max: number) => [...value].length <= max;
const text = (max: number) => z.string().trim().min(1, "This field is required.").refine((value) => length(value, max), `Use at most ${max} characters.`);
const optionalUrl = z.string().trim().refine((value) => { if (!value) return true; try { return value.length <= 2048 && ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; } }, "Use a complete HTTP or HTTPS URL.");
const date = z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v && v >= contract.minimumDate && v <= today(), "Choose a valid calendar date from 1800 through today (UTC).");
export const workSkills = (raw: string) => raw.split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
export const workSkillArray = z.array(text(contract.skillLength)).min(1, "Add at least one skill.").max(contract.skillsMax).refine((values) => new Set(values.map((value) => value.toLowerCase())).size === values.length, "Use distinct skills.");
const skills = z.string().refine((value) => workSkillArray.safeParse(workSkills(value)).success, "Use 1–30 distinct skills, up to 100 characters each.");
export const projectSchema = z.object({
  title: text(120), category: z.enum(["Design", "Engineering", "Data", "Business"]), description: text(2000), contribution: text(1200), skills,
  url: optionalUrl, repository: optionalUrl, start: date, date, visibility: z.enum(["Public", "Private"]), featured: z.boolean(),
  coverFile: z.custom<FileList | null>((v) => v == null || (typeof FileList !== "undefined" && v instanceof FileList), "Select an image file.").optional(),
}).superRefine((values, ctx) => {
  if (values.start > values.date) ctx.addIssue({ code: "custom", path: ["date"], message: "Completion date must be on or after the start date." });
  if (values.coverFile?.length) { const error = values.coverFile.length > 1 ? "Select one cover image." : validateMedia(values.coverFile[0], "project_cover"); if (error) ctx.addIssue({ code: "custom", path: ["coverFile"], message: error }); }
});
export type ProjectFormValues = z.input<typeof projectSchema>;
export const projectInputSchema = z.object({ title: text(120), category: z.enum(["Design", "Engineering", "Data", "Business"]), description: text(2000), contribution: text(1200), skills: workSkillArray, url: optionalUrl, repository: optionalUrl, start: date, date, visibility: z.enum(["Public", "Private"]), featured: z.boolean() }).refine((v) => v.start <= v.date, { path: ["date"], message: "Completion date must be on or after the start date." });
export const updateSchema = z.object({ title: text(150), description: text(2000), category: z.enum(["Design", "Development", "Research", "Learning", "Marketing", "Collaboration"]), date, skills, project: z.string(), visibility: z.enum(["Public", "Private"]) });
export const updateInputSchema = updateSchema.omit({ skills: true }).extend({ skills: workSkillArray, project: z.union([z.literal(""), z.uuid()]) });
export type UpdateFormValues = z.input<typeof updateSchema>;
