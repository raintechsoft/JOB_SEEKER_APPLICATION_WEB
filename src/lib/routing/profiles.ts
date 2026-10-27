import type { Role } from "@/types/domain";

/** In-app organization profile. Own recruiter workspace stays on `/recruiter/company`. */
export function organizationProfileHref(role: Role, slug?: string | null, ownWorkspace = false) {
  if (!slug) return undefined;
  if (ownWorkspace && role === "recruiter") return "/recruiter/company";
  return `${role === "recruiter" ? "/recruiter" : "/app"}/organizations/${encodeURIComponent(slug)}`;
}

/** In-app recruiter profile. Own recruiter workspace stays on `/recruiter/profile`. */
export function recruiterProfileHref(role: Role, id?: string | null, own = false) {
  if (!id) return undefined;
  if (own) return "/recruiter/profile";
  return `${role === "recruiter" ? "/recruiter" : "/app"}/recruiters/${encodeURIComponent(id)}`;
}
