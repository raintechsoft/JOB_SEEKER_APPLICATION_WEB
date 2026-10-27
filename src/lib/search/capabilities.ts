import { filterKeysFor, type SearchFilters, type SearchOptions, type SearchScope } from "./scopes";

export type FilterControl = Exclude<keyof SearchFilters, "experienceMin" | "experienceMax"> | "experience";
export const controlKeys = (control: FilterControl): (keyof SearchFilters)[] => control === "experience" ? ["experienceMin", "experienceMax"] : [control];
export const filterLayouts: Record<SearchScope, { quick: FilterControl[]; more: FilterControl[] }> = {
  all: { quick: [], more: [] },
  companies: { quick: ["location", "industry", "companyType"], more: [] },
  people: { quick: ["location"], more: [] },
  jobs: { quick: ["location", "arrangement", "employment"], more: ["skill", "experience", "days"] },
  posts: { quick: ["days", "contentType"], more: [] },
  updates: { quick: ["days"], more: ["author"] },
  talent: { quick: ["location", "skill"], more: ["experience"] },
  skills: { quick: ["location"], more: ["experience"] },
  projects: { quick: ["skill", "discipline"], more: ["days"] },
};

export const controlLabel = (control: FilterControl, scope: SearchScope) => ({ location: "Location", industry: "Industry", skill: scope === "projects" ? "Technology" : "Skill", arrangement: "Workplace", employment: "Employment type", days: scope === "projects" ? "Updated within days" : scope === "posts" ? "Date posted" : "Posted within days", author: "Author", discipline: "Discipline", experience: "Experience (years)", contentType: "Content type", companyType: "Company type" })[control];

/** Preserve only dimensions whose source meaning stays the same, not merely matching key names. */
export function compatibleSearchOptions(from: SearchScope, to: SearchScope, options: SearchOptions): SearchOptions {
  return Object.fromEntries(Object.entries(options).filter(([key]) => {
    if (key === "sort") return true;
    if (key === "selected") return from === to;
    if (!filterKeysFor(to).includes(key as keyof SearchFilters)) return false;
    if (from === to) return true;
    if (key === "author") return false;
    if (key === "days" && (from === "projects" || to === "projects")) return false;
    if ((key === "experienceMin" || key === "experienceMax") && (from === "jobs" || to === "jobs")) return false;
    return true;
  })) as SearchOptions;
}
