import type { HttpClient } from "../api/client";
import type { AuthService } from "../auth/auth.service";
import type { SearchService, SearchSuggestionsData } from "./search.service";
import type { components } from "@/types/generated/api";
import { scopedSearchSchema } from "@/lib/search/scopes";
import { z } from "zod";

export function createHttpSearchService(http: HttpClient, auth: AuthService): SearchService {
  async function workspace(role: string) {
    const session = await auth.me();
    const identity = session.workspaces.find(w => w.id === session.selected_identity_id);
    if (!identity || identity.kind !== role) throw new Error("Select the matching workspace before searching.");
    return identity.id;
  }
  return {
    async query(input, options) {
      const values = scopedSearchSchema.parse(input);
      const identity = await workspace(values.role);
      const { role: _role, ...query } = values;
      void _role;
      return (await http.get<{ data: components["schemas"]["WorkspaceSearchPage"] }>(`me/social/${identity}/search`, query, options)).data;
    },
    async forgetSearch(role, entryId) {
      const identity = await workspace(role);
      await http.delete(`me/search-history/${identity}/${z.uuid().parse(entryId)}`);
    },
    async clearSearches(role) {
      await http.delete(`me/search-history/${await workspace(role)}`);
    },
    async resultOpened(role, query, result) {
      const id = z.uuid().safeParse(result.id);
      if (!id.success || !query.trim()) return;
      try {
        await http.post(`me/search-history/${await workspace(role)}/opened`, { query: query.trim().slice(0, 200), kind: result.kind, id: id.data });
      } catch {
        // Only improves future recommendations; opening the result already happened.
      }
    },
    async suggestions(role, options) {
      const identity = await workspace(role);
      return (await http.get<{ data: SearchSuggestionsData }>(`me/social/${identity}/search-suggestions`, undefined, options)).data;
    },
  };
}
