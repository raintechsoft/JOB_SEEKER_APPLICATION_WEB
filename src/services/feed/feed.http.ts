import { z } from "zod";
import type { components } from "@/types/generated/api";
import type { PostDraft, Role } from "@/types/domain";
import { ApiError, type HttpClient } from "../api/client";
import type { ReadScope } from "../realtime/realtime.http";
import type { AuthService } from "../auth/auth.service";
import type { FeedEntry, FeedService } from "./feed.service";
import type { ActivityData, ActivityService } from "../activity/activity.service";
import { commentSchema, peopleSearchSchema, postDraftValuesSchema, postPublishSchema, postTextSchema, quickJobPublishSchema, repostCommentarySchema, shareFollowersSchema, socialFeedSchema, socialRoleSchema } from "@/lib/validation/social";
import { reportSchema } from "@/lib/validation/communication";
import { linkPreviewRequestSchema, linkPreviewSchema, previewUrlInBody } from "@/lib/validation/link-preview";
import { activityCalendarContract, daysInMonth, type ActivityCalendarMonth } from "@/lib/activity/activity-calendar";
import { communicationPath } from "../messaging/messaging.http";

type Page = components["schemas"]["SocialFeedPage"];
type Draft = components["schemas"]["PostDraft"];
export function createHttpFeedService(http: HttpClient, auth: AuthService) {
  let epoch = 0;
  const guard = (version: number, scope?: ReadScope) => { if (version !== epoch || scope?.signal?.aborted) throw new ApiError("Workspace changed. Refresh to continue.", 412); };
  const flags = new Map<string, boolean>();
  const postVersions = new Map<string, number>();
  const commentVersions = new Map<string, number>();
  const leases = new Map<string, { base: string; id: string; version: number; pending: Promise<unknown> }>();
  const attempts = new Map<string, string>();
  const rev = (v: number | undefined) => z.number().int().min(1).parse(v);
  async function base(role?: Role, scope?: ReadScope) {
    const version = epoch;
    if (role) socialRoleSchema.parse(role);
    const session = await auth.me();
    guard(version, scope);
    if (scope?.userId && session.user.id !== scope.userId || scope?.identityId && session.selected_identity_id !== scope.identityId) throw new ApiError("Workspace changed. Refresh to continue.", 412);
    const identity = session.workspaces.find((w) => w.id === session.selected_identity_id);
    if (!identity || role && identity.kind !== role) throw new Error("Select the matching workspace before continuing.");
    return `me/social/${identity.id}`;
  }
  function remember(entry: FeedEntry) {
    for (const key of ["liked", "saved", "reposted"] as const) flags.set(`${key}:${entry.id}`, !!entry.viewer[key]);
    if (entry.author) flags.set(`person:${entry.author.id}`, entry.viewer.following);
    if (entry.company && !entry.company.confidential) flags.set(`company:${entry.company.id}`, entry.viewer.following);
    if (entry.version) postVersions.set(entry.id, entry.version);
    for (const c of entry.comments) if ("version" in c && typeof c.version === "number") commentVersions.set(c.id, c.version);
    return entry;
  }
  async function intent(role: Role, id: string, kind: "liked" | "saved" | "reposted", desired?: boolean) {
    socialRoleSchema.parse(role); z.uuid().parse(id); if (desired !== undefined) z.boolean().parse(desired);
    const path = await base(role);
    if (desired === undefined && !flags.has(`${kind}:${id}`)) remember((await http.get<{ data: FeedEntry }>(`${path}/entries/${id}`)).data);
    const enabled = desired ?? !flags.get(`${kind}:${id}`);
    const result = (await http.patch<{ data: { enabled: boolean } }>(`${path}/entries/${id}/${kind}`, { enabled })).data.enabled;
    flags.set(`${kind}:${id}`, result); return result;
  }
  async function follow(role: Role, id: string, company: boolean, desired?: boolean) {
    socialRoleSchema.parse(role); z.uuid().parse(id);
    if (desired !== undefined) z.boolean().parse(desired);
    const path = await base(role), key = `${company ? "company" : "person"}:${id}`;
    if (desired===undefined&&!flags.has(key)) { const network = (await http.get<{ data: components["schemas"]["SocialNetwork"] }>(`${path}/network`)).data; flags.set(key, (company ? network.companies : network.following).some((p) => p.id === id)); }
    const enabled = desired ?? !flags.get(key);
    const result = (await http.patch<{ data: { enabled: boolean } }>(`${path}/follows/${company ? "organizations" : "people"}/${id}`, { enabled })).data.enabled;
    flags.set(key, result); return result;
  }
  const feed: FeedService = {
    async searchPeople(role, q, limit) {
      const values = peopleSearchSchema.parse({ role, q, limit }), path = await base(role);
      const items: components["schemas"]["SocialPerson"][] = [];
      let after: string | undefined, total = 0;
      do {
        const page = (await http.get<{ data: components["schemas"]["SocialPeoplePage"] }>(`${path}/people`, { q: values.q, limit: Math.min(40, values.limit - items.length), after })).data;
        items.push(...page.items); total = page.total; after = page.nextCursor ?? undefined;
      } while (after && items.length < values.limit);
      return { items, total, nextCursor: after ?? null };
    },
    async getComments(role,id,limit,focus,scope) {
      const version=epoch;
      socialRoleSchema.parse(role);z.uuid().parse(id);z.number().int().min(1).max(1000).parse(limit);
      if(focus)z.uuid().parse(focus);
      const path=await base(role,scope);const items:components["schemas"]["SocialComment"][]=[];let after:string|undefined;
      do { const result=(await http.get<{data:{items:components["schemas"]["SocialComment"][];nextCursor:string|null}}>(`${path}/entries/${id}/comments`,{after,focus},scope)).data;guard(version,scope);items.push(...result.items);after=result.nextCursor??undefined; } while(after&&items.length<limit);
      for(const c of items)commentVersions.set(c.id,c.version);
      return {items,nextCursor:after??null};
    },
    async getFeed(query, scope) {
      const version=epoch, v = socialFeedSchema.parse(query), path = await base(v.role,scope);
      const page: Page = (await http.get<{ data: Page }>(`${path}/feed`, { filter: v.filter, sort: v.sort, q: v.q, limit: v.limit, ...(v.cursor ? { cursor: v.cursor } : {}) },scope)).data;
      guard(version,scope);
      const items = [...new Map(page.items.map((entry) => { const next = remember(entry); return [next.id, next] as const; })).values()];
      return { items, total: page.total, page: 1, pageSize: v.limit, pages: Math.max(1, Math.ceil(page.total / v.limit)), suggestions: page.suggestions, nextCursor: page.nextCursor };
    },
    async getEntry(role, id, scope) { const version=epoch; socialRoleSchema.parse(role); z.uuid().parse(id); const data=(await http.get<{ data: FeedEntry }>(`${await base(role,scope)}/entries/${id}`,undefined,scope)).data;guard(version,scope);return remember(data); },
    async refreshEntries(query, ids, scope) {
      const version=epoch, v=socialFeedSchema.parse(query);
      z.array(z.uuid()).max(1000).refine(values=>new Set(values).size===values.length).parse(ids);
      const path=await base(v.role,scope), entries:FeedEntry[]=[];
      for(let start=0;start<ids.length;start+=40){
        const page=(await http.get<{data:FeedEntry[]}>(`${path}/feed/refresh`,{ids:ids.slice(start,start+40).join(','),filter:v.filter},scope)).data;
        guard(version,scope);entries.push(...page.map(remember));
      }
      return entries;
    },
    toggleLike: (role, id, enabled) => intent(role, id, "liked", enabled),
    setReposted: async (role, id, enabled) => { z.boolean().parse(enabled); return intent(role, id, "reposted", enabled); },
    async createRepost(role, id, commentary) {
      socialRoleSchema.parse(role); z.uuid().parse(id);
      const value = commentary === null ? null : repostCommentarySchema.parse(commentary) || null;
      const data = (await http.post<{ data: { id: string; rootId: string; enabled: boolean } }>(`${await base(role)}/entries/${id}/reposts`, { commentary: value })).data;
      flags.set(`reposted:${data.rootId}`, true);
      return { id: data.id, rootId: data.rootId };
    },
    async removeRepost(role, id) {
      socialRoleSchema.parse(role); z.uuid().parse(id);
      const data = (await http.delete<{ data: { enabled: boolean; removed: boolean } }>(`${await base(role)}/entries/${id}/reposts`)).data;
      return data.removed;
    },
    async listReposts(role, id) {
      socialRoleSchema.parse(role); z.uuid().parse(id);
      return (await http.get<{ data: { items: components["schemas"]["RepostListing"]["items"]; total: number } }>(`${await base(role)}/entries/${id}/reposts`)).data;
    },
    async toggleSave(role, id, enabled) { return { saved: await intent(role, id, "saved",enabled), persisted: true }; },
    async setHidden(role, id, type, hidden) {
      z.uuid().parse(id); z.enum(["post", "job", "update"]).parse(type);
      const identity = (await base(role)).split("/")[2];
      if (hidden) await http.post(`me/hidden-items/${identity}`, { itemKind: type, itemId: id });
      else await http.delete(`me/hidden-items/${identity}/${type}/${id}`);
      return hidden;
    },
    toggleFollow: (role, id, enabled) => follow(role, id, false, enabled),
    toggleFollowCompany: (role, id, enabled) => follow(role, id, true,enabled),
    async getNetwork(role, scope) {
      const version=epoch, network = (await http.get<{ data: components["schemas"]["SocialNetwork"] }>(`${await base(role,scope)}/network`,undefined,scope)).data;
      guard(version,scope);
      for (const p of [...network.following, ...network.followers]) flags.set(`person:${p.id}`, p.following);
      for (const c of network.companies) flags.set(`company:${c.id}`, true);
      return network;
    },
    async shareWithFollowers(role, id, recipientIds) {
      socialRoleSchema.parse(role); z.uuid().parse(id);
      const value = shareFollowersSchema.parse({ selectedIds: recipientIds }).selectedIds;
      // One key per distinct selection: a retry after a network failure never messages a follower twice.
      const key = JSON.stringify(["share", role, id, [...value].sort()]); const shareKey = attempts.get(key) ?? crypto.randomUUID(); attempts.set(key, shareKey);
      const result = (await http.post<{ data: components["schemas"]["SocialShareResult"] }>(`${await base(role)}/entries/${id}/shares`, { recipientIds: value, shareKey })).data;
      attempts.delete(key);
      return result;
    },
    async addComment(role, id, text, parentId) {
      socialRoleSchema.parse(role); z.uuid().parse(id); if (parentId) z.uuid().parse(parentId); const value = commentSchema.parse(text);
      const key = JSON.stringify([role, id, value, parentId ?? ""]); const creationKey = attempts.get(key) ?? crypto.randomUUID(); attempts.set(key, creationKey);
      await http.post(`${await base(role)}/entries/${id}/comments`, { text: value, creationKey, ...(parentId ? { parentId } : {}) }); attempts.delete(key);
    },
    async editComment(id, comment, text, version) { z.uuid().parse(id); z.uuid().parse(comment); const value = commentSchema.parse(text), revision = rev(version ?? commentVersions.get(comment)); await http.patch(`${await base()}/entries/${id}/comments/${comment}`, { text: value, version: revision }); return true; },
    async deleteComment(role, id, comment, version) { socialRoleSchema.parse(role); z.uuid().parse(id); z.uuid().parse(comment); const revision = rev(version ?? commentVersions.get(comment)); await http.delete(`${await base(role)}/entries/${id}/comments/${comment}`, { version: revision }); },
    async pinComment(role, id, comment, enabled) { socialRoleSchema.parse(role); z.uuid().parse(id); z.uuid().parse(comment); z.boolean().parse(enabled); await http.patch(`${await base(role)}/entries/${id}/comments/${comment}/pinned`, { enabled }); },
    async blockCommentAuthor(role, id, comment) { socialRoleSchema.parse(role); z.uuid().parse(id); z.uuid().parse(comment); await http.patch(`${await base(role)}/entries/${id}/comments/${comment}/blocked`, { enabled: true }); },
    async blockPerson(role, personId) {
      socialRoleSchema.parse(role); z.uuid().parse(personId);
      await http.put(`${await base(role)}/blocks/${encodeURIComponent(personId)}`);
    },
    async blockOrganization(role, organizationId) {
      socialRoleSchema.parse(role); z.uuid().parse(organizationId);
      await http.put(`${await base(role)}/organization-blocks/${encodeURIComponent(organizationId)}`);
    },
    async reportComment(role, comment, reason, details) {
      socialRoleSchema.parse(role); z.uuid().parse(comment); const value = reportSchema.parse({reason, details});
      const signature = JSON.stringify([role, comment, value]); const creationKey = attempts.get(signature) ?? crypto.randomUUID(); attempts.set(signature, creationKey);
      await http.post(`${await communicationPath(auth, role)}/reports`, {...value, targetKind: "comment", targetId: comment, creationKey}); attempts.delete(signature);
    },
    async reportPerson(role, personId, reason, details) {
      socialRoleSchema.parse(role); z.uuid().parse(personId); const value = reportSchema.parse({reason, details});
      const signature = JSON.stringify([role, "identity", personId, value]); const creationKey = attempts.get(signature) ?? crypto.randomUUID(); attempts.set(signature, creationKey);
      await http.post(`${await communicationPath(auth, role)}/reports`, {...value, targetKind: "identity", targetId: personId, creationKey}); attempts.delete(signature);
    },
    async reportOrganization(role, organizationId, reason, details) {
      socialRoleSchema.parse(role); z.uuid().parse(organizationId); const value = reportSchema.parse({reason, details});
      const signature = JSON.stringify([role, "organization", organizationId, value]); const creationKey = attempts.get(signature) ?? crypto.randomUUID(); attempts.set(signature, creationKey);
      await http.post(`${await communicationPath(auth, role)}/reports`, {...value, targetKind: "organization", targetId: organizationId, creationKey}); attempts.delete(signature);
    },
    async getBlocked(role) { socialRoleSchema.parse(role); return (await http.get<{data:{identityId:string;person:import("@/types/api").PersonSummary}[]}>(`${await base(role)}/blocks`)).data; },
    async unblock(role, id) { socialRoleSchema.parse(role); z.uuid().parse(id); await http.delete(`${await base(role)}/blocks/${id}`); },
    async getBlockedOrganizations(role) {
      socialRoleSchema.parse(role);
      return (await http.get<{ data: { organizationId: string; company: import("@/types/api").CompanySummary }[] }>(`${await base(role)}/organization-blocks`)).data;
    },
    async unblockOrganization(role, organizationId) {
      socialRoleSchema.parse(role); z.uuid().parse(organizationId);
      await http.delete(`${await base(role)}/organization-blocks/${encodeURIComponent(organizationId)}`);
    },
    async createPost(role, input) {
      socialRoleSchema.parse(role); const values = postPublishSchema.parse(input);
      if(input.creationKey)z.uuid().parse(input.creationKey);
      if(input.draftId){z.uuid().parse(input.draftId);rev(input.draftVersion);z.uuid().parse(input.editorToken);}
      const path = await base(role), signature = JSON.stringify([path, values]);
      const creationKey = input.creationKey ? z.uuid().parse(input.creationKey) : attempts.get(signature) ?? crypto.randomUUID(); attempts.set(signature, creationKey);
      const lease = input.draftId ? leases.get(input.editorToken ?? "") : null;
      if (input.draftId) { if (!lease || lease.id !== input.draftId || lease.base !== path) throw new Error("Reload your draft before publishing."); await lease.pending; }
      const result = (await http.post<{ data: { id: string } }>(`${path}/posts`, { ...values, creationKey, ...(input.draftId ? { draftId: input.draftId, draftVersion: lease!.version } : {}), ...(input.quickJob ? { quickJob: input.quickJob } : {}) })).data;
      attempts.delete(signature); return result;
    },
    async updatePost(role, id, input) {
      socialRoleSchema.parse(role); z.uuid().parse(id); const version = rev(input.version ?? postVersions.get(id));
      const values = input.attachments !== undefined
        ? postPublishSchema.parse({ title: input.title, body: input.body, project: input.project ?? "", attachments: input.attachments, commentsEnabled: input.commentsEnabled ?? true, ...(input.mediaAspect !== undefined ? { mediaAspect: input.mediaAspect } : {}), ...(input.previewUrl !== undefined ? { previewUrl: input.previewUrl } : {}), ...(input.quickJob !== undefined ? { quickJob: input.quickJob } : {}) })
        : postTextSchema.parse(input);
      if (input.previewUrl !== undefined && !previewUrlInBody(z.string().parse(input.previewUrl), values.body)) throw new Error("The previewed link must appear in your story.");
      if (input.attachments === undefined && input.quickJob !== undefined) {
        quickJobPublishSchema.parse(input.quickJob);
      }
      const payload: Record<string, unknown> = { title: values.title, body: values.body, version };
      if (input.previewUrl !== undefined) payload.previewUrl = input.previewUrl;
      if (input.project !== undefined || input.attachments !== undefined) payload.project = ("project" in values ? values.project : input.project) || "";
      if (input.attachments !== undefined && "attachments" in values) payload.attachments = values.attachments;
      if (input.commentsEnabled !== undefined || ("commentsEnabled" in values && values.commentsEnabled !== undefined)) {
        payload.commentsEnabled = "commentsEnabled" in values ? values.commentsEnabled !== false : z.boolean().parse(input.commentsEnabled);
      }
      if (input.mediaAspect !== undefined) payload.mediaAspect = input.mediaAspect ?? null;
      if (input.quickJob !== undefined) payload.quickJob = input.quickJob;
      await http.patch(`${await base(role)}/posts/${id}`, payload); return true;
    },
    async getActivityCalendar(role, year, month) {
      socialRoleSchema.parse(role);
      const period = z.object({ year: z.number().int().min(activityCalendarContract.minYear).max(9999), month: z.number().int().min(1).max(12) }).parse({ year, month });
      const data = (await http.get<{ data: ActivityCalendarMonth }>(`${await base(role)}/activity-calendar`, period)).data;
      // A response for another period (or a partial one) must never be rendered as this month.
      if (data.year !== year || data.month !== month || data.days.length !== daysInMonth(year, month)) throw new Error("The activity calendar response did not match the selected month.");
      return data;
    },
    async getLinkPreview(role, url, signal) {
      socialRoleSchema.parse(role); const value = linkPreviewRequestSchema.parse(url);
      const data = (await http.post<{ data: unknown }>(`${await base(role)}/link-previews`, { url: value }, { signal })).data;
      // Metadata is untrusted remote content: anything outside the contract is treated as no preview.
      const parsed = data === null ? null : linkPreviewSchema.safeParse(data);
      return parsed?.success ? parsed.data : null;
    },
    async deletePost(role, id, version) { socialRoleSchema.parse(role); z.uuid().parse(id); const revision = rev(version ?? postVersions.get(id)); await http.delete(`${await base(role)}/posts/${id}`, { version: revision }); },
  };
  async function activity(role: Role, scope?: ReadScope) {
    const version=epoch, data = (await http.get<{ data: ActivityData }>(`${await base(role,scope)}/activity`,undefined,scope)).data;
    guard(version,scope);
    for (const entry of [...data.posts, ...data.reactions, ...data.comments.map((g) => g.post)]) remember(entry);
    for (const group of data.comments) for (const c of group.comments) if (c.version) commentVersions.set(c.id, c.version);
    return data;
  }
  const activities: ActivityService = { getProfessionalActivity: scope => activity("professional",scope), getRecruiterActivity: scope => activity("recruiter",scope) };
  return {
    feed, activity: activities,
    reset() { epoch++; flags.clear(); postVersions.clear(); commentVersions.clear(); leases.clear(); attempts.clear(); },
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
