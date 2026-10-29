import type { CompensationV2, PublicCompensationV2 } from "@/lib/validation/job-v2";
export const PAYMENT_PERIODS: Record<string,string> = { hour: "hour", day: "day", week: "week", month: "month", year: "year", case: "case", duty: "duty", engagement: "engagement" };
export function formatCompensation(c: CompensationV2 | PublicCompensationV2): string {
  if ("disclosure" in c && c.disclosure !== "specified") return c.disclosure === "undisclosed" ? "Compensation not disclosed" : "Compensation not specified";
  if (c.hidden) return "Compensation not disclosed";
  if (c.format === "unspecified") return "Compensation not specified";
  const amount = (v: string | null) => `${c.currency ?? ""} ${v ?? "—"}`.trim();
  const period = c.period ? ` per ${PAYMENT_PERIODS[c.period]}` : "";
  const label = c.kind === "stipend" ? "Stipend: " : c.kind === "honorarium" ? "Honorarium: " : "";
  const base = c.format === "fixed" ? amount(c.minAmount) + period : c.format === "range" ? `${amount(c.minAmount)}–${c.maxAmount ?? "—"}${period}` : c.format === "up_to" ? `Up to ${amount(c.maxAmount)}${period}` : c.format === "pay_scale" ? c.scaleLabel || "Pay scale" : c.schedule.map(s => `${s.label}: ${amount(s.amount)}${s.period ? ` per ${PAYMENT_PERIODS[s.period]}` : ""} (months ${s.startMonth}–${s.endMonth ?? "onwards"})`).join("; ");
  return label + base + (c.variableEnabled && c.variablePercent ? ` + ${c.variablePercent}% variable` : "") + (c.allowances.length ? " + allowances" : "");
}
