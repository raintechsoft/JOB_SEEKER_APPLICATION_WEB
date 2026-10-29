import { getCountries, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { z } from "zod";
import policy from "../../../contracts/validation/application-wizard.json";
import jobPolicy from "../../../contracts/validation/job-v2.json";
import { moneyMinor } from "./job-v2";

export const APPLICATION_WIZARD_RULES = policy;
export const applicationStepSchema = z.enum(["contact", "documents", "details", "questions", "review"]);
const uuid = z.uuid();
const revision = z.number().int().positive();
const text = (max: number) => z.string().trim().refine(value => !value.includes("\0") && [...value].length <= max, `Use at most ${max} characters without null characters.`);
const email = text(policy.limits.email).toLowerCase().refine(value => !value || /^[\x21-\x7e]+$/.test(value) && new RegExp(policy.emailPattern).test(value), "Enter a valid email address.");
const countries = new Set<string>(getCountries());
export function applicationPhoneE164(country: string, nationalNumber: string): string | null {
  if (!countries.has(country) || !/^\d{4,15}$/.test(nationalNumber)) return null;
  const phone = parsePhoneNumberFromString(nationalNumber, country as CountryCode);
  return phone?.isValid() && phone.country === country ? phone.number : null;
}
export const applicationPhoneSchema = z.object({country: z.string().refine(value => countries.has(value), "Choose a supported country."), nationalNumber: z.string().trim()}).strict().superRefine((value, ctx) => {
  if (!applicationPhoneE164(value.country, value.nationalNumber)) ctx.addIssue({code: "custom", path: ["nationalNumber"], message: "Enter a valid national phone number using digits only."});
});
const optionalDays = (max: number) => z.number().int().min(0).max(max).nullable();
export const applicationExpectedPaySchema = z.object({
  currency: z.enum(jobPolicy.currencies as [string, ...string[]]).nullable(),
  period: z.enum(jobPolicy.compensationPeriods as [string, ...string[]]).nullable(),
  amount: z.string().regex(new RegExp(jobPolicy.moneyPattern)).refine(value => {
    try { return moneyMinor(value) <= moneyMinor(jobPolicy.moneyMax); } catch { return false; }
  }, "Enter a supported exact amount.").nullable(),
}).strict();
const answers = z.record(uuid, text(policy.limits.answer)).refine(value => Object.keys(value).length <= policy.limits.answers, "Use only the supported screening questions.");
export const applicationWizardDraftValuesSchema = z.object({
  contact: z.object({name: text(policy.limits.name), email, phone: applicationPhoneSchema.nullable()}).strict(),
  documents: z.object({resumeAssetId: uuid.nullable(), includePortfolio: z.boolean()}).strict(),
  details: z.object({
    introduction: text(policy.limits.introduction), location: text(policy.limits.location), locality: text(policy.limits.locality),
    noticeDays: optionalDays(policy.limits.noticeDays), joiningDays: optionalDays(policy.limits.joiningDays),
    industry: text(policy.limits.industry), designation: text(policy.limits.designation), department: text(policy.limits.department),
    preferredLocations: z.array(text(policy.limits.preferredLocation).refine(Boolean, "Enter a location.")).max(policy.limits.preferredLocations).refine(items => new Set(items.map(item => item.toLowerCase())).size === items.length, "Use distinct locations."),
    expectedCompensation: applicationExpectedPaySchema.nullable(),
  }).strict(),
  answers,
}).strict().superRefine((value, ctx) => {
  if (new TextEncoder().encode(JSON.stringify(value)).length > policy.limits.draftBytes) ctx.addIssue({code: "custom", message: "This application exceeds the supported draft size."});
});
export type ApplicationWizardValues = z.infer<typeof applicationWizardDraftValuesSchema>;
export type ApplicationStep = z.infer<typeof applicationStepSchema>;
export const applicationRequirementsSchema = z.object({
  version: revision, questionsVersion: revision, jobVersion: revision,
  requireResume: z.boolean(), requirePhone: z.boolean(), requirePortfolio: z.boolean(),
  questions: z.array(z.object({id: uuid, text: text(policy.limits.question).refine(Boolean), type: z.enum(["text", "number", "yesno"]), required: z.boolean()}).strict()).max(policy.limits.answers).refine(items => new Set(items.map(item => item.id)).size === items.length, "Question IDs must be distinct."),
}).strict();
export type ApplicationRequirements = z.infer<typeof applicationRequirementsSchema>;

/** Cached server state for client feedback only; never part of a request or proof of authorization. */
export interface ApplicationWizardValidationContext {
  jobId: string;
  requirements: ApplicationRequirements;
  verifiedEmails: readonly string[];
  verifiedPhones: readonly string[];
  acceptedResumeAssetIds: readonly string[];
  portfolioReady: boolean;
  /** Server-generated final review fingerprint; not a contact or authorization proof. */
  reviewHash: string | null;
}

export function applicationWizardStageSchema(context: ApplicationWizardValidationContext, through: ApplicationStep) {
  const last = applicationStepSchema.options.indexOf(through);
  return applicationWizardDraftValuesSchema.superRefine((value, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({code: "custom", path, message});
    if (!value.contact.name) issue(["contact", "name"], "Enter your name.");
    if (!value.contact.email) issue(["contact", "email"], "Enter your email.");
    const phone = value.contact.phone;
    if (context.requirements.requirePhone && !phone) issue(["contact", "phone"], "Enter a phone number for this application.");
    if (last >= 1) {
      const selected = value.documents.resumeAssetId;
      if (context.requirements.requireResume && !selected) issue(["documents", "resumeAssetId"], "This job requires a resume.");
      if (selected && !context.acceptedResumeAssetIds.includes(selected)) issue(["documents", "resumeAssetId"], "Wait for an accepted resume or choose another file.");
      if (context.requirements.requirePortfolio && !value.documents.includePortfolio) issue(["documents", "includePortfolio"], "This job requires a portfolio.");
      if (value.documents.includePortfolio && context.requirements.requirePortfolio && !context.portfolioReady) issue(["documents", "includePortfolio"], "Add a shareable project or work sample to your portfolio.");
    }
    if (last >= 2) {
      const pay = value.details.expectedCompensation;
      if (pay && (pay.currency === null || pay.period === null || pay.amount === null)) issue(["details", "expectedCompensation"], "Complete the currency, payment period and amount, or clear expected pay.");
    }
    if (last >= 3) {
      const questions = context.requirements.questions;
      for (const id of Object.keys(value.answers)) if (!questions.some(question => question.id === id)) issue(["answers", id], "The questions changed. Review the current questions.");
      for (const question of questions) {
        const answer = value.answers[question.id] ?? "";
        if (question.required && !answer) issue(["answers", question.id], "Answer this required question.");
        else if (answer && question.type === "yesno" && !["Yes", "No"].includes(answer)) issue(["answers", question.id], "Choose Yes or No.");
        else if (answer && question.type === "number" && (!/^-?\d+(?:\.\d+)?$/.test(answer) || !Number.isFinite(Number(answer)) || Math.abs(Number(answer)) > policy.limits.numericAnswer)) issue(["answers", question.id], "Enter a supported finite number.");
      }
    }
  });
}

export const applicationDraftCreateSchema = z.object({schemaVersion: z.literal(2), creationKey: uuid}).strict();
export const applicationDraftSaveSchema = z.object({
  schemaVersion: z.literal(2), version: revision, requirementsVersion: revision, questionsVersion: revision, jobVersion: revision,
  step: applicationStepSchema, intent: z.enum(["save", "advance"]), values: applicationWizardDraftValuesSchema,
}).strict();
export const applicationSubmitRequestSchema = z.object({
  schemaVersion: z.literal(2), draftId: uuid, version: revision, requirementsVersion: revision, questionsVersion: revision, jobVersion: revision,
  idempotencyKey: uuid, acknowledgementVersion: z.literal(policy.acknowledgementVersion), sharingAcknowledged: z.literal(true),
  reviewHash: z.string().regex(/^[a-f0-9]{64}$/, "Review the current application before submitting."),
}).strict();
export const applicationDraftDiscardSchema = z.object({schemaVersion: z.literal(2), version: revision}).strict();
export const applicationContactChallengeSchema = z.discriminatedUnion("kind", [
  z.object({schemaVersion: z.literal(2), kind: z.literal("email"), email: email.refine(Boolean, "Enter an email address.")}).strict(),
  z.object({schemaVersion: z.literal(2), kind: z.literal("phone"), phone: applicationPhoneSchema}).strict(),
]);
export const applicationContactVerifySchema = z.object({schemaVersion: z.literal(2), code: z.string().regex(new RegExp(`^\\d{${policy.contact.codeLength}}$`), "Enter the complete verification code.")}).strict();
export const applicationDraftListSchema = z.object({page: z.number().int().positive().default(1), pageSize: z.number().int().min(1).max(policy.limits.pageSize).default(policy.limits.pageSize)}).strict();
