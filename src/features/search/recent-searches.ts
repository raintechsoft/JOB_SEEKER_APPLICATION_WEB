import { feedSearchSchema } from "@/lib/validation/social";

const storageKey = (scope: string) => `skillora:recent-searches:v1:${scope}`;

/** Query text stays in this browser tab, isolated by the selected workspace. */
export function readRecentSearches(scope?: string): string[] {
  if (!scope || typeof window === "undefined") return [];
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey(scope)) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.slice(0, 5).flatMap(value => {
      const result = feedSearchSchema.safeParse(value);
      return result.success && result.data ? [result.data] : [];
    });
  } catch { return []; }
}

/** Removes one recent search (case-insensitive) or, without a query, all of them. */
export function forgetRecentSearch(scope: string | undefined, query?: string): string[] {
  const next = query === undefined ? [] : readRecentSearches(scope).filter(item => item.toLocaleLowerCase() !== query.toLocaleLowerCase());
  if (scope) {
    try { sessionStorage.setItem(storageKey(scope), JSON.stringify(next)); } catch { /* Search still works when browser storage is unavailable. */ }
  }
  return next;
}

export function rememberSearch(scope: string | undefined, query: string, previous: string[]): string[] {
  const value = feedSearchSchema.safeParse(query);
  if (!value.success || !value.data) return previous;
  const next = [value.data, ...previous.filter(item => item.toLocaleLowerCase() !== value.data.toLocaleLowerCase())].slice(0, 5);
  if (scope) {
    try { sessionStorage.setItem(storageKey(scope), JSON.stringify(next)); } catch { /* Search still works when browser storage is unavailable. */ }
  }
  return next;
}
