import type { Company, Job, JobAlert, JobWizardValues } from "@/types/domain";
import { DAY_MS, today } from "@/lib/utils/date";

export const JOB_THUMBNAIL_TEMPLATES = [
  { id: "cobalt", name: "Cobalt studio", description: "A bold blue hiring announcement." },
  { id: "sage", name: "Fresh perspective", description: "Warm neutrals and a calm green accent." },
  { id: "graphite", name: "After hours", description: "Graphite with a clear, modern statement." },
  { id: "lavender", name: "Room to grow", description: "A soft lavender editorial layout." },
] as const;

export type JobStatus = "Draft" | "Closed" | "Expired" | "Active";

export const jobStatus = (j: Job): JobStatus => (j.draft ? "Draft" : j.closed ? "Closed" : j.expiresAt && j.expiresAt < today() ? "Expired" : "Active");

export const isOpenJob = (j: Job) => !j.closed && !j.draft && (!j.expiresAt || j.expiresAt >= today());

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
  if (!alert.enabled || job.closed || job.draft || (job.expiresAt && job.expiresAt < today())) return false;
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

export function formatSalary(v: Pick<JobWizardValues, "hideSalary" | "currency" | "salaryMin" | "salaryMax" | "variableEnabled" | "variablePercent">) {
  if (v.hideSalary) return "Salary not disclosed";
  const symbol = CURRENCY_SYMBOLS[v.currency] || v.currency;
  return `${symbol}${v.salaryMin}–${v.salaryMax}${v.currency === "INR" ? " LPA" : " per year"}${v.variableEnabled && v.variablePercent ? " + " + v.variablePercent + "% variable" : ""}`;
}

export const currencySymbol = (currency: string) => CURRENCY_SYMBOLS[currency] ?? currency;
