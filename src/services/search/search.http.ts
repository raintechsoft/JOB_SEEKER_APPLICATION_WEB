import type { HttpClient } from "../api/client";
import type { AuthService } from "../auth/auth.service";
import type { SearchService } from "./search.service";
import type { components } from "@/types/generated/api";
import { scopedSearchSchema } from "@/lib/search/scopes";

export function createHttpSearchService(http: HttpClient, auth: AuthService): SearchService {
  return { async query(input, options) {
    const values = scopedSearchSchema.parse(input);
    const session = await auth.me();
    const identity = session.workspaces.find(w => w.id === session.selected_identity_id);
    if (!identity || identity.kind !== values.role) throw new Error("Select the matching workspace before searching.");
    const { role: _role, ...query } = values;
    void _role;
    return (await http.get<{ data: components["schemas"]["WorkspaceSearchPage"] }>(`me/social/${identity.id}/search`, query, options)).data;
  } };
}
