import type { SearchResult } from "@/services/search/search.service";
import { normalizeSearch, searchQuerySchema, type SearchOptions } from "./scopes";

/** Industry used to suggest other public companies after a company search. */
export function similarCompanyCategory(items: SearchResult[], options: SearchOptions = {}) {
  const filtered = options.industry?.replace(/[\s\p{Z}]+/gu, " ").trim() ?? "";
  if (filtered) return filtered;
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== "company") continue;
    const value = (item.industry || item.subtitle || "").replace(/[\s\p{Z}]+/gu, " ").trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best = "";
  let n = 0;
  for (const [value, count] of counts) {
    if (count > n) {
      best = value;
      n = count;
    }
  }
  return best || undefined;
}

/** Role token used to suggest other people after a people search. */
export function similarPersonCategory(items: SearchResult[], _options: SearchOptions = {}) {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== "person" && item.kind !== "talent") continue;
    const token = similarPersonRole(item.designation || item.subtitle);
    if (!token) continue;
    const key = token.toLocaleLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = "";
  let n = 0;
  for (const item of items) {
    if (item.kind !== "person" && item.kind !== "talent") continue;
    const token = similarPersonRole(item.designation || item.subtitle);
    if (!token) continue;
    const count = counts.get(token.toLocaleLowerCase()) ?? 0;
    if (count > n) {
      best = token;
      n = count;
    }
  }
  return best || undefined;
}

function similarPersonRole(value: string | undefined) {
  const text = value?.replace(/[\s\p{Z}]+/gu, " ").trim() ?? "";
  if (!text) return undefined;
  const last = text.split(" ").filter(Boolean).at(-1) ?? "";
  return Array.from(last).length >= 2 ? last : undefined;
}

/** Search term for similar companies or people, omitted when it would duplicate the current query. */
export function similarCompanyQuery(category: string | undefined, originalQuery: string) {
  if (!category) return undefined;
  if (normalizeSearch(originalQuery).toLocaleLowerCase() === normalizeSearch(category).toLocaleLowerCase()) return undefined;
  return searchQuerySchema.safeParse(category).success ? category : undefined;
}
