import { z } from "zod";
import type { components } from "@/types/generated/api";
import type { PostDraft, Role } from "@/types/domain";
import type { HttpClient } from "../api/client";
import type { AuthService } from "../auth/auth.service";
import type { FeedEntry, FeedService } from "./feed.service";
import type { ActivityData, ActivityService } from "../activity/activity.service";
import { commentSchema, postDraftValuesSchema, postPublishSchema, postTextSchema, socialFeedSchema, socialRoleSchema } from "@/lib/validation/social";

type Page = components["schemas"]["SocialFeedPage"];
type Draft = components["schemas"]["PostDraft"];
export function createHttpFeedService(http: HttpClient, auth: AuthService) {
  const flags = new Map<string, boolean>();
  const postVersions = new Map<string, number>();
  const commentVersions = new Map<string, number>();
  const leases = new Map<string, { base: string; id: string; version: number; pending: Promise<unknown> }>();
  const attempts = new Map<string, string>();
  const rev = (v: number | undefined) => z.number().int().min(1).parse(v);
  async function base(role?: Role) {
    if (role) socialRoleSchema.parse(role);
    const session = await auth.me();
    const identity = session.workspaces.find((w) => w.id === session.selected_identity_id);
    if (!identity || role && identity.kind !== role) throw new Error("Select the matching workspace before continuing.");
    return `me/social/${identity.id}`;
  }
  function remember(entry: FeedEntry) {
    for (const key of ["liked", "saved"] as const) flags.set(`${key}:${entry.id}`, entry.viewer[key]);
    if (entry.author) flags.set(`person:${entry.author.id}`, entry.viewer.following);
    if (entry.company && !entry.company.confidential) flags.set(`company:${entry.company.id}`, entry.viewer.following);
    if (entry.version) postVersions.set(entry.id, entry.version);
    for (const c of entry.comments) if ("version" in c && typeof c.version === "number") commentVersions.set(c.id, c.version);
    return entry;
  }
  async function intent(role: Role, id: string, kind: "liked" | "saved") {
    socialRoleSchema.parse(role); z.uuid().parse(id);
    const path = await base(role);
    if (!flags.has(`${kind}:${id}`)) remember((await http.get<{ data: FeedEntry }>(`${path}/entries/${id}`)).data);
    const enabled = !flags.get(`${kind}:${id}`);
    const result = (await http.patch<{ data: { enabled: boolean } }>(`${path}/entries/${id}/${kind}`, { enabled })).data.enabled;
    flags.set(`${kind}:${id}`, result); return result;
  }
  async function follow(role: Role, id: string, company: boolean) {
    socialRoleSchema.parse(role); z.uuid().parse(id);
    const path = await base(role), key = `${company ? "company" : "person"}:${id}`;
    if (!flags.has(key)) { const network = (await http.get<{ data: components["schemas"]["SocialNetwork"] }>(`${path}/network`)).data; flags.set(key, (company ? network.companies : network.following).some((p) => p.id === id)); }
    const enabled = !flags.get(key);
    const result = (await http.patch<{ data: { enabled: boolean } }>(`${path}/follows/${company ? "organizations" : "people"}/${id}`, { enabled })).data.enabled;
    flags.set(key, result); return result;
  }
  const feed: FeedService = {
    async getComments(role,id,limit) {
      socialRoleSchema.parse(role);z.uuid().parse(id);z.number().int().min(1).max(1000).parse(limit);
      const path=await base(role);const items:components["schemas"]["SocialComment"][]=[];let after:string|undefined;
      do { const result=(await http.get<{data:{items:components["schemas"]["SocialComment"][];nextCursor:string|null}}>(`${path}/entries/${id}/comments`,{after})).data;items.push(...result.items);after=result.nextCursor??undefined; } while(after&&items.length<limit);
      for(const c of items)commentVersions.set(c.id,c.version);
      return {items,nextCursor:after??null};
    },
    async getFeed(query) {
      const v = socialFeedSchema.parse(query), path = await base(v.role);
      let cursor: string | undefined, total = 0;
      const entries: FeedEntry[] = []; let suggestions: Page["suggestions"] = [];
      do {
        const page: Page = (await http.get<{ data: Page }>(`${path}/feed`, { filter: v.filter, sort: v.sort, q: v.q, limit: Math.min(40, v.limit - entries.length), cursor })).data;
        entries.push(...page.items.map(remember)); total = page.total; suggestions = page.suggestions;
        cursor = page.nextCursor ?? undefined;
      } while (cursor && entries.length < v.limit);
      const items = [...new Map(entries.map((entry) => [entry.id, entry])).values()];
      return { items, total, page: 1, pageSize: v.limit, pages: Math.max(1, Math.ceil(total / v.limit)), suggestions };
    },
    async getEntry(role, id) { socialRoleSchema.parse(role); z.uuid().parse(id); return remember((await http.get<{ data: FeedEntry }>(`${await base(role)}/entries/${id}`)).data); },
    toggleLike: (role, id) => intent(role, id, "liked"),
    async toggleSave(role, id) { return { saved: await intent(role, id, "saved"), persisted: true }; },
    toggleFollow: (role, id) => follow(role, id, false),
    toggleFollowCompany: (role, id) => follow(role, id, true),
    async getNetwork(role) {
      const network = (await http.get<{ data: components["schemas"]["SocialNetwork"] }>(`${await base(role)}/network`)).data;
      for (const p of [...network.following, ...network.followers]) flags.set(`person:${p.id}`, p.following);
      for (const c of network.companies) flags.set(`company:${c.id}`, true);
      return network;
    },
    async addComment(role, id, text) {
      socialRoleSchema.parse(role); z.uuid().parse(id); const value = commentSchema.parse(text);
      const key = JSON.stringify([role, id, value]); const creationKey = attempts.get(key) ?? crypto.randomUUID(); attempts.set(key, creationKey);
      await http.post(`${await base(role)}/entries/${id}/comments`, { text: value, creationKey }); attempts.delete(key);
    },
    async editComment(id, comment, text, version) { z.uuid().parse(id); z.uuid().parse(comment); const value = commentSchema.parse(text), revision = rev(version ?? commentVersions.get(comment)); await http.patch(`${await base()}/entries/${id}/comments/${comment}`, { text: value, version: revision }); return true; },
    async deleteComment(role, id, comment, version) { socialRoleSchema.parse(role); z.uuid().parse(id); z.uuid().parse(comment); const revision = rev(version ?? commentVersions.get(comment)); await http.delete(`${await base(role)}/entries/${id}/comments/${comment}`, { version: revision }); },
    async createPost(role, input) {
      socialRoleSchema.parse(role); const values = postPublishSchema.parse(input);
      if(input.creationKey)z.uuid().parse(input.creationKey);
      if(input.draftId){z.uuid().parse(input.draftId);rev(input.draftVersion);z.uuid().parse(input.editorToken);}
      const path = await base(role), signature = JSON.stringify([path, values]);
      const creationKey = input.creationKey ? z.uuid().parse(input.creationKey) : attempts.get(signature) ?? crypto.randomUUID(); attempts.set(signature, creationKey);
      const lease = input.draftId ? leases.get(input.editorToken ?? "") : null;
      if (input.draftId) { if (!lease || lease.id !== input.draftId || lease.base !== path) throw new Error("Reload your draft before publishing."); await lease.pending; }
      const result = (await http.post<{ data: { id: string } }>(`${path}/posts`, { ...values, creationKey, ...(input.draftId ? { draftId: input.draftId, draftVersion: lease!.version } : {}) })).data;
      attempts.delete(signature); return result;
    },
    async updatePost(role, id, input) { socialRoleSchema.parse(role); z.uuid().parse(id); const values = postTextSchema.parse(input), version = rev(input.version ?? postVersions.get(id)); await http.patch(`${await base(role)}/posts/${id}`, { ...values, version }); return true; },
    async deletePost(role, id, version) { socialRoleSchema.parse(role); z.uuid().parse(id); const revision = rev(version ?? postVersions.get(id)); await http.delete(`${await base(role)}/posts/${id}`, { version: revision }); },
  };
  async function activity(role: Role) {
    const data = (await http.get<{ data: ActivityData }>(`${await base(role)}/activity`)).data;
    for (const entry of [...data.posts, ...data.reactions, ...data.comments.map((g) => g.post)]) remember(entry);
    for (const group of data.comments) for (const c of group.comments) if (c.version) commentVersions.set(c.id, c.version);
    return data;
  }
  const activities: ActivityService = { getProfessionalActivity: () => activity("professional"), getRecruiterActivity: () => activity("recruiter") };
  return {
    feed, activity: activities,
    reset() { flags.clear(); postVersions.clear(); commentVersions.clear(); leases.clear(); attempts.clear(); },
    async getPostDraft(role: Role): Promise<PostDraft> {
      const path = await base(role), row = (await http.post<{ data: Draft }>(`${path}/draft`)).data;
      const token = crypto.randomUUID(); leases.set(token, { base: path, id: row.id, version: row.version, pending: Promise.resolve() });
      return { ...row, editorToken: token };
    },
    async storePostDraft(role: Role, draft: PostDraft) {
      socialRoleSchema.parse(role); const values = postDraftValuesSchema.parse(draft); z.uuid().parse(draft.id); rev(draft.version);
      const lease = leases.get(draft.editorToken ?? ""); if (!lease || lease.id !== draft.id) throw new Error("Reload this draft before saving.");
      const write = lease.pending.then(async () => {
        if (await base(role) !== lease.base) throw new Error("Your workspace changed. Reload this draft.");
        const row = (await http.patch<{ data: Draft }>(`${lease.base}/draft`, { ...values, id: draft.id, version: lease.version })).data;
        lease.version = row.version; draft.version = row.version;
      });
      lease.pending = write.catch(() => undefined); await write; return true;
    },
  };
}
