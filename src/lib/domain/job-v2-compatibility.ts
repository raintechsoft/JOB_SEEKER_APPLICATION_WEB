import { z } from "zod";
import rules from "../../../../../contracts/validation/job-v2.json";
import legacyRules from "../../../../../contracts/validation/job.json";
import type { JobWizardValues } from "@/types/domain";
import { jobV2DraftSchema, moneyMinor, moneyString, type JobValuesV2 } from "@/lib/validation/job-v2";

export type JobValueRepresentation = "legacy-draft" | "legacy-stored" | "v2";
const integer = z.union([z.number().int(), z.string().regex(/^(?:0|[1-9]\d*)$/).transform(Number)]).nullable();
const nullableInteger = (v: unknown) => integer.parse(v === "" ? null : v);
function amount(v: string, multiplier: bigint) {
  if (v === "") return null;
  const converted = moneyMinor(v) * multiplier;
  const result = moneyString(converted);
  moneyMinor(result);
  return result;
}

/** Explicit source representation prevents guessing units and multiplying a v2 value twice. */
export function jobValuesToV2(input: JobWizardValues | JobValuesV2, representation: JobValueRepresentation): JobValuesV2 {
  z.enum(["legacy-draft", "legacy-stored", "v2"]).parse(representation);
  if (representation === "v2") return jobV2DraftSchema.parse(structuredClone(input));
  if ("schemaVersion" in input) throw new Error("Versioned values cannot be interpreted as a legacy job.");
  const v = structuredClone(input) as JobWizardValues;
  const { currency, salaryMin, salaryMax, hideSalary, variableEnabled, variablePercent, expiresAt, experienceMin, experienceMax, vacancies, ...rest } = v;
  const factor = representation === "legacy-draft" && currency === "INR" ? BigInt(rules.compatibility.legacyInrDraftMultiplier) : 1n;
  const min = amount(salaryMin, factor), max = amount(salaryMax, factor);
  const fixed = min !== null && max !== null && moneyMinor(min) === moneyMinor(max);
  const unspecified = min === null && max === null && !variableEnabled;
  return jobV2DraftSchema.parse({ ...rest, schemaVersion: 2,
    experienceMin: nullableInteger(experienceMin), experienceMax: nullableInteger(experienceMax), vacancies: nullableInteger(vacancies),
    compensation: { kind: "salary", format: unspecified ? "unspecified" : fixed ? "fixed" : "range", currency, period: unspecified ? null : "year", minAmount: min, maxAmount: fixed ? null : max, hidden: hideSalary, variableEnabled, variablePercent: variablePercent === "" ? null : moneyString(moneyMinor(variablePercent)), scaleLabel: null, notes: "", allowances: [], schedule: [] },
    deadline: expiresAt ? {date: expiresAt, time: null, timezone: "UTC", offset: null} : null,
  });
}

/** Compatibility is deliberately lossless or refused; monthly/case pay never enters an annual v1 payload. */
export function jobValuesToLegacy(input: JobValuesV2, representation: Exclude<JobValueRepresentation, "v2">): JobWizardValues {
  z.enum(["legacy-draft", "legacy-stored"]).parse(representation);
  const { schemaVersion: _schemaVersion, compensation: c, deadline, ...rest } = jobV2DraftSchema.parse(input);
  if (c.kind !== "salary" || !["fixed", "range", "unspecified"].includes(c.format) || (c.period !== null && c.period !== "year") || c.notes || c.allowances.length || c.schedule.length || !c.currency || (deadline && (deadline.time !== null || deadline.timezone !== "UTC")) || (rest.vacancies !== null && rest.vacancies > 999) || !["", ...legacyRules.employment].includes(rest.employment) || rest.education.some(q => !legacyRules.education.includes(q))) throw new Error("This job cannot be represented by the annual v1 contract without losing information.");
  const divisor = representation === "legacy-draft" && c.currency === "INR" ? BigInt(rules.compatibility.legacyInrDraftMultiplier) : 1n;
  const convert = (v: string | null) => { if (v === null) return ""; const minor = moneyMinor(v); if (minor % divisor !== 0n) throw new Error("The legacy LPA field cannot represent this amount exactly."); return moneyString(minor / divisor); };
  return { ...rest, currency: c.currency, salaryMin: convert(c.minAmount), salaryMax: convert(c.format === "fixed" ? c.minAmount : c.maxAmount), hideSalary: c.hidden, variableEnabled: c.variableEnabled, variablePercent: c.variablePercent === null ? "" : moneyString(moneyMinor(c.variablePercent)), expiresAt: deadline?.date ?? "", experienceMin: rest.experienceMin ?? "", experienceMax: rest.experienceMax ?? "", vacancies: rest.vacancies ?? "" } as JobWizardValues;
}
