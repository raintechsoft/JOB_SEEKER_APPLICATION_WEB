import type { SearchResult } from "@/services/search/search.service";

export type OwnSearchPerson = {
  id?: string;
  headline?: string;
  location?: string;
  summary?: string;
  category?: string;
  currentTitle?: string;
};

export function searchMetaLine(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const part of parts) {
    const value = part?.replace(/[\s\p{Z}]+/gu, " ").trim() ?? "";
    if (!value) continue;
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(value);
  }
  return values.join(" · ");
}

export function personCompactLine(result: Pick<Partial<SearchResult>, "designation" | "bio" | "subtitle">) {
  return searchMetaLine([result.designation, result.bio]) || result.subtitle?.trim() || "";
}

export function companyMetaLine(result: Pick<Partial<SearchResult>, "industry" | "subtitle">) {
  return searchMetaLine(["Company", result.industry || result.subtitle]);
}

export function jobMetaLine(result: Pick<Partial<SearchResult>, "companyName" | "industry" | "subtitle">) {
  return searchMetaLine([result.companyName, result.industry]) || result.subtitle?.trim() || "";
}

export function canFollowSearchResult(result: SearchResult, ownPersonId?: string, ownCompanyId?: string) {
  if (result.kind === "person" || result.kind === "talent") return !!result.id && result.id !== ownPersonId;
  if (result.kind === "company") return !!result.id && result.companyAccess !== "workspace" && result.id !== ownCompanyId;
  return false;
}

export function matchesPersonName(result: SearchResult, query: string) {
  if (result.kind !== "person" && result.kind !== "talent") return false;
  const q = query.replace(/[\s\p{Z}]+/gu, " ").trim().toLocaleLowerCase();
  if (!q) return false;
  const name = result.title.replace(/[\s\p{Z}]+/gu, " ").trim().toLocaleLowerCase();
  return name === q || name.startsWith(q) || name.split(" ").some(part => part.startsWith(q));
}

export function enrichOwnSearchResult(result: SearchResult, own?: OwnSearchPerson | null): SearchResult {
  if (!own?.id || result.id !== own.id || (result.kind !== "person" && result.kind !== "talent")) return result;
  const designation = result.designation?.trim() || own.currentTitle?.trim() || own.headline?.trim() || own.category?.trim() || "";
  const bio = result.bio?.trim() || own.summary?.trim() || "";
  const location = result.location?.trim() || own.location?.trim() || "";
  return { ...result, designation, bio, location, subtitle: result.subtitle?.trim() || own.headline?.trim() || result.subtitle };
}

export function personDetailBio(result: Pick<Partial<SearchResult>, "bio" | "designation" | "subtitle">) {
  return result.bio?.trim() || personCompactLine(result);
}
