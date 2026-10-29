import policy from "../../../../../contracts/validation/application-wizard.json";
import { applicationStepSchema, type ApplicationRequirements, type ApplicationWizardValues } from "@/lib/validation/application-wizard";
import { moneyMinor } from "@/lib/validation/job-v2";
import { z } from "zod";

export const applicationSteps = (requirements: ApplicationRequirements) => applicationStepSchema.options.filter(step => step !== "questions" || requirements.questions.length > 0);
export function emptyApplicationWizardValues(): ApplicationWizardValues {
  return {contact: {name: "", email: "", phone: null}, documents: {resumeAssetId: null, includePortfolio: false}, details: {introduction: "", location: "", locality: "", noticeDays: null, joiningDays: null, industry: "", designation: "", department: "", preferredLocations: [], expectedCompensation: null}, answers: {}};
}
export function applicationReturnPath(value: string | undefined): string {
  if (!value || value.length > 2048 || /[\\\x00-\x20\x7f]/.test(value) || !value.startsWith("/") || value.startsWith("//")) return "/app/jobs";
  const parsed = new URL(value, "https://skillora.invalid");
  const allowed = policy.returnPaths.includes(parsed.pathname) || policy.returnPathPatterns.some(pattern => new RegExp(pattern).test(parsed.pathname));
  if (!allowed || parsed.hash || (parsed.pathname.startsWith("/jobs/") && !z.uuid().safeParse(parsed.pathname.slice(6)).success)) return "/app/jobs";
  return parsed.pathname + parsed.search;
}
export function applicationWizardPath(jobId: string, returnTo?: string): string {
  // Route identifiers follow the same UUID validation as future mutations.
  z.uuid().parse(jobId);
  return `/app/jobs/${jobId}/apply?returnTo=${encodeURIComponent(applicationReturnPath(returnTo))}`;
}
export function portfolioReady(items: readonly {title: string; description: string; url?: string | null; shareable: boolean}[]): boolean {
  return items.some(item => {
    let link = false;
    try { link = !!item.url && ["https:", "http:"].includes(new URL(item.url).protocol); } catch { /* No supported work-sample link. */ }
    return item.shareable && !!item.title.trim() && ([...item.description.trim()].length >= policy.limits.portfolioDescriptionMin || link);
  });
}
/** Read adapter only: never mutates a historical submission or treats LPA as monthly pay. */
export function legacyExpectedCompensation(value: string | null | undefined): ApplicationWizardValues["details"]["expectedCompensation"] {
  if (value === null || value === undefined || value === "") return null;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new Error("Invalid legacy expected compensation.");
  const fraction = match[2] ?? "";
  // One LPA is 100,000 rupees: seven LPA decimal places can still be exact paise.
  // The old application validator permitted more than two LPA decimal places.
  if (/[1-9]/.test(fraction.slice(7))) throw new Error("Legacy expected compensation cannot be represented without rounding.");
  const minor = BigInt(match[1]) * BigInt(policy.compatibility.legacyExpectedPayMultiplier) * 100n + BigInt(fraction.slice(0, 7).padEnd(7, "0"));
  // Parsing the computed amount through the same money helper retains the shared maximum.
  const amount = `${minor / 100n}.${String(minor % 100n).padStart(2, "0")}`;
  moneyMinor(amount);
  return {currency: policy.compatibility.legacyExpectedPayCurrency, period: policy.compatibility.legacyExpectedPayPeriod, amount};
}
