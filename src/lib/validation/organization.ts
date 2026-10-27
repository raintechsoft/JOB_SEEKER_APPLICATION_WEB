import { z } from "zod";
import contract from "../../../contracts/validation/organization.json";
import { validateOrganization } from "@/lib/domain/organization";
import type { Organization, RecruiterMember, Verification } from "@/types/domain";

function validateFields(values: Record<string, unknown>, fields: Record<string, string>, issue: (key: string, message: string) => void) {
  for (const [key, rule] of Object.entries(fields)) {
    const value = values[key];
    if (value !== undefined && typeof value !== "string") { issue(key, "Enter a text value."); continue; }
    const text = String(value ?? "").trim();
    if (!text) { if (rule.endsWith("!")) issue(key, "This field is required."); continue; }
    const [type, limit] = rule.replace(/!$/, "").split(":");
    if ([...text].length > (type === "text" ? Number(limit) : type === "url" ? 2048 : 254)) issue(key, "This value is too long.");
    if (type === "email" && !z.email().safeParse(text).success) issue(key, "Enter a valid email address.");
    if (type === "url") { try { if (!["https:", "http:"].includes(new URL(text).protocol)) issue(key, "Use an HTTP or HTTPS URL."); } catch { issue(key, "Use a complete HTTP or HTTPS URL."); } }
    if (type === "slug" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text)) issue(key, "Use lowercase letters, numbers, and single hyphens.");
    if (type === "year" && (!/^\d{4}$/.test(text) || Number(text) < 1800 || Number(text) > new Date().getUTCFullYear())) issue(key, "Choose a year from 1800 to this year.");
    if (type === "enum" && !limit.split("|").includes(text)) issue(key, "Choose a supported option.");
    if (type === "phone" && !/^[+()\d\s.-]{7,25}$/.test(text)) issue(key, "Enter a valid phone number.");
  }
}
function list(values: unknown, key: string, issue: (key: string, message: string) => void) {
  if (!Array.isArray(values) || values.length > 20 || values.some((v) => typeof v !== "string" || !v.trim() || [...v.trim()].length > 100) || new Set(values.map((v) => String(v).trim().toLowerCase())).size !== values.length) issue(key, "Use up to 20 distinct items, each at most 100 characters.");
}
const managed = (value: string) => !value || /^https?:\/\/[^/]+\/api\/v1\/media\/[0-9a-f-]{36}\/download$/.test(value);
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
const strings = (value: unknown, keys: string[]) => object(value) && keys.every((key) => typeof value[key] === "string");
export const organizationSchema = z.custom<Organization>((v) => strings(v, [...Object.keys(contract.fields), "logoUrl", "coverImageUrl"]) && object(v) && contract.lists.every((key) => Array.isArray(v[key])) && strings(v.socialLinks, ["linkedin", "other"]) && Array.isArray(v.workplaceImages) && v.workplaceImages.every((image) => strings(image, ["url", "alt"]) && object(image) && typeof image.bytes === "number"), "The organization draft is incomplete. Reload and try again.").superRefine((organization, ctx) => {
  const issue = (key: string, message: string) => ctx.addIssue({ code: "custom", path: key.split("."), message });
  validateFields(organization as unknown as Record<string, unknown>, contract.fields, issue);
  if (!Number.isInteger(organization.version) || organization.version! < 1) issue("version", "Reload the organization before saving.");
  for (const [key, message] of Object.entries(validateOrganization(organization))) issue(key, message);
  for (const key of contract.lists) list((organization as unknown as Record<string, unknown>)[key], key, issue);
  for (const key of contract.flags) if (typeof (organization as unknown as Record<string, unknown>)[key] !== "boolean") issue(key, "Choose a valid boolean value.");
  for (const key of ["logoUrl", "coverImageUrl"] as const) if (!managed(organization[key])) issue(key, "Upload a managed image first.");
  if (organization.workplaceImages.length > 4 || organization.workplaceImages.reduce((n, v) => n + v.bytes, 0) > 1572864) issue("workplaceImages", "Use up to four workplace images totaling 1.5 MB.");
  for (const image of organization.workplaceImages) if (!z.uuid().safeParse(image.id).success || !managed(image.url) || [...image.alt].length > 200 || !Number.isInteger(image.bytes) || image.bytes < 1 || image.bytes > 512000) issue("workplaceImages", "Use uploaded images within 500 KB and alt text up to 200 characters.");
  if (new Set(organization.workplaceImages.map((image) => image.id)).size !== organization.workplaceImages.length) issue("workplaceImages", "Use each image only once.");
  validateFields(organization.socialLinks, { linkedin: "url", other: "url" }, (key, message) => issue("socialLinks." + key, message));
});
export const recruiterSchema = z.custom<RecruiterMember>((v) => strings(v, [...Object.keys(contract.recruiter), "avatarUrl"]) && object(v) && Array.isArray(v.hiringDepartments) && Array.isArray(v.hiringLocations) && strings(v.professionalLinks, ["linkedin"]), "The recruiter draft is incomplete. Reload and try again.").superRefine((member, ctx) => {
  const issue = (key: string, message: string) => ctx.addIssue({ code: "custom", path: key.split("."), message });
  validateFields(member as unknown as Record<string, unknown>, contract.recruiter, issue);
  if (!Number.isInteger(member.version) || member.version! < 1) issue("version", "Reload the recruiter profile before saving.");
  list(member.hiringDepartments, "hiringDepartments", issue); list(member.hiringLocations, "hiringLocations", issue);
  if (!managed(member.avatarUrl)) issue("avatarUrl", "Upload a managed portrait first.");
  validateFields(member.professionalLinks, { linkedin: "url" }, (key, message) => issue("professionalLinks." + key, message));
});
export const verificationSchema = (submit: boolean) => z.custom<Verification>((v) => strings(v, Object.keys(contract.verification)) && object(v) && Array.isArray(v.documents) && v.documents.every((document) => strings(document, ["id"])), "The verification draft is incomplete. Reload and try again.").superRefine((verification, ctx) => {
  const issue = (key: string, message: string) => ctx.addIssue({ code: "custom", path: [key], message });
  validateFields(verification as unknown as Record<string, unknown>, Object.fromEntries(Object.entries(contract.verification).map(([key, rule]) => [key, rule + (submit ? "!" : "")])), issue);
  if (verification.documents.length > 5 || (submit && !verification.documents.length)) issue("documents", "Attach one to five managed business documents.");
  for (const document of verification.documents) if (!z.uuid().safeParse(document.id).success) issue("documents", "Upload business documents before submitting.");
});
