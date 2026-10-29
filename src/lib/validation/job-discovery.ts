import { z } from "zod";
import rules from "../../../contracts/validation/search.json";

const amount = z.number().finite().min(0).max(1e12).refine(value => /^\d+(?:\.\d{1,2})?$/.test(String(value)), "Use a decimal amount with at most two decimal places.").optional();
export const compensationQueryShape = {
  salaryMin: amount,
  salaryMax: amount,
  currency: z.enum(rules.currencies).optional(),
  compensationPeriod: z.enum(rules.compensationPeriods).optional(),
};
export type CompensationQuery = { salaryMin?: number; salaryMax?: number; currency?: string; compensationPeriod?: string; sort?: string };
export function compensationQueryErrors(value: CompensationQuery): Record<string, string> {
  const errors: Record<string, string> = {};
  if (value.salaryMin !== undefined && value.salaryMax !== undefined && value.salaryMin > value.salaryMax) errors.salaryMax = "Maximum pay must be at least the minimum.";
  if ((value.salaryMin !== undefined || value.salaryMax !== undefined) && !value.currency) errors.currency = "Choose a currency for compensation filters.";
  if (["salary_asc", "salary_desc"].includes(value.sort ?? "")) {
    if (!value.currency) errors.currency = "Choose a currency before sorting by compensation.";
    if (!value.compensationPeriod) errors.compensationPeriod = "Choose a payment period before sorting by compensation.";
  }
  return errors;
}
export const compensationQuerySchema = z.object(compensationQueryShape).strict().superRefine((value, context) => {
  for (const [key, message] of Object.entries(compensationQueryErrors(value))) context.addIssue({ code: "custom", path: [key], message });
});
