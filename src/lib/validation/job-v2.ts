import { z } from "zod";
import rules from "../../../contracts/validation/job-v2.json";
import legacyRules from "../../../contracts/validation/job.json";
import { jobDraftValuesSchema } from "./job";

/** Versioned job rules used by the J3 editor; legacy validation remains independently supported. */
export const JOB_V2_RULES = rules;
const MAX_MINOR = BigInt(rules.moneyMax.replace(".", ""));
export function moneyMinor(value: string): bigint {
  if (!new RegExp(rules.moneyPattern).test(value)) throw new Error("Enter a decimal amount with up to two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > MAX_MINOR) throw new Error("Amount exceeds the supported limit.");
  return cents;
}
export const moneyString = (minor: bigint) => {
  if (minor < 0n || minor > MAX_MINOR) throw new Error("Amount exceeds the supported bounds.");
  return `${minor / 100n}.${String(minor % 100n).padStart(2, "0")}`;
};
const text = (max: number) => z.string().trim().refine(v => [...v].length <= max, `Use at most ${max} characters.`);
const money = z.string().refine(v => { try { moneyMinor(v); return true; } catch { return false; } }, "Enter a valid decimal amount.");
const percent = money.refine(v => { try { return moneyMinor(v) <= 10000n; } catch { return false; } }, "Use a percentage from 0 to 100.");
const period = z.enum(rules.compensationPeriods as [string, ...string[]]);
const schedule = z.strictObject({ label: text(rules.scheduleLabelMax), startMonth: z.number().int().min(1).max(rules.scheduleMonthMax), endMonth: z.number().int().min(1).max(rules.scheduleMonthMax).nullable(), amount: money.nullable(), period: period.nullable() });
const allowance = z.strictObject({ label: text(rules.allowanceLabelMax), amount: money.nullable(), percent: percent.nullable() });
export const compensationV2Schema = z.strictObject({
  kind: z.enum(rules.compensationKinds as [string, ...string[]]).nullable(),
  format: z.enum(rules.compensationFormats as [string, ...string[]]),
  currency: z.enum(rules.currencies as [string, ...string[]]).nullable(), period: period.nullable(),
  minAmount: money.nullable(), maxAmount: money.nullable(), hidden: z.boolean(),
  variableEnabled: z.boolean(), variablePercent: percent.nullable(), scaleLabel: text(rules.scaleLabelMax).nullable(), notes: text(rules.compensationNoteMax),
  allowances: z.array(allowance).max(rules.allowancesMax), schedule: z.array(schedule).max(rules.scheduleMax),
});
export type CompensationV2 = z.infer<typeof compensationV2Schema>;
export type PublicCompensationV2 = { disclosure: "undisclosed" | "unspecified" } | (CompensationV2 & { disclosure: "specified" });

export function compensationErrors(c: CompensationV2, publish: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  const need = (key: keyof CompensationV2) => { if (c[key] === null || c[key] === "" || (Array.isArray(c[key]) && !c[key].length)) e[key] = "This field is required."; };
  if (c.minAmount !== null && c.maxAmount !== null && moneyMinor(c.minAmount) > moneyMinor(c.maxAmount)) e.maxAmount = "Maximum must be at least the minimum.";
  const numeric = ["fixed", "range", "up_to"].includes(c.format);
  if (publish && c.format !== "unspecified") { need("kind"); need("currency"); }
  if (publish && c.variableEnabled) need("variablePercent");
  if (publish && numeric) { need("period"); if (c.format !== "up_to") need("minAmount"); if (c.format !== "fixed") need("maxAmount"); }
  if (c.format === "fixed" && c.maxAmount !== null) e.maxAmount = "Fixed pay uses minAmount only.";
  if (c.format === "up_to" && c.minAmount !== null) e.minAmount = "Up-to pay uses maxAmount only.";
  if (!numeric && (c.minAmount !== null || c.maxAmount !== null || c.period !== null)) e.format = "This format does not use a numeric range or root payment period.";
  if (c.format !== "pay_scale" && c.scaleLabel !== null) e.scaleLabel = "A scale label requires pay-scale format.";
  if (c.format !== "schedule" && c.schedule.length) e.schedule = "Stages require schedule format.";
  if (publish && c.format === "pay_scale") need("scaleLabel");
  if (publish && c.format === "schedule") need("schedule");
  if (c.format === "unspecified" && (c.allowances.length || c.variableEnabled)) e.format = "Unspecified compensation cannot contain active pay components.";
  for (const [i, a] of c.allowances.entries()) {
    if (!a.label || (a.amount === null) === (a.percent === null)) e[`allowances.${i}`] = "Provide a label and exactly one amount or percentage.";
  }
  for (const [i, s] of c.schedule.entries()) {
    if (s.endMonth !== null && s.endMonth < s.startMonth) e[`schedule.${i}.endMonth`] = "End month precedes start month.";
    const prev = c.schedule[i - 1];
    if (prev && (prev.endMonth === null || s.startMonth <= prev.endMonth)) e[`schedule.${i}.startMonth`] = "Stages must be ordered and must not overlap.";
    if (publish && (!s.label || s.amount === null || s.period === null)) e[`schedule.${i}`] = "Complete each pay stage.";
  }
  return e;
}

const TIMEZONES = new Set<string>(rules.timezones);
export const deadlineV2Schema =z.strictObject({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(), timezone: text(rules.timezoneMax).min(1), offset: z.string().regex(new RegExp(rules.deadlineOffsetPattern)).nullable() }).nullable();
export type DeadlineV2 = z.infer<typeof deadlineV2Schema>;
/** Returns all actual instants for a wall time; gaps/ambiguities never silently normalize. */
export function deadlineInstants(d: NonNullable<DeadlineV2>): number[] {
  const parsed = Date.parse(`${d.date}T${d.time ?? "00:00"}:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== d.date) throw new Error("Enter a real calendar date.");
  // Same allowlist as Laravel and PostgreSQL; Intl alone also accepts legacy aliases such as Asia/Calcutta.
  if (!TIMEZONES.has(d.timezone)) throw new Error("Choose an IANA timezone.");
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: d.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "longOffset" });
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const name = f.formatToParts(parsed + hours * 3600000).find(p => p.type === "timeZoneName")!.value;
    const m = name.match(/^GMT(?:([+-])(\d{2}):(\d{2}))?$/);
    if (!m) throw new Error("Unsupported timezone offset.");
    offsets.add(m[1] ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0);
  }
  return [...offsets].flatMap(offset => {
    const instant = parsed - offset * 60000;
    const parts = Object.fromEntries(f.formatToParts(instant).map(p => [p.type, p.value]));
    const matches = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` === `${d.date}T${d.time ?? "00:00"}`;
    const wanted = d.offset === null ? null : (d.offset[0] === "-" ? -1 : 1) * (Number(d.offset.slice(1, 3)) * 60 + Number(d.offset.slice(4)));
    return matches && (wanted === null || wanted === offset) ? [instant] : [];
  }).sort((a, b) => a - b);
}
export function deadlineError(d: DeadlineV2): string | null {
  if (d === null) return null;
  if (d.time === null && d.offset !== null) return "An offset requires an exact closing time.";
  // A date-only deadline closes at the start of the next local day; only exact times must resolve once.
  try { const instants = deadlineInstants(d); if (d.time !== null && instants.length !== 1) return "Resolve the nonexistent or ambiguous closing time and timezone offset."; } catch { return "Enter a valid date and IANA timezone."; }
  return null;
}

