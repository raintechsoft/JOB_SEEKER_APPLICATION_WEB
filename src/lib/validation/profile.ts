import { z } from "zod";
import contract from "../../../contracts/validation/profile.json";
import type { ProfileCollection, ProfileRecord } from "@/types/domain";
import type { ProfileSection } from "@/services/profile/profile.service";

type Values = Record<string, string | boolean | string[] | undefined>;
const count = (value: string) => [...value].length;
const calendar = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const month = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1800;
const httpUrl = (value: string) => { try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; } };

export function profileFieldsSchema(fields: Record<string, string>, section?: string, collection?: string) {
  return z.record(z.string(), z.union([z.string(), z.boolean(), z.array(z.string())])).superRefine((values, ctx) => {
    const error = (key: string, message: string) => ctx.addIssue({ code: "custom", path: [key], message });
    for (const [key, rule] of Object.entries(fields)) {
      const raw = values[key];
      const value = typeof raw === "string" ? raw.trim() : "";
      if (raw !== undefined && typeof raw !== "string") { error(key, "Enter a text value."); continue; }
      if (!value) { if (rule.endsWith("!")) error(key, "This field is required."); continue; }
      const [type, a, b] = rule.replace(/!$/, "").split(":");
      if (count(value) > (type === "text" ? Number(a) : type === "url" ? 2048 : 2500)) error(key, "This value is too long.");
      if (type === "url" && !httpUrl(value)) error(key, "Use a complete HTTP or HTTPS URL.");
      if (type === "email" && (count(value) > 254 || !z.email().safeParse(value).success)) error(key, "Enter a valid email address.");
      if (type === "phone" && !/^[+()\d\s.-]{7,25}$/.test(value)) error(key, "Enter a valid phone number.");
      if (type === "month" && !month(value)) error(key, "Use a valid month (YYYY-MM).");
      if (type === "date" && !calendar(value)) error(key, "Use a valid calendar date.");
      if ((type === "number" || type === "integer") && (!/^\d+(\.\d+)?$/.test(value) || Number(value) < Number(a) || Number(value) > Number(b) || (type === "integer" && !Number.isInteger(Number(value))))) error(key, `Enter a number from ${a} to ${b}.`);
      if (type === "enum" && !a.split("|").includes(value)) error(key, "Choose a supported option.");
      if (type === "proficiency" && !contract.proficiency.includes(value)) error(key, "Choose a supported proficiency.");
      if (type === "currency" && !/^[A-Z]{3}$/.test(value)) error(key, "Use a three-letter uppercase currency code.");
      if (type === "listtext") {
        const list = value.split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
        if (!list.length || list.length > 30 || list.some((v) => count(v) > 100) || new Set(list.map((v) => v.toLowerCase())).size !== list.length) error(key, "Use up to 30 distinct, nonempty items (100 characters each).");
      }
    }
    for (const flag of ["public", "current", "neverExpires", "featured", "available", "publicEmail", "publicPhone"]) if (values[flag] !== undefined && typeof values[flag] !== "boolean") error(flag, "Choose a valid boolean value.");
    for (const [start, end] of [["start", "end"], ["issue", "expiry"], ["filing", "grant"]]) {
      if ((end === "end" && values.current) || (end === "expiry" && values.neverExpires)) continue;
      if (values[start] && values[end] && String(values[end]) < String(values[start])) error(end, "The end date must be on or after the start date.");
    }
    if (["employment", "careerBreaks"].includes(collection ?? "") && !values.current && !values.end) error("end", "Add an end month or mark this entry current.");
    if (section === "personal" && values.dob && String(values.dob) > new Date().toISOString().slice(0, 10)) error("dob", "Date of birth cannot be in the future.");
    if (section === "career" && values.salary && !values.currency) error("currency", "Choose a currency when entering compensation.");
  }).transform((values) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])) as Values);
}

export const profileRecordSchema = (collection: ProfileCollection) => profileFieldsSchema(contract.collections[collection], undefined, collection);
export const profileSectionSchema = (section: ProfileSection) => profileFieldsSchema(contract.sections[section], section);
export function profileDuplicate(collection: ProfileCollection, record: ProfileRecord, existing: { id: string; name?: unknown }[]) {
  return ["skills", "technicalSkills", "languages"].includes(collection) && existing.some((row) => row.id !== record.id && String(row.name).trim().toLowerCase() === String(record.name).trim().toLowerCase());
}
export function validationFields(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(error.issues.map((issue) => [issue.path.join("."), issue.message]));
}

export const mediaRules = {
  career_memory: {max:1048576,types:["image/png","image/jpeg","image/webp"],extensions:["png","jpg","jpeg","webp"]},
  message_attachment: {max:2097152,types:["image/png","image/jpeg","image/webp","image/gif","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/rtf","text/rtf","text/plain"],extensions:["png","jpg","jpeg","webp","gif","pdf","doc","docx","rtf","txt"]},
  post_image: { max: 1048576, types: ["image/png", "image/jpeg", "image/webp"], extensions: ["png", "jpg", "jpeg", "webp"] },
  job_thumbnail: { max: 1048576, types: ["image/png", "image/jpeg", "image/webp"], extensions: ["png", "jpg", "jpeg", "webp"] },
  job_attachment: { max: 1048576, types: ["image/png", "image/jpeg", "image/webp", "application/pdf", "video/mp4", "video/webm"], extensions: ["png", "jpg", "jpeg", "webp", "pdf", "mp4", "webm"] },
  project_cover: { max: 1048576, types: ["image/png", "image/jpeg", "image/webp"], extensions: ["png", "jpg", "jpeg", "webp"] },
  portrait: { max: 1048576, types: ["image/png", "image/jpeg", "image/webp"], extensions: ["png", "jpg", "jpeg", "webp"] },
  resume: { max: 2097152, types: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/rtf", "text/rtf"], extensions: ["pdf", "doc", "docx", "rtf"] },
  logo: { max: 512000, types: ["image/png", "image/jpeg", "image/webp"], extensions: ["png", "jpg", "jpeg", "webp"] },
  cover: { max: 1048576, types: ["image/png", "image/jpeg", "image/webp"], extensions: ["png", "jpg", "jpeg", "webp"] },
  gallery: { max: 512000, types: ["image/png", "image/jpeg", "image/webp"], extensions: ["png", "jpg", "jpeg", "webp"] },
  recruiter_photo: { max: 512000, types: ["image/png", "image/jpeg", "image/webp"], extensions: ["png", "jpg", "jpeg", "webp"] },
  business_document: { max: 2097152, types: ["application/pdf", "image/png", "image/jpeg"], extensions: ["pdf", "png", "jpg", "jpeg"] },
} as const;
export type MediaPurpose = keyof typeof mediaRules;
export function validateMedia(file: File | null, purpose: MediaPurpose): string | null {
  const rule = mediaRules[purpose];
  if (!file || !file.size) return "Choose a nonempty file.";
  if ([...file.name].length > 180 || /[\\/\u0000-\u001f]/.test(file.name)) return "Rename the file using at most 180 characters without path separators or control characters.";
  if (file.size > rule.max) return `Choose a file up to ${rule.max / 1024} KB.`;
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!(rule.extensions as readonly string[]).includes(extension) || !(rule.types as readonly string[]).includes(file.type)) return "Choose a supported file type.";
  return null;
}
