import { z } from "zod";

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
  "expectedSalary",
  "skills",
  "applied",
  "actions",
] as const;

export type ResponseTableColumnId = (typeof RESPONSE_TABLE_COLUMN_IDS)[number];

export const RESPONSE_TABLE_MANDATORY = ["select", "name", "actions"] as const satisfies readonly ResponseTableColumnId[];

export const RESPONSE_TABLE_OPTIONAL = [
  "status",
  "jobApplied",
  "experience",
  "education",
  "designation",
  "location",
  "notice",
  "expectedSalary",
  "skills",
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
  expectedSalary: "Expected salary",
  skills: "Skills",
  applied: "Applied",
  actions: "Actions",
};

export const RESPONSE_TABLE_DEFAULT_WIDTHS: Record<ResponseTableColumnId, number> = {
  select: 44,
  name: 180,
  status: 120,
  jobApplied: 160,
  experience: 100,
  education: 180,
  designation: 140,
  location: 160,
  notice: 110,
  expectedSalary: 130,
  skills: 200,
  applied: 110,
  actions: 320,
};

export const RESPONSE_TABLE_MIN_WIDTHS: Record<ResponseTableColumnId, number> = {
  select: 40,
  name: 120,
  status: 90,
  jobApplied: 100,
  experience: 80,
  education: 100,
  designation: 100,
  location: 100,
  notice: 80,
  expectedSalary: 90,
  skills: 120,
  applied: 90,
  actions: 220,
};

export const RESPONSE_TABLE_MAX_WIDTHS: Record<ResponseTableColumnId, number> = {
  select: 56,
  name: 320,
  status: 180,
  jobApplied: 280,
  experience: 140,
  education: 360,
  designation: 240,
  location: 280,
  notice: 160,
  expectedSalary: 200,
  skills: 400,
  applied: 160,
  actions: 480,
};

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

/** Backend-backed header sorts only. */
export const RESPONSE_TABLE_SORTABLE: Partial<Record<ResponseTableColumnId, { asc: string; desc: string }>> = {
  applied: { asc: "oldest", desc: "newest" },
  experience: { asc: "experience", desc: "experience" },
  expectedSalary: { asc: "salary", desc: "salary" },
};

/** Column filter → URL param keys for advanced filters. */
export const RESPONSE_TABLE_FILTER_PARAMS: Partial<Record<ResponseTableColumnId, string[]>> = {
  education: ["education"],
  designation: ["designation"],
  location: ["location", "locality"],
  notice: ["notice"],
  experience: ["expMin", "expMax"],
  expectedSalary: ["salaryMin", "salaryMax"],
  skills: ["keywords", "keywordMode"],
  jobApplied: ["job"],
};
