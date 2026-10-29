import type { JobWizardValues } from "@/types/domain";
import { jobValuesToV2 } from "./job-v2-compatibility";
import { jobV2FormToApi } from "./job-v2-form";
import { deadlineInstants, jobV2Errors, type JobValuesV2 } from "@/lib/validation/job-v2";

/** Legacy controls are only a local bridge. Transport always sends canonical v2 values. */
export function jobEditorValues(values: JobValuesV2): JobWizardValues {
  const { compensation: c, deadline: d, ...rest } = values;
  return { ...rest, experienceMin: rest.experienceMin ?? "", experienceMax: rest.experienceMax ?? "", vacancies: rest.vacancies ?? "", compensation: c, deadline: d,
    currency: (c.currency ?? "INR") as JobWizardValues["currency"], salaryMin: "", salaryMax: "", hideSalary: c.hidden, variableEnabled: false, variablePercent: "", expiresAt: d?.date ?? "" };
}
export function jobEditorPayload(values: JobWizardValues, mode: "draft" | "publish" = "draft"): JobValuesV2 {
  if (values.schemaVersion !== 2) return jobValuesToV2(values, "legacy-draft");
  const { currency: _currency, salaryMin: _min, salaryMax: _max, hideSalary: _hidden, variableEnabled: _enabled, variablePercent: _percent, expiresAt: _date, ...canonical } = values;
  return jobV2FormToApi(canonical, mode);
}
export function jobEditorErrors(values: JobWizardValues, mode: "draft" | "publish" | number): Record<string, string> {
  try {
    const payload = jobEditorPayload(values);
    const errors = jobV2Errors(payload, mode);
    if (payload.deadline) {
      const d = payload.deadline;
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: d.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      if (d.date < today || Date.parse(d.date) - Date.parse(today) > 730 * 86400000 || (mode === "publish" && d.time && deadlineInstants(d)[0] <= Date.now())) errors.deadline = "Choose a future closing date/time within two years.";
    }
    return errors;
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error && Array.isArray(error.issues)) return Object.fromEntries(error.issues.map(i => [i.path?.join(".") || "_form", i.message]));
    return { _form: error instanceof Error ? error.message : "Check the entered job details." };
  }
}
