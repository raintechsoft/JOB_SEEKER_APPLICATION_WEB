import type { Role } from "@/types/domain";
import type { SearchScope, SearchOptions } from "@/lib/search/scopes";

export interface SearchResult { id: string; kind: "person" | "company" | "post" | "job" | "update" | "talent" | "project"; title: string; subtitle: string; slug: string | null; picture: string; recruiter: boolean; ownerId?: string | null; companyAccess?: "public" | "workspace" | null }
export interface SearchPage { items: SearchResult[]; total: number | null; nextCursor: string | null }
export interface SearchService { query(input: SearchOptions & { role: Role; q: string; scope: SearchScope; mode?: "results" | "suggestions"; limit?: number; cursor?: string }, options?: { signal?: AbortSignal }): Promise<SearchPage> }
export function searchResultHref(role: Role, result: SearchResult) {
  if (result.kind === "company") return result.companyAccess === "workspace" && role === "recruiter" ? "/recruiter/company" : `/organizations/${encodeURIComponent(result.slug ?? "")}`;
  if (result.kind === "person" || result.kind === "talent") return result.recruiter ? `/recruiters/${result.id}` : role === "recruiter" ? `/recruiter/talent/${result.id}` : `/professionals/${encodeURIComponent(result.slug ?? "")}`;
  if (result.kind === "job") return `/jobs/${result.id}`;
  if (result.kind === "project") return `/recruiter/talent/${result.ownerId}?project=${encodeURIComponent(result.id)}`;
  return `${role === "recruiter" ? "/recruiter" : "/app"}/dashboard?post=${result.id}`;
}
export const searchResultLabel = (result: SearchResult) => `View ${result.title} ${result.kind === "person" || result.kind === "talent" ? "profile" : result.kind === "update" ? "work update" : result.kind}`;
export const resultKindLabels = { person: "Person", company: "Company", post: "Post", job: "Job", update: "Work update", talent: "Talent", project: "Project" };
