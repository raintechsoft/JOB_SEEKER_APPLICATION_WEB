import { z } from "zod";
import rules from "../../../../../contracts/validation/job-v2.json";
import { jobV2DraftSchema, jobV2PublishSchema, moneyMinor, moneyString } from "@/lib/validation/job-v2";

const record = (v: unknown) => z.record(z.string(), z.unknown()).parse(v);
const blank = (v: unknown) => v === "" || v === null ? null : v;
const integer = (v: unknown) => {
  v = blank(typeof v === "string" ? v.trim() : v);
  if (typeof v === "string" && /^(?:0|[1-9]\d*)$/.test(v)) return Number(v);
  return v;
};
const amount = (v: unknown) => { v = blank(typeof v === "string" ? v.trim() : v); if(typeof v === "string") {try{return moneyString(moneyMinor(v));}catch{return v;}}return v; };

/** Form normalization only; this function makes no request and infers no missing business data. */
export function jobV2FormToApi(input: unknown, mode: "draft" | "publish" = "draft") {
  const v = record(structuredClone(input));
  for (const key of ["experienceMin", "experienceMax", "vacancies"]) v[key] = integer(v[key]);
  const c = record(v.compensation);
  for (const key of ["minAmount", "maxAmount", "variablePercent"]) c[key] = amount(c[key]);
  for (const key of ["kind", "currency", "period", "scaleLabel"]) c[key] = blank(c[key]);
  c.allowances = z.array(z.unknown()).parse(c.allowances).map(item => { const a = record(item); return {...a, amount: amount(a.amount), percent: amount(a.percent)}; });
  c.schedule = z.array(z.unknown()).parse(c.schedule).map(item => { const s = record(item); return {...s, amount: amount(s.amount), startMonth: integer(s.startMonth), endMonth: integer(s.endMonth), period: blank(s.period)}; });
  v.compensation = c;
  if (v.deadline !== null) { const d = record(v.deadline); for (const key of ["time", "offset"]) d[key] = blank(d[key]); v.deadline = d; }
  const aliases = rules.educationAliases as Record<string, string>;
  if (Array.isArray(v.education)) v.education = v.education.map(item => typeof item === "string" ? aliases[item] ?? item : item);
  return (mode === "publish" ? jobV2PublishSchema : jobV2DraftSchema).parse(v);
}
