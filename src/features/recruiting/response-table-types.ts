import { z } from "zod";
import type { ScreeningQuestion } from "@/types/domain";

/**
 * Fixed columns. Every value is read from the API response item (snapshot profile, the
 * applicant's own submission, or the shared attachments), never from derived or demo data.
 */
export const RESPONSE_TABLE_COLUMN_IDS = [
  "select",
  "name",
  "status",
  "jobApplied",
  "experience",
  "education",
  "designation",
  "location",
  "notice",
  "joining",
  "skills",
  "preferredLocations",
  "phone",
  "email",
  "introduction",
  "screening",
  "resume",
  "applied",
  "actions",
] as const;

export type ResponseTableColumnId = (typeof RESPONSE_TABLE_COLUMN_IDS)[number];

/** One column per screening question of the filtered job: `q:<questionId>`. */
export type ResponseTableQuestionColumnId = `q:${string}`;
export type ResponseTableAnyColumnId = ResponseTableColumnId | ResponseTableQuestionColumnId;

const QUESTION_PREFIX = "q:";

export function isResponseTableQuestionColumnId(id: string): id is ResponseTableQuestionColumnId {
  return id.startsWith(QUESTION_PREFIX) && id.length > QUESTION_PREFIX.length;
}

export function responseTableQuestionColumnId(questionId: string): ResponseTableQuestionColumnId {
  return `${QUESTION_PREFIX}${questionId}`;
}

export function responseTableQuestionIdOf(columnId: string): string | null {
  return isResponseTableQuestionColumnId(columnId) ? columnId.slice(QUESTION_PREFIX.length) : null;
}

export function isResponseTableStaticColumnId(id: string): id is ResponseTableColumnId {
  return (RESPONSE_TABLE_COLUMN_IDS as readonly string[]).includes(id);
}

/** Fixed or question column id. Unknown ids (stale prefs) are rejected. */
export function isResponseTableColumnId(id: string): id is ResponseTableAnyColumnId {
  return isResponseTableStaticColumnId(id) || isResponseTableQuestionColumnId(id);
}

export const RESPONSE_TABLE_MANDATORY = ["select", "name", "actions"] as const satisfies readonly ResponseTableColumnId[];

export const RESPONSE_TABLE_OPTIONAL = [
  "status",
  "jobApplied",
  "experience",
  "education",
  "designation",
  "location",
  "notice",
  "joining",
  "skills",
  "preferredLocations",
  "phone",
  "email",
  "introduction",
  "screening",
  "resume",
  "applied",
] as const satisfies readonly ResponseTableColumnId[];

export const RESPONSE_TABLE_LABELS: Record<ResponseTableColumnId, string> = {
  select: "Select",
  name: "Name",
  status: "Status",
  jobApplied: "Job applied",
  experience: "Experience",
  education: "Education",
  designation: "Designation",
  location: "Location",
  notice: "Notice",
  joining: "Can join in",
  skills: "Skills",
  preferredLocations: "Preferred locations",
  phone: "Phone",
  email: "Email",
  introduction: "Introduction",
  screening: "Screening answers",
  resume: "Resume",
  applied: "Applied",
  actions: "Actions",
};

export const RESPONSE_TABLE_DEFAULT_WIDTHS: Record<ResponseTableColumnId, number> = {
  select: 44,
  name: 180,
  status: 148,
  jobApplied: 160,
  experience: 100,
  education: 180,
  designation: 140,
  location: 160,
  notice: 110,
  joining: 110,
  skills: 200,
  preferredLocations: 170,
  phone: 140,
  email: 200,
  introduction: 240,
  screening: 260,
  /** Icon-only resume control. */
  resume: 56,
  applied: 110,
  /** Icon-only action buttons (4×32 + gaps + cell padding). */
  actions: 156,
};

export const RESPONSE_TABLE_MIN_WIDTHS: Record<ResponseTableColumnId, number> = {
  select: 40,
  name: 120,
  status: 148,
  jobApplied: 100,
  experience: 80,
  education: 100,
  designation: 100,
  location: 100,
  notice: 80,
  joining: 80,
  skills: 120,
  preferredLocations: 110,
  phone: 110,
  email: 120,
  introduction: 140,
  screening: 160,
  resume: 48,
  applied: 90,
  actions: 156,
};

export const RESPONSE_TABLE_MAX_WIDTHS: Record<ResponseTableColumnId, number> = {
  select: 56,
  name: 960,
  status: 148,
  jobApplied: 280,
  experience: 140,
  education: 360,
  designation: 240,
  location: 280,
  notice: 160,
  joining: 160,
  skills: 400,
  preferredLocations: 320,
  phone: 200,
  email: 320,
  introduction: 480,
  screening: 520,
  resume: 64,
  applied: 160,
  actions: 156,
};

