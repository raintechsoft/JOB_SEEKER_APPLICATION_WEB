import { z } from "zod";
import type { Role } from "@/types/domain";
import contract from "../../../../../contracts/validation/global-search.json";

export const SEARCH_SCOPES = ["all", "posts", "companies", "people", "jobs", "updates", "talent", "skills", "projects"] as const;
export type SearchScope = typeof SEARCH_SCOPES[number];
export const searchLabels: Record<SearchScope, string> = { all: "All", posts: "Posts", companies: "Companies", people: "People", jobs: "Jobs", updates: "Work updates", talent: "Talent", skills: "Skills", projects: "Projects" };
export const scopesFor = (role: Role): SearchScope[] => role === "recruiter" ? ["all", "talent", "skills", "projects", "posts", "companies", "people", "jobs", "updates"] : ["all", "posts", "companies", "people", "jobs", "updates"];
export const normalizeSearch = (q: string) => q.replace(/[\s\p{Z}]+/gu, " ").trim();
export const searchSettings = contract;
export const searchQuerySchema = z.string().transform(normalizeSearch).refine(q => Array.from(q).length >= contract.minimum, `Enter at least ${contract.minimum} characters.`).refine(q => Array.from(q).length <= contract.maximum, `Use at most ${contract.maximum} characters.`);
const numeric = (max: number) => z.number().finite().min(0).max(max).optional();
export const searchFiltersSchema = z.object({ location: z.string().trim().min(1).max(100).optional(), industry: z.string().trim().min(1).max(100).optional(), skill: z.string().trim().min(1).max(100).optional(), arrangement: z.enum(["On-site", "Hybrid", "Remote"]).optional(), employment: z.enum(["Full-time", "Part-time", "Contract", "Internship"]).optional(), discipline: z.enum(["Design", "Engineering", "Data", "Business"]).optional(), experienceMin: numeric(60), experienceMax: numeric(60), days: z.number().int().min(1).max(365).optional(), author: z.uuid().optional() });
export type SearchFilters = z.infer<typeof searchFiltersSchema>;
export type SearchOptions = SearchFilters & { sort?: "relevance" | "recent" };
export const filterLabels: Record<keyof SearchFilters, string> = { location: "Location", industry: "Industry", skill: "Skill", arrangement: "Workplace", employment: "Employment", discipline: "Discipline", experienceMin: "Minimum experience", experienceMax: "Maximum experience", days: "Posted within days", author: "Author" };
export const filterKeysFor = (scope: SearchScope) => contract.filters[scope] as (keyof SearchFilters)[];
export const scopedSearchSchema = searchFiltersSchema.extend({ role: z.enum(["professional", "recruiter"]), q: searchQuerySchema, scope: z.enum(SEARCH_SCOPES), sort: z.enum(["relevance", "recent"]).optional(), mode: z.enum(["results", "suggestions"]).optional(), limit: z.number().int().min(1).max(40).default(20), cursor: z.string().min(1).max(4096).optional() }).strict().superRefine((value, context) => {
  if (contract.recruiterOnly.includes(value.scope) && value.role !== "recruiter") context.addIssue({ code: "custom", path: ["scope"], message: "This category requires an employer workspace." });
  for (const key of Object.keys(searchFiltersSchema.shape) as (keyof SearchFilters)[]) if (value[key] !== undefined && !filterKeysFor(value.scope).includes(key)) context.addIssue({ code: "custom", path: [key], message: "This filter is unavailable in this category." });
  if (value.experienceMin !== undefined && value.experienceMax !== undefined && value.experienceMin > value.experienceMax) context.addIssue({ code: "custom", path: ["experienceMax"], message: "Maximum experience must be at least the minimum." });
});
export function searchPageUrl(role: Role, query: string, scope: SearchScope, options: SearchOptions = {}) {
  const params = new URLSearchParams({ q: normalizeSearch(query), scope });
  for (const [key, value] of Object.entries(options)) if (value !== undefined && value !== "") params.set(key, String(value));
  return `${role === "recruiter" ? "/recruiter" : "/app"}/search?${params}`;
}
export function searchOptionsFromUrl(params: Pick<URLSearchParams, "get">): SearchOptions {
  const options: Record<string, unknown> = {};
  for (const key of ["sort", ...Object.keys(searchFiltersSchema.shape)]) { const value = params.get(key); if (value !== null) options[key] = ["experienceMin", "experienceMax", "days"].includes(key) ? value.trim() ? Number(value) : NaN : value; }
  return options as SearchOptions;
}
