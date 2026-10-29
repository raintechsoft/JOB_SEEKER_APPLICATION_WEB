import {z} from "zod";
import {apiConfig} from "@/services/api/config";
import {applicationReturnPath, applicationSteps} from "@/lib/domain/application-wizard";
import type {components} from "@/types/generated/application-wizard-v2";
import {applicationPhoneE164, applicationStepSchema, type ApplicationStep, type ApplicationWizardValidationContext} from "@/lib/validation/application-wizard";

export type ApplicationDraft = components["schemas"]["ApplicationDraft"];
export type ApplicationContext = components["schemas"]["ApplicationContext"];
export type DocumentContext = components["schemas"]["ApplicationDocumentContext"];
export type ApplicationReview = components["schemas"]["ApplicationReview"];
export type ApplicationReceipt = components["schemas"]["ApplicationReceipt"];
export const applicationWizardEnabled = () => apiConfig.dataSource === "http" && process.env.NEXT_PUBLIC_APPLICATION_WIZARD_ENABLED === "true";
export function isApplicationWizardRoute(path: string) {
  const match = /^\/app\/jobs\/([^/]+)\/apply$/.exec(path);
  return !!match && z.uuid().safeParse(match[1]).success;
}
export function applicationSignInReturn(value: string | null | undefined): string | null {
  if (!value || value.length > 4096 || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20\x7f]/.test(value)) return null;
  const url = new URL(value, "https://skillora.invalid");
  if (url.hash) return null;
  const publicId = /^\/jobs\/([^/]+)$/.exec(url.pathname)?.[1];
  if (publicId && z.uuid().safeParse(publicId).success) return url.pathname;
  if (!isApplicationWizardRoute(url.pathname)) return null;
  const params = new URLSearchParams();
  if (url.searchParams.has("returnTo")) params.set("returnTo", applicationReturnPath(url.searchParams.get("returnTo") ?? undefined));
  const step = applicationStepSchema.safeParse(url.searchParams.get("step"));
  if (step.success) params.set("step", step.data);
  return url.pathname + (params.size ? `?${params}` : "");
}
export function applicationStage(context: ApplicationContext, draft: ApplicationDraft, requested?: string | null): ApplicationStep {
  const steps = applicationSteps(context.requirements);
  if (context.requirements.version !== draft.requirementsVersion || context.requirements.questionsVersion !== draft.questionsVersion || context.requirements.jobVersion !== draft.jobVersion) return "contact";
  const reached = Math.max(0, steps.indexOf(draft.reachedStep));
  const parsed = applicationStepSchema.safeParse(requested);
  if (parsed.success && steps.indexOf(parsed.data) >= 0 && steps.indexOf(parsed.data) <= reached) return parsed.data;
  return steps[Math.max(0, Math.min(reached, steps.indexOf(draft.step)))];
}
export function applicationValidationContext(context: ApplicationContext, documents: DocumentContext, accountEmail: string): ApplicationWizardValidationContext {
  const proof = context.contactStatus;
  const profilePhone=context.profilePhone?applicationPhoneE164(context.profilePhone.country,context.profilePhone.nationalNumber):null;
  return {jobId: context.jobId, requirements: context.requirements, verifiedEmails: [...new Set([accountEmail.toLowerCase(), ...(proof.email.verified ? [proof.email.value] : [])])], verifiedPhones: [...new Set([...(proof.phone?.verified ? [proof.phone.e164] : []),...(profilePhone?[profilePhone]:[])])], acceptedResumeAssetIds: [documents.resume?.id, documents.savedResume?.id].filter((id): id is string => !!id), portfolioReady: documents.portfolio.ready, reviewHash: null};
}
export function contactIsVerified(context: ApplicationWizardValidationContext, email: string, phone: {country: string; nationalNumber: string} | null) {
  return {email: context.verifiedEmails.includes(email.trim().toLowerCase()), phone: !!phone && typeof phone.country === "string" && typeof phone.nationalNumber === "string" && context.verifiedPhones.includes(applicationPhoneE164(phone.country, phone.nationalNumber.trim()) ?? "")};
}