/** Question columns share one size band; the header wraps when the question is long. */
export const RESPONSE_TABLE_QUESTION_WIDTHS = { default: 200, min: 120, max: 420 } as const;

export function responseTableDefaultWidth(id: string): number {
  return isResponseTableStaticColumnId(id) ? RESPONSE_TABLE_DEFAULT_WIDTHS[id] : RESPONSE_TABLE_QUESTION_WIDTHS.default;
}

export function responseTableMinWidth(id: string): number {
  return isResponseTableStaticColumnId(id) ? RESPONSE_TABLE_MIN_WIDTHS[id] : RESPONSE_TABLE_QUESTION_WIDTHS.min;
}

export function responseTableMaxWidth(id: string): number {
  return isResponseTableStaticColumnId(id) ? RESPONSE_TABLE_MAX_WIDTHS[id] : RESPONSE_TABLE_QUESTION_WIDTHS.max;
}

export function clampResponseTableWidth(id: string, width: number): number {
  return Math.min(responseTableMaxWidth(id), Math.max(responseTableMinWidth(id), Math.round(width)));
}

/** Header text: fixed label, or the screening question text for `q:` columns. */
export function responseTableColumnLabel(id: string, questions: readonly ScreeningQuestion[] = []): string {
  if (isResponseTableStaticColumnId(id)) return RESPONSE_TABLE_LABELS[id];
  const questionId = responseTableQuestionIdOf(id);
  const question = questionId ? questions.find((q) => q.id === questionId) : undefined;
  return question?.text || "Screening question";
}

export type ResponseTableDensity = "comfortable" | "compact" | "spacious";

export const responseTablePrefsSchema = z.object({
  table: z.literal("job_application_responses"),
  version: z.literal(1),
  columnOrder: z.array(z.string()),
  columnVisibility: z.record(z.string(), z.boolean()),
  columnWidths: z.record(z.string(), z.number().positive()),
  pinnedLeft: z.array(z.string()),
  pinnedRight: z.array(z.string()),
  density: z.enum(["comfortable", "compact", "spacious"]),
});

export type ResponseTablePrefs = z.infer<typeof responseTablePrefsSchema>;

export function defaultResponseTablePrefs(): ResponseTablePrefs {
  return {
    table: "job_application_responses",
    version: 1,
    columnOrder: [...RESPONSE_TABLE_COLUMN_IDS],
    columnVisibility: Object.fromEntries(RESPONSE_TABLE_COLUMN_IDS.map((id) => [id, true])),
    columnWidths: { ...RESPONSE_TABLE_DEFAULT_WIDTHS },
    pinnedLeft: ["select", "name"],
    pinnedRight: ["actions"],
    density: "compact",
  };
}

/** Columns that support double-click cell / column content expansion (wrap in place). */
export const RESPONSE_TABLE_CONTENT_EXPANDABLE: Record<ResponseTableColumnId, boolean> = {
  select: false,
  status: false,
  actions: false,
  /** Icon-only resume control; nothing to wrap. */
  resume: false,
  name: true,
  jobApplied: true,
  experience: true,
  education: true,
  designation: true,
  location: true,
  notice: true,
  joining: true,
  skills: true,
  preferredLocations: true,
  phone: true,
  email: true,
  introduction: true,
  screening: true,
  applied: true,
};

export function isResponseTableContentExpandable(id: string): id is ResponseTableAnyColumnId {
  if (isResponseTableStaticColumnId(id)) return RESPONSE_TABLE_CONTENT_EXPANDABLE[id];
  return isResponseTableQuestionColumnId(id);
}

/** Backend-backed header sorts only. */
export const RESPONSE_TABLE_SORTABLE: Partial<Record<ResponseTableColumnId, { asc: string; desc: string }>> = {
  applied: { asc: "oldest", desc: "newest" },
  experience: { asc: "experience", desc: "experience" },
};

/** Column filter → URL param keys for advanced filters. */
export const RESPONSE_TABLE_FILTER_PARAMS: Partial<Record<ResponseTableColumnId, string[]>> = {
  education: ["education"],
  designation: ["designation"],
  location: ["location", "locality"],
  notice: ["notice"],
  joining: ["joining"],
  experience: ["expMin", "expMax"],
  skills: ["keywords", "keywordMode"],
  jobApplied: ["job"],
};
