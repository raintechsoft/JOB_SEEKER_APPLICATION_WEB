import type { Company, Job, JobAlert, JobWizardValues } from "@/types/domain";
import { DAY_MS, today } from "@/lib/utils/date";
import { formatCompensation } from "./job-compensation";

export const JOB_THUMBNAIL_TEMPLATES = [
  { id: "cobalt", name: "Cobalt studio", description: "A bold blue hiring announcement." },
  { id: "sage", name: "Fresh perspective", description: "Warm neutrals and a calm green accent." },
  { id: "graphite", name: "After hours", description: "Graphite with a clear, modern statement." },
  { id: "lavender", name: "Room to grow", description: "A soft lavender editorial layout." },
] as const;

export type JobStatus = "Draft" | "Closed" | "Expired" | "Active";

export const jobStatus = (j: Job): JobStatus => (j.draft ? "Draft" : j.closed ? "Closed" : (j.closesAt ? Date.parse(j.closesAt)<=Date.now() : j.expiresAt && j.expiresAt < today()) ? "Expired" : "Active");

export const isOpenJob = (j: Pick<Job,"closed"|"draft"|"closesAt"|"expiresAt">) => !j.closed && !j.draft && (j.closesAt ? Date.parse(j.closesAt)>Date.now() : !j.expiresAt || j.expiresAt >= today());

/** Company as candidates see it on a job, honouring "hide company". */
export function displayJobCompany(job: Pick<Job, "hideCompany" | "companyDisplayName">, company: Company) {
  return job.hideCompany
    ? { ...company, name: "Confidential company", industry: "Company information hidden", confidential: true as const }
    : { ...company, name: job.companyDisplayName || company.name, confidential: false as const };
}

/** Keyword normalisation used by job alerts ("designers" → "design"). */
export const normalizeKeywords = (v: string | undefined) =>
  String(v || "")
    .toLowerCase()
    .replace(/\bdesigners?\b/g, "design")
    .replace(/\bdevelopers?\b/g, "develop")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function matchesAlert(job: Job, alert: JobAlert) {
  if (!alert.enabled || !isOpenJob(job)) return false;
  const text = normalizeKeywords([job.title, ...job.skills].join(" "));
  return (
    normalizeKeywords(alert.keywords)
      .split(" ")
      .filter(Boolean)
      .every((word) => text.includes(word)) &&
    (!alert.location || normalizeKeywords(job.location).includes(normalizeKeywords(alert.location))) &&
    (alert.arrangement === "Any" || job.arrangement === alert.arrangement) &&
    Date.now() - Date.parse(job.createdAt) <= Number(alert.days || 7) * DAY_MS
  );
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

export function formatSalary(v: Pick<JobWizardValues, "hideSalary" | "currency" | "salaryMin" | "salaryMax" | "variableEnabled" | "variablePercent" | "compensation">) {
  if (v.compensation) return formatCompensation(v.compensation);
  if (v.hideSalary) return "Salary not disclosed";
  const symbol = CURRENCY_SYMBOLS[v.currency] || v.currency;
  return `${symbol}${v.salaryMin}–${v.salaryMax}${v.currency === "INR" ? " LPA" : " per year"}${v.variableEnabled && v.variablePercent ? " + " + v.variablePercent + "% variable" : ""}`;
}

export const currencySymbol = (currency: string) => CURRENCY_SYMBOLS[currency] ?? currency;

const ALERT_ARRANGEMENTS = ["On-site", "Hybrid", "Remote"] as const;

function clip(value: string, max: number) {
  return value.trim().slice(0, max).trim();
}

/** Build a job-alert payload for similar titles in a similar location. */
export function similarJobAlertInput(job: Pick<Job, "title" | "role" | "location" | "arrangement" | "skills">): Omit<JobAlert, "id"> {
  const title = clip(job.title, 100);
  const keywords = clip(job.title || job.role || job.skills[0] || "", 200);
  const location = clip((job.location || "").split("·")[0] || "", 200);
  const arrangement = ALERT_ARRANGEMENTS.includes(job.arrangement as (typeof ALERT_ARRANGEMENTS)[number]) ? (job.arrangement as JobAlert["arrangement"]) : "Any";
  const name = clip(title ? "Similar to " + title : "Similar jobs", 100);
  return { name, keywords, location, arrangement, days: 7, enabled: true };
}

export function isSimilarJobAlert(alert: Pick<JobAlert, "keywords" | "location" | "arrangement">, job: Pick<Job, "title" | "role" | "location" | "arrangement" | "skills">) {
  const target = similarJobAlertInput(job);
  return normalizeKeywords(alert.keywords) === normalizeKeywords(target.keywords) && normalizeKeywords(alert.location) === normalizeKeywords(target.location) && alert.arrangement === target.arrangement;
}