/** Optional recruitment-notice details. Display text only; never an automatic eligibility rule. */
export const EMPTY_NOTICE = { ageLimit: "", selectionProcess: "", documents: "", applicationFee: "", noticeUrl: "", opensOn: null } as const;
const httpUrl = (v: string) => { if (!v) return true; try { const u = new URL(v); return (u.protocol === "https:" || u.protocol === "http:") && !!u.hostname; } catch { return false; } };
export const noticeV2Schema = z.strictObject({
  ageLimit: text(rules.notice.ageLimit), selectionProcess: text(rules.notice.selectionProcess), documents: text(rules.notice.documents), applicationFee: text(rules.notice.applicationFee),
  noticeUrl: text(rules.notice.noticeUrl).refine(httpUrl, "Enter a complete http(s) link."),
  opensOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.").refine(v => { const t = Date.parse(`${v}T00:00:00Z`); return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v; }, "Enter a real calendar date.").nullable(),
});
export type NoticeV2 = z.infer<typeof noticeV2Schema>;

const { shape } = jobDraftValuesSchema;
const replaced = ["experienceMin", "experienceMax", "vacancies", "employment", "education", "currency", "salaryMin", "salaryMax", "hideSalary", "variableEnabled", "variablePercent", "expiresAt"] as const;
const unchanged = Object.fromEntries(Object.entries(shape).filter(([key]) => !(replaced as readonly string[]).includes(key))) as Omit<typeof shape, (typeof replaced)[number]>;
export const jobV2ShapeSchema = z.strictObject({ ...unchanged,
  schemaVersion: z.literal(2), compensation: compensationV2Schema, deadline: deadlineV2Schema,
  // Drafts saved before these fields existed omit them.
  notice: noticeV2Schema.default({ ...EMPTY_NOTICE }),
  experienceMin: z.number().int().min(0).max(rules.experienceMax).nullable(), experienceMax: z.number().int().min(0).max(rules.experienceMax).nullable(),
  vacancies: z.number().int().min(1).max(rules.vacanciesMax).nullable(), employment: z.union([z.literal(""), z.enum(rules.employment as [string, ...string[]])]),
  education: z.array(z.enum(rules.education as [string, ...string[]])).max(legacyRules.lists.education),
});
export type JobValuesV2 = z.infer<typeof jobV2ShapeSchema>;
export function jobV2Errors(value: unknown, mode: "draft" | "publish" | number = "draft"): Record<string, string> {
  const result = jobV2ShapeSchema.safeParse(value), errors: Record<string, string> = {};
  if (!result.success) { for (const issue of result.error.issues) errors[issue.path.join(".")] ??= issue.message; return errors; }
  const v = result.data;
  const stage = typeof mode === "number" ? mode : mode === "publish" ? 6 : -1;
  if (!Number.isInteger(stage) || stage < -1 || stage > 6) return { _form: "Choose a valid wizard stage." };
  Object.assign(errors, Object.fromEntries(Object.entries(compensationErrors(v.compensation, stage >= 0)).map(([k, m]) => [`compensation.${k}`, m])));
  if (v.experienceMin !== null && v.experienceMax !== null && v.experienceMin > v.experienceMax) errors.experienceMax = "Maximum must be at least the minimum.";
  const dateError = deadlineError(v.deadline); if (dateError) errors.deadline = dateError;
  if (v.notice.opensOn && v.deadline && v.notice.opensOn > v.deadline.date) errors["notice.opensOn"] = "The opening date must be on or before the closing date.";
  const values = v as Record<string, unknown>;
  for (let s = 0; s <= stage; s++) for (const key of rules.requiredStages[s]) {
    const val = values[key]; if (val === null || val === "" || val === undefined || (Array.isArray(val) && !val.length)) errors[key] = "This field is required.";
  }
  const skills = v.skills as string[], essential = v.essentialSkills as string[];
  if (essential.some(s => !skills.includes(s))) errors.essentialSkills = "Essential skills must be listed as job skills.";
  if (new Set(v.education).size !== v.education.length) errors.education = "Use distinct qualifications.";
  if (stage >= 3 && (v.questions as { text: string }[]).some(q => !q.text.trim())) errors.questions = "Complete or remove empty questions.";
  const thumbnail = v.thumbnail as {image: string; alt: string};
  if (stage >= 5 && thumbnail.image && !thumbnail.alt) errors.thumbnail = "Describe the thumbnail.";
  return errors;
}
export const jobV2DraftSchema = jobV2ShapeSchema.superRefine((v, ctx) => { for (const [key, message] of Object.entries(jobV2Errors(v))) ctx.addIssue({code: "custom", path: key.split("."), message}); });
export const jobV2PublishSchema = jobV2ShapeSchema.superRefine((v, ctx) => { for (const [key, message] of Object.entries(jobV2Errors(v, "publish"))) ctx.addIssue({code: "custom", path: key.split("."), message}); });
const requestShape = {values: jobV2DraftSchema, step: z.number().int().min(0).max(6), reached: z.number().int().min(0).max(6), version: z.number().int().min(1), jobVersion: z.number().int().min(1), generated: z.strictObject({mode: z.literal("template-demo"), role: text(100).min(1), at: z.iso.datetime()}).nullable().optional()};
export const jobV2StageAdvanceSchema = z.strictObject(requestShape).superRefine((v, ctx) => {
  if (v.step > v.reached) ctx.addIssue({code: "custom", path: ["reached"], message: "The reached step must include the current step."});
  if (v.reached > 0) for (const [key, message] of Object.entries(jobV2Errors(v.values, v.reached - 1))) ctx.addIssue({code: "custom", path: ["values", ...key.split(".")], message});
});
export const jobV2PublishRequestSchema = z.strictObject({...requestShape, values: jobV2PublishSchema}).superRefine((v,ctx)=>{
  if (v.step > v.reached) ctx.addIssue({code:"custom",path:["reached"],message:"Invalid wizard progress."});
  if (v.generated && !v.values.aiVerified) ctx.addIssue({code:"custom",path:["values","aiVerified"],message:"Review the generated content before publishing."});
});

/** Public redaction is allowlisted and creates a copy; no caller can accidentally spread private amounts. */
export function publicCompensationV2(input: unknown): PublicCompensationV2 {
  const c = compensationV2Schema.parse(input);
  if (c.hidden) return { disclosure: "undisclosed" as const };
  if (c.format === "unspecified") return { disclosure: "unspecified" as const };
  return { disclosure: "specified" as const, ...c };
}
