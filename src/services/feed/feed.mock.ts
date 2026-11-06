import type { Draft } from "immer";
import type { DemoDatabase, DemoRepost, Id, Job, Post, Role, SocialGraph, WorkUpdate } from "@/types/domain";
import { commit, getDb } from "@/mocks/store/demo-db";
import { companySummary, feedPerson, jobCompany, personSummary, projectSummary } from "@/mocks/store/presenters";
import { currentRecruiter, homeCompany, isJobOpen, me, ME_ID, person, RECRUITER_ID, socialFor } from "@/mocks/store/selectors";
import { uid } from "@/lib/utils/id";
import type { FeedEntry, FeedQuery, FeedService, Network } from "./feed.service";
import { reportSchema } from "@/lib/validation/communication";
import { peopleSearchSchema, repostCommentarySchema, shareFollowersSchema } from "@/lib/validation/social";
import { activityCalendarContract, activityLevel, currentPeriod, daysInMonth, isoDate, periodKey, type ActivityType } from "@/lib/activity/activity-calendar";

type RawItem = (Post & { type: "post" }) | (Job & { type: "job"; owner?: undefined }) | (WorkUpdate & { type: "update"; body: string; createdAt: string; likes: number; kind: string; media: ""; image: "" });

const skillsOf = (i: RawItem): string[] => ("skills" in i ? i.skills ?? [] : []);
const bodyOf = (i: RawItem) => (i.type === "job" ? "" : i.body);

const identityId = (role: Role) => (role === "recruiter" ? RECRUITER_ID : ME_ID);

export function blockedInMock(db: DemoDatabase, role: Role, author: Id) {
  const me = identityId(role);
  return !!socialFor(db, role).blocked?.includes(author) || author === ME_ID && !!db.social.blocked?.includes(me) || author === RECRUITER_ID && !!db.recruiterSocial.blocked?.includes(me);
}

function companyBlockedInMock(db: DemoDatabase, role: Role, companyId: Id) {
  return !!(socialFor(db, role).blockedCompanies ?? []).includes(companyId);
}

function sourceVisible(db: DemoDatabase, role: Role, item: RawItem) {
  if (item.type === "job") return !companyBlockedInMock(db, role, item.company);
  if (item.owner === identityId(role)) return true;
  if (item.owner === RECRUITER_ID && companyBlockedInMock(db, role, homeCompany(db).id)) return false;
  return !blockedInMock(db, role, item.owner) && item.visibility !== "Private" && (item.owner === RECRUITER_ID || person(db, item.owner).public);
}

/* ---- Independent reposts (demo twin of the API's reposts table) ---- */
const ACTORS = (db: DemoDatabase): [Id, SocialGraph][] => [[ME_ID, db.social], [RECRUITER_ID, db.recruiterSocial]];
const activeReposts = (graph: SocialGraph) => (graph.reposts ?? []).filter((r) => !r.deletedAt);
function findRepost(db: DemoDatabase, id: Id): { actor: Id; repost: DemoRepost } | undefined {
  for (const [actor, graph] of ACTORS(db)) {
    const repost = (graph.reposts ?? []).find((r) => r.id === id);
    if (repost) return { actor, repost };
  }
  return undefined;
}
/** The viewer's own reposts are always visible; others' when the reposter is visible and not blocked. */
function reposterVisible(db: DemoDatabase, role: Role, actor: Id) {
  if (actor === identityId(role)) return true;
  if (actor === RECRUITER_ID) return !companyBlockedInMock(db, role, homeCompany(db).id);
  return person(db, actor).public && !blockedInMock(db, role, actor);
}
function ownActiveRepost(db: DemoDatabase, role: Role, rootId: Id) {
  return activeReposts(socialFor(db, role)).find((r) => r.rootId === rootId);
}
function repostChain(db: DemoDatabase, repost: DemoRepost) {
  const chain = [];
  let next = repost.parentId;
  const seen = new Set<Id>();
  while (next && !seen.has(next) && chain.length < 20) {
    seen.add(next);
    const found = findRepost(db, next);
    if (!found) break;
    chain.push({ id: found.repost.id, author: feedPerson(db, found.actor), createdAt: found.repost.createdAt, commentary: found.repost.deletedAt ? null : found.repost.commentary, removed: !!found.repost.deletedAt });
    next = found.repost.parentId;
  }
  return chain;
}
/** A repost entry: the original's content and author, the repost's own id, time and attribution. */
function repostEntry(db: DemoDatabase, role: Role, actor: Id, repost: DemoRepost, root: RawItem): FeedEntry {
  const inner = toFeedEntry(db, role, root);
  const s = socialFor(db, role);
  const withThoughts = repost.commentary !== null;
  return {
    ...inner,
    id: repost.id,
    createdAt: repost.createdAt,
    rootId: root.id,
    interactionId: withThoughts ? repost.id : root.id,
    repost: { id: repost.id, author: feedPerson(db, actor), createdAt: repost.createdAt, commentary: repost.commentary, removed: false, parentId: repost.parentId, chain: repostChain(db, repost) },
    viewer: { ...inner.viewer, own: actor === identityId(role), ...(withThoughts ? { liked: s.liked.includes(repost.id) } : {}) },
    ...(withThoughts ? { likes: 0, comments: [], commentCount: 0 } : {}),
  };
}
/** Repost entries visible to the viewer whose original is among `roots`, subject to the feed filter. */
function repostEntries(db: DemoDatabase, query: FeedQuery, roots: RawItem[]): FeedEntry[] {
  if (query.filter === "jobs" || query.filter === "saved") return [];
  const viewer = identityId(query.role), s = socialFor(db, query.role), byId = new Map(roots.map((r) => [r.id, r]));
  const q = query.q.trim().toLowerCase();
  const out: FeedEntry[] = [];
  for (const [actor, graph] of ACTORS(db)) {
    if (!reposterVisible(db, query.role, actor)) continue;
    if (query.filter === "reposts" && actor !== viewer) continue;
    if (query.filter === "following" && actor !== viewer && !s.following.includes(actor)) continue;
    for (const repost of activeReposts(graph)) {
      const root = byId.get(repost.rootId);
      if (!root) continue;
      if (q && !searchText(db, query.role, root).includes(q)) continue;
      if (!q && ["all", "following"].includes(query.filter) && s.hidden?.includes(root.id)) continue;
      out.push(repostEntry(db, query.role, actor, repost, root));
    }
  }
  return out;
}

const updateAsItem = (u: WorkUpdate): RawItem => ({ ...u, body: u.description, type: "update", createdAt: u.date + "T09:00:00", likes: 0, kind: "Work update", media: "", image: "" });

function professionalItems(db: DemoDatabase): RawItem[] {
  return [
    ...db.social.jobs.filter(isJobOpen).map((j): RawItem => ({ ...j, type: "job" })),
    ...db.social.posts.map((p): RawItem => ({ ...p, type: "post" })),
    ...db.updates.filter((u) => u.owner === ME_ID || u.visibility === "Public").map(updateAsItem),
  ];
}

function recruiterItems(db: DemoDatabase): RawItem[] {
  const isPublic = (id: Id) => db.professionals.some((u) => u.id === id && u.public);
  return [
    ...db.social.posts.filter((p) => p.owner === RECRUITER_ID || isPublic(p.owner)).map((p): RawItem => ({ ...p, type: "post" })),
    ...db.updates.filter((u) => u.visibility === "Public" && person(db, u.owner).public).map(updateAsItem),
    ...db.social.jobs.filter(isJobOpen).map((j): RawItem => ({ ...j, type: "job" })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function searchText(db: DemoDatabase, role: Role, item: RawItem) {
  const author =
    item.type === "job"
      ? role === "professional"
        ? db.companies.find((c) => c.id === item.company)?.name
        : undefined
      : item.owner === RECRUITER_ID
        ? homeCompany(db).recruiter
        : feedPerson(db, item.owner).name;
  const extra = item.type === "job" ? (role === "professional" ? [item.description, item.location] : [item.description]) : [];
  return [item.title, bodyOf(item), ...extra, author, ...skillsOf(item)].join(" ").toLowerCase();
}

export function toFeedEntry(db: DemoDatabase, role: Role, item: RawItem): FeedEntry {
  const s = socialFor(db, role);
  const viewerId = identityId(role);
  const sourceOwn = item.type === "job" ? role === "recruiter" && item.company === homeCompany(db).id : item.owner === viewerId;
  const allComments = db.social.comments[item.id] || [];
  const visible = allComments.filter(c => !blockedInMock(db, role, c.owner));
  const comments = visible.filter(c => !c.parentId || visible.some(parent => parent.id === c.parentId)).map(c => ({ id: c.id, text: c.text, createdAt: c.createdAt, author: feedPerson(db, c.owner), parentId: c.parentId, version: c.version ?? 1, own: c.owner === viewerId, pinned: db.social.pinnedComments?.[item.id] === c.id, canPin: sourceOwn && !c.parentId, canDelete: sourceOwn || c.owner === viewerId, following: s.following.includes(c.owner), canMessage: c.owner !== viewerId, canBlock: c.owner !== viewerId, canReport: c.owner !== viewerId })).sort((a,b) => Number(b.pinned) - Number(a.pinned));
  const projectId = item.type === "job" ? "" : item.project;
  const project = projectId ? db.projects.find((p) => p.id === projectId) : undefined;
  const base = {
    id: item.id,
    createdAt: item.createdAt,
    title: item.title,
    skills: skillsOf(item),
    likes: item.likes ?? 0,
    comments,
    commentCount: comments.length,
    commentsEnabled: item.type === "post" ? item.commentsEnabled !== false : true,
    mediaAspect: item.type === "post" ? item.mediaAspect ?? null : null,
    repost: null,
    project: project ? projectSummary(project) : undefined,
  };
  if (item.type === "job") {
    const company = jobCompany(db, item);
    const ownedByViewer = role === "recruiter" && item.company === homeCompany(db).id;
    return {
      ...base,
      type: "job",
      ownerId: item.company,
      body: item.description,
      kind: "Job",
      media: "",
      image: "",
      company,
      job: {
        location: item.location,
        arrangement: item.arrangement,
        employment: item.employment,
        salary: item.salary,
        hideSalary: !!item.hideSalary,
        art: item.art,
        thumbnail: item.thumbnail,
        jobMedia: item.jobMedia,
        ownedByViewer,
        applied: db.social.applications.some((a) => a.job === item.id),
      },
      viewer: { liked: s.liked.includes(item.id), saved: s.saved.includes(item.id), following: s.followingCompanies.includes(company.id), own: ownedByViewer, reposted: false, canRepost: false },
    };
  }
  const entry: FeedEntry = {
    ...base,
    type: item.type,
    ownerId: item.owner,
    body: item.body,
    kind: item.kind,
    media: item.media,
    image: item.image,
    imageAlt: item.type === "post" ? item.imageAlt : undefined,
    video: item.type === "post" ? item.video : undefined,
    attachments: item.type === "post" ? item.attachments : undefined,
    visibility: item.visibility,
    author: feedPerson(db, item.owner),
    viewer: { liked: s.liked.includes(item.id), saved: s.saved.includes(item.id), following: s.following.includes(item.owner), own: item.owner === viewerId, reposted: !!ownActiveRepost(db, role, item.id), canRepost: item.owner === viewerId || item.visibility !== "Private" },
  };
  if (item.type === "post" && item.linkedJobId) {
    const job = db.social.jobs.find((j) => j.id === item.linkedJobId);
    if (job) {
      entry.linkedJob = {
        id: job.id,
        title: job.title,
        location: job.location,
        arrangement: job.arrangement,
        employment: job.employment,
        ownedByViewer: role === "recruiter" && job.company === homeCompany(db).id,
        applied: db.social.applications.some((a) => a.job === job.id),
        open: isJobOpen(job),
      };
    }
  }
  return entry;
}

/** Demo "For you": skills the viewer has (or, for a recruiter, hires for) first, then people and companies followed. */
function recommendation(db: DemoDatabase, role: Role) {
  const s = socialFor(db, role);
  const skills = new Set((role === "professional" ? me(db).skills : db.social.jobs.filter((j) => j.company === homeCompany(db).id).flatMap((j) => j.skills)).map((k) => k.toLowerCase()));
  return (item: RawItem) => {
    const followed = item.type === "job" ? s.followingCompanies.includes(item.company) : s.following.includes(item.owner);
    const shared = skillsOf(item).filter((k) => skills.has(k.toLowerCase()));
    const reason = shared.length
      ? (role === "recruiter" ? "Skills you hire for: " : "Matches your skills: ") + shared.slice(0, 2).join(", ")
      : followed ? (item.type === "job" ? "From a company you follow" : "From someone you follow") : "Recent in your network";
    return { score: 2 * Math.min(3, shared.length) + 3 * Number(followed), reason };
  };
}

function filterItems(db: DemoDatabase, query: FeedQuery) {
  const s = socialFor(db, query.role);
  let list: RawItem[];
  if (query.role === "professional") {
    list = professionalItems(db);
    if (query.filter !== "saved") list = list.filter((p) => p.type === "job" || p.owner === ME_ID || p.owner === RECRUITER_ID || (s.following.includes(p.owner) && person(db, p.owner).public));
    if (query.filter === "following") list = list.filter((p) => (p.type === "job" ? s.followingCompanies.includes(p.company) : s.following.includes(p.owner)));
    if (query.filter === "jobs") list = list.filter((p) => p.type === "job");
  } else {
    list = recruiterItems(db);
    if (query.filter === "following") list = list.filter((p) => (p.type === "job" ? s.followingCompanies.includes(p.company) : s.following.includes(p.owner)));
    if (query.filter === "jobs") list = list.filter((p) => p.type === "job" && p.company === homeCompany(db).id);
  }
  list = list.filter(item => sourceVisible(db, query.role, item));
  // Reposts are separate entries (see repostEntries); the Reposts view lists none of the originals.
  if (query.filter === "reposts") list = [];
  if (query.filter === "saved") list = list.filter((p) => s.saved.includes(p.id));
  const q = query.q.trim().toLowerCase();
  if (q) list = list.filter((p) => searchText(db, query.role, p).includes(q));
  // "Not interested" items leave the main feeds; saved, reposts and searches still show them.
  else if (["all", "jobs", "following"].includes(query.filter)) list = list.filter((p) => !s.hidden?.includes(p.id));
  const score = (p: RawItem) => (p.likes || 0) + Number(s.liked.includes(p.id));
  const time = (item: RawItem) => item.createdAt;
  if (query.sort === "popular") list.sort((a, b) => score(b) - score(a));
  else if (query.sort === "recommended") {
    const rank = recommendation(db, query.role);
    list.sort((a, b) => rank(b).score - rank(a).score || time(b).localeCompare(time(a)) || b.id.localeCompare(a.id));
  } else list.sort((a, b) => time(b).localeCompare(time(a)) || b.id.localeCompare(a.id));
  return list;
}

function toggleIn(list: Id[], id: Id) {
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else list.push(id);
  return i < 0;
}

const graph = (db: Draft<DemoDatabase>, role: Role): Draft<SocialGraph> => (role === "recruiter" ? db.recruiterSocial : db.social);

export const mockFeedService: FeedService = {
  async searchPeople(role, q, limit) {
    const values = peopleSearchSchema.parse({ role, q, limit }), db = getDb();
    const terms = values.q.toLocaleLowerCase().split(/\s+/u);
    const people = [...db.professionals.filter(p => p.public).map(p => personSummary(p, db)), ...(currentRecruiter(db).profileVisibility === "Public" && db.organizationWorkspace.organization.profileVisibility === "Public" ? [feedPerson(db, RECRUITER_ID)] : [])]
      .filter(p => p.id !== identityId(role) && !blockedInMock(db, role, p.id) && terms.every(term => `${p.name} ${p.headline}`.toLocaleLowerCase().includes(term)))
      .sort((a, b) => a.id.localeCompare(b.id));
    return { items: people.slice(0, values.limit), total: people.length, nextCursor: people.length > values.limit ? people[values.limit - 1].id : null };
  },
  async getFeed(query) {
    const db = getDb();
    const list = filterItems(db, query);
    const rank = recommendation(db, query.role);
    const sources = (query.role === "professional" ? professionalItems(db) : recruiterItems(db)).filter((item) => sourceVisible(db, query.role, item));
    const reposts = repostEntries(db, query, sources).map((entry) => ({ entry, item: sources.find((i) => i.id === entry.rootId)! }));
    const merged = [...list.map((item) => ({ entry: toFeedEntry(db, query.role, item), item })), ...reposts];
    const scoreOf = ({ entry, item }: { entry: FeedEntry; item: RawItem }) => query.sort === "popular" ? entry.likes + Number(entry.viewer.liked) : query.sort === "recommended" ? rank(item).score : 0;
    merged.sort((a, b) => scoreOf(b) - scoreOf(a) || b.entry.createdAt.localeCompare(a.entry.createdAt) || b.entry.id.localeCompare(a.entry.id));
    const ranked = merged.map(({ entry, item }) => ({ ...entry, ...(query.sort === "recommended" ? { recommendationReason: rank(item).reason } : {}) }));
    const offset = query.cursor && /^\d+$/.test(query.cursor) ? Number(query.cursor) : 0;
    const items = ranked.slice(offset, offset + query.limit);
    const nextCursor = offset + query.limit < ranked.length ? String(offset + query.limit) : null;
    const s = socialFor(db, query.role);
    const suggestions = db.professionals.filter((p) => p.id !== identityId(query.role) && p.public && !blockedInMock(db, query.role, p.id) && !s.following.includes(p.id)).slice(0, 3).map(p => personSummary(p, db));
    return { items, total: ranked.length, page: 1, pageSize: query.limit, pages: Math.max(1, Math.ceil(ranked.length / query.limit)), suggestions, nextCursor };
  },

  async getEntry(role, id) {
    const db = getDb();
    const sources = role === "professional" ? professionalItems(db) : recruiterItems(db);
    const item = sources.find((p) => p.id === id && sourceVisible(db, role, p));
    if (item) return toFeedEntry(db, role, item);
    const found = findRepost(db, id);
    if (!found || found.repost.deletedAt || !reposterVisible(db, role, found.actor)) return null;
    const root = sources.find((p) => p.id === found.repost.rootId && sourceVisible(db, role, p));
    return root ? repostEntry(db, role, found.actor, found.repost, root) : null;
  },

  async toggleLike(role, id, enabled) {
    let liked = false;
    commit((db) => {
      const s = graph(db, role);
      liked = enabled ?? !s.liked.includes(id);
      if (s.liked.includes(id) !== liked) toggleIn(s.liked, id);
      if (liked) s.reactionDates[id] = new Date().toISOString();
      else delete s.reactionDates[id];
    });
    return liked;
  },

  async setReposted(role, id, enabled) {
    if (enabled) await mockFeedService.createRepost(role, id, null);
    else await mockFeedService.removeRepost(role, id);
    return enabled;
  },

  async createRepost(role, id, commentary) {
    const entry = await mockFeedService.getEntry(role, id);
    if (!entry || !entry.viewer.canRepost) throw new Error("This post is not available for reposting.");
    const value = commentary === null ? null : repostCommentarySchema.parse(commentary) || null;
    const rootId = entry.rootId ?? entry.id;
    // Reposting someone else's repost keeps it as parent; your own repost counts as a direct repost.
    const parentId = entry.repost && !entry.viewer.own ? entry.repost.id : null;
    let result = { id: "", rootId };
    const persisted = commit((db) => {
      const g = graph(db, role);
      g.reposts ??= [];
      const existing = g.reposts.find((r) => r.rootId === rootId && !r.deletedAt);
      if (existing) {
        if (value !== null && value !== existing.commentary) existing.commentary = value;
        result = { id: existing.id, rootId };
        return;
      }
      const repost: DemoRepost = { id: uid(), rootId, parentId, commentary: value, createdAt: new Date().toISOString() };
      g.reposts.push(repost);
      result = { id: repost.id, rootId };
    }, { rollbackOnFailure: true });
    if (!persisted) throw new Error("Your repost could not be saved. Please try again.");
    return result;
  },

  async removeRepost(role, id) {
    const db = getDb();
    const rootId = findRepost(db, id)?.repost.rootId ?? id;
    let removed = false;
    commit((d) => {
      const mine = (graph(d, role).reposts ?? []).find((r) => r.rootId === rootId && !r.deletedAt);
      if (mine) { mine.deletedAt = new Date().toISOString(); removed = true; }
    });
    return removed;
  },

  async listReposts(role, id) {
    const db = getDb();
    const rootId = findRepost(db, id)?.repost.rootId ?? id;
    const items = ACTORS(db).filter(([actor]) => reposterVisible(db, role, actor)).flatMap(([actor, graph]) => activeReposts(graph).filter((r) => r.rootId === rootId).map((r) => ({ id: r.id, author: feedPerson(db, actor), createdAt: r.createdAt, commentary: r.commentary, own: actor === identityId(role) }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items, total: items.length };
  },

  async setHidden(role, id, _type, hidden) {
    const persisted = commit((db) => {
      const list = graph(db, role).hidden ??= [];
      if (hidden !== list.includes(id)) toggleIn(list, id);
    }, { rollbackOnFailure: true });
    if (!persisted) throw new Error("This change could not be saved. Please try again.");
    return hidden;
  },

  async toggleSave(role, id) {
    let saved = false;
    const persisted = commit((db) => {
      saved = toggleIn(graph(db, role).saved, id);
      if (!saved && role === "professional") delete db.social.archivedSavedJobs?.[id];
    });
    return { saved, persisted };
  },

  async toggleFollow(role, personId, enabled) {
    if (enabled !== false && blockedInMock(getDb(), role, personId)) throw new Error("This account cannot be followed.");
    let following = false;
    commit((db) => {
      const list = graph(db, role).following;
      following = enabled ?? !list.includes(personId);
      if (following !== list.includes(personId)) toggleIn(list, personId);
    });
    return following;
  },

  async toggleFollowCompany(role, companyId, enabled) {
    if (enabled !== false && companyBlockedInMock(getDb(), role, companyId)) throw new Error("This organization cannot be followed.");
    let following = false;
    commit((db) => {
      const list = graph(db, role).followingCompanies;
      following = enabled ?? !list.includes(companyId);
      if (following !== list.includes(companyId)) toggleIn(list, companyId);
    });
    return following;
  },

  async addComment(role, postId, text, parentId) {
    const entry = await mockFeedService.getEntry(role, postId);
    if (entry && !entry.commentsEnabled) throw new Error("Comments are turned off for this post.");
    commit((db) => {
      (db.social.comments[postId] ??= []).push({ id: uid(), owner: identityId(role), text, createdAt: new Date().toISOString(), parentId });
    });
  },

  async editComment(postId, commentId, text) {
    let found = false;
    commit((db) => {
      const c = db.social.comments[postId]?.find((x) => x.id === commentId && x.owner === ME_ID);
      if (!c) return;
      found = true;
      c.text = text;
      c.editedAt = new Date().toISOString();
    });
    return found;
  },

  async deleteComment(role, postId, commentId) {
    const entry = await mockFeedService.getEntry(role, postId);
    const comment = entry?.comments.find(c => c.id === commentId);
    if (!comment?.canDelete) throw new Error("You cannot delete this comment.");
    commit((db) => {
      db.social.comments[postId] = (db.social.comments[postId] || []).filter(c => c.id !== commentId && c.parentId !== commentId);
      if (db.social.pinnedComments?.[postId] === commentId) delete db.social.pinnedComments[postId];
    });
  },

  async pinComment(role, postId, commentId, enabled) {
    const comment = (await mockFeedService.getEntry(role, postId))?.comments.find(c => c.id === commentId);
    if (!comment?.canPin) throw new Error("Only the post author can pin original comments.");
    commit(db => { const pins = db.social.pinnedComments ??= {}; if (enabled) pins[postId] = commentId; else if (pins[postId] === commentId) delete pins[postId]; });
  },
  async blockCommentAuthor(role, postId, commentId) {
    const comment = (await mockFeedService.getEntry(role, postId))?.comments.find(c => c.id === commentId);
    if (!comment?.canBlock) throw new Error("This account cannot be blocked.");
    commit(db => {
      const s = graph(db, role), id = comment.author.id, me = identityId(role);
      s.blocked ??= []; if (!s.blocked.includes(id)) s.blocked.push(id);
      s.following = s.following.filter(target => target !== id);
      s.followers = s.followers.filter(target => target !== id);
      const other = id === ME_ID ? db.social : id === RECRUITER_ID ? db.recruiterSocial : null;
      if (other) { other.following = other.following.filter(target => target !== me); other.followers = other.followers.filter(target => target !== me); }
    });
  },
  async blockPerson(role, personId) {
    if (personId === identityId(role)) throw new Error("You cannot block your own account.");
    commit(db => {
      const s = graph(db, role), me = identityId(role);
      s.blocked ??= []; if (!s.blocked.includes(personId)) s.blocked.push(personId);
      s.following = s.following.filter(target => target !== personId);
      s.followers = s.followers.filter(target => target !== personId);
      const other = personId === ME_ID ? db.social : personId === RECRUITER_ID ? db.recruiterSocial : null;
      if (other) { other.following = other.following.filter(target => target !== me); other.followers = other.followers.filter(target => target !== me); }
    });
  },
  async blockOrganization(role, organizationId) {
    commit(db => {
      const s = graph(db, role);
      s.blockedCompanies ??= [];
      if (!s.blockedCompanies.includes(organizationId)) s.blockedCompanies.push(organizationId);
      s.followingCompanies = s.followingCompanies.filter((id) => id !== organizationId);
    });
  },
  async reportComment(role, commentId, reason, details) {
    const value = reportSchema.parse({reason, details});
    const postId = Object.keys(getDb().social.comments).find(id => getDb().social.comments[id].some(c => c.id === commentId));
    const comment = postId && (await mockFeedService.getEntry(role, postId))?.comments.find(c => c.id === commentId);
    if (!comment || !comment.canReport) throw new Error("This comment cannot be reported.");
    commit(db => { (graph(db, role).commentReports ??= []).push({commentId, ...value, createdAt: new Date().toISOString()}); });
  },
  async reportPerson(role, personId, reason, details) {
    if (personId === identityId(role)) throw new Error("You cannot report your own profile.");
    reportSchema.parse({reason, details});
  },
  async reportOrganization(_role, _organizationId, reason, details) {
    reportSchema.parse({reason, details});
  },
  async getBlocked(role) { return (socialFor(getDb(), role).blocked ?? []).map(id => ({ identityId: id, person: feedPerson(getDb(), id) })); },
  async unblock(role, id) { commit(db => { const s = graph(db, role); s.blocked = (s.blocked ?? []).filter(target => target !== id); }); },
  async getBlockedOrganizations(role) {
    const db = getDb();
    const ids = socialFor(db, role).blockedCompanies ?? [];
    return db.companies.filter((c) => ids.includes(c.id)).map((c) => ({ organizationId: c.id, company: companySummary(db, c) }));
  },
  async unblockOrganization(role, organizationId) {
    commit((db) => {
      const s = graph(db, role);
      s.blockedCompanies = (s.blockedCompanies ?? []).filter((id) => id !== organizationId);
    });
  },

  async getNetwork(role): Promise<Network> {
    const db = getDb();
    const s = socialFor(db, role);
    const self = identityId(role);
    const people = db.professionals.filter((p) => p.id !== self && p.public && !blockedInMock(db, role, p.id));
    return {
      following: people.filter((p) => s.following.includes(p.id)).map((p) => ({ ...personSummary(p), following: true })),
      companies: db.companies.filter((c) => s.followingCompanies.includes(c.id)).map((c) => companySummary(db, c)),
      followers: people.filter((p) => s.followers.includes(p.id)).map((p) => ({ ...personSummary(p), following: s.following.includes(p.id) })),
    };
  },

  async shareWithFollowers(role, id, recipientIds) {
    const db = getDb();
    const s = socialFor(db, role);
    const self = identityId(role);
    const targets = shareFollowersSchema.parse({ selectedIds: recipientIds }).selectedIds;
    if (targets.some((target) => !s.followers.includes(target))) throw new Error("Choose followers from your current list.");
    // Posts, work updates and jobs are all feed entries; the thread renders a live card for them.
    const entry = db.social.posts.find((p) => p.id === id) ?? db.updates.find((u) => u.id === id) ?? db.social.jobs.find((j) => j.id === id);
    if (!entry) throw new Error("This post is no longer available.");
    const title = entry.title.trim();
    const text = title ? `Shared a post with you: \u201c${title}\u201d` : "Shared a post with you.";
    const shared: Id[] = [];
    const failed: Id[] = [];
    commit((d) => {
      for (const target of targets) {
        if (blockedInMock(db, role, target)) {
          failed.push(target);
          continue;
        }
        const ids = [self, target].sort() as [Id, Id];
        let conversation = d.conversations.find((x) => x.peerIds?.join(":") === ids.join(":"));
        if (!conversation) {
          conversation = { id: uid(), peerIds: ids, candidate: target, name: feedPerson(db, target).name, company: "", messages: [], unread: false };
          d.conversations.unshift(conversation);
        }
        conversation.messages.push({ id: uid(), text, sender: role, senderId: self, time: new Date().toISOString(), attachments: [], sharedEntryId: id });
        shared.push(target);
      }
    });
    return { shared, failed };
  },

  async createPost(role, input) {
    const id = uid();
    const image = input.attachments.find((m) => m.type === "image");
    const video = input.attachments.find((m) => m.type === "video");
    const quick = input.quickJob?.enabled ? input.quickJob : null;
    if (quick && role !== "recruiter") throw new Error("Only recruiters can attach a quick job to a post.");
    const linkedJobId = quick ? uid() : undefined;
    const post: Post = {
      id,
      owner: identityId(role),
      title: input.title.trim(),
      body: input.body.trim(),
      attachments: input.attachments.map((m) => ({ ...m })),
      image: image?.src || "",
      imageAlt: image?.alt || input.title,
      video: video?.src || "",
      project: input.project,
      media: "",
      createdAt: new Date().toISOString(),
      likes: 0,
      kind: input.attachments.length ? "Media post" : input.project ? "Project showcase" : "Professional update",
      commentsEnabled: input.commentsEnabled,
      mediaAspect: input.mediaAspect ?? null,
      linkedJobId,
    };
    const ok = commit(
      (db) => {
        if (quick && linkedJobId) {
          const company = homeCompany(db);
          db.social.jobs.unshift({
            id: linkedJobId,
            company: company.id,
            title: quick.title.trim(),
            location: quick.locations.join(" · "),
            arrangement: quick.arrangement,
            employment: quick.employment,
            salary: "Salary not disclosed",
            hideSalary: true,
            skills: ["General"],
            description: input.body.trim() || "See the linked post for details about this opportunity.",
            responsibilities: ["Contribute to the role described in this opportunity."],
            requirements: "Relevant experience for this role.",
            createdAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            likes: 0,
            art: "cobalt",
            companyDisplayName: company.name,
            thumbnail: { template: "none", image: "", alt: "", headline: "" },
            jobMedia: { video: "", files: [] },
          });
        }
        db.social.posts.unshift(post);
        delete db.postEditorDrafts[role];
      },
      { rollbackOnFailure: true },
    );
    return ok ? { id } : null;
  },

  // Prototype data: the same aggregation policy applied to the in-browser demo posts and work updates.
  async getActivityCalendar(role, year, month) {
    const db = getDb();
    const owner = identityId(role);
    const zoneDate = new Intl.DateTimeFormat("en-CA", { timeZone: activityCalendarContract.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    const events: [string, ActivityType][] = [
      ...db.social.posts.filter((p) => p.owner === owner).map((p): [string, ActivityType] => [zoneDate.format(new Date(p.createdAt)), "post_published"]),
      ...(role === "professional" ? db.updates.filter((u) => u.owner === owner).map((u): [string, ActivityType] => [u.date.slice(0, 10), "work_update_recorded"]) : []),
    ];
    const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => {
      const date = isoDate(year, month, i + 1);
      const activities = (Object.keys(activityCalendarContract.labels) as ActivityType[])
        .map((type) => ({ type, label: activityCalendarContract.labels[type], count: events.filter(([d, t]) => d === date && t === type).length }))
        .filter((a) => a.count);
      const count = activities.reduce((n, a) => n + a.count, 0);
      return { date, count, level: activityLevel(count), activities };
    });
    const latest = currentPeriod();
    return { year, month, timezone: activityCalendarContract.timezone, total: days.reduce((n, d) => n + d.count, 0), days, range: { earliest: `${latest.year - 1}-01`, latest: periodKey(latest) } };
  },

  // The prototype data source never contacts external sites; links stay plain clickable text.
  async getLinkPreview() {
    return null;
  },

  async updatePost(role, id, input) {
    let found = false;
    commit((db) => {
      const p = db.social.posts.find((x) => x.id === id && x.owner === identityId(role));
      if (!p) return;
      found = true;
      p.title = input.title;
      p.body = input.body;
      if (input.project !== undefined) p.project = input.project;
      if (input.commentsEnabled !== undefined) p.commentsEnabled = input.commentsEnabled;
      if (input.mediaAspect !== undefined) p.mediaAspect = input.mediaAspect ?? null;
      if (input.attachments !== undefined) {
        p.attachments = input.attachments.map((m) => ({ ...m }));
        const image = input.attachments.find((m) => m.type === "image");
        const video = input.attachments.find((m) => m.type === "video");
        p.image = image?.src || "";
        p.imageAlt = image?.alt || input.title;
        p.video = video?.src || "";
      }
      if (input.quickJob !== undefined) {
        if (input.quickJob.enabled && role !== "recruiter") throw new Error("Only recruiters can attach a quick job to a post.");
        if (input.quickJob.enabled) {
          const company = homeCompany(db);
          if (p.linkedJobId) {
            const job = db.social.jobs.find((j) => j.id === p.linkedJobId);
            if (job) {
              job.title = input.quickJob.title.trim();
              job.location = input.quickJob.locations.join(" · ");
              job.arrangement = input.quickJob.arrangement;
              job.employment = input.quickJob.employment;
              job.description = input.body.trim() || job.description;
            }
          } else {
            const linkedJobId = uid();
            p.linkedJobId = linkedJobId;
            db.social.jobs.unshift({
              id: linkedJobId,
              company: company.id,
              title: input.quickJob.title.trim(),
              location: input.quickJob.locations.join(" · "),
              arrangement: input.quickJob.arrangement,
              employment: input.quickJob.employment,
              salary: "Salary not disclosed",
              hideSalary: true,
              skills: ["General"],
              description: input.body.trim() || "See the linked post for details about this opportunity.",
              responsibilities: ["Contribute to the role described in this opportunity."],
              requirements: "Relevant experience for this role.",
              createdAt: new Date().toISOString(),
              publishedAt: new Date().toISOString(),
              likes: 0,
              art: "cobalt",
              companyDisplayName: company.name,
              thumbnail: { template: "none", image: "", alt: "", headline: "" },
              jobMedia: { video: "", files: [] },
            });
          }
        } else if (p.linkedJobId) {
          const hasApps = db.social.applications.some((a) => a.job === p.linkedJobId);
          const job = db.social.jobs.find((j) => j.id === p.linkedJobId);
          if (hasApps || (job && isJobOpen(job))) throw new Error("This post still has an open job or applications, so the quick job cannot be removed.");
          p.linkedJobId = undefined;
        }
      } else if (p.linkedJobId) {
        const job = db.social.jobs.find((j) => j.id === p.linkedJobId);
        if (job) job.description = input.body.trim() || job.description;
      }
      p.editedAt = new Date().toISOString();
    });
    return found;
  },

  async deletePost(role, id) {
    commit((db) => {
      const owner = identityId(role);
      db.social.posts = db.social.posts.filter((p) => !(p.id === id && p.owner === owner));
      if (role === "professional") {
        delete db.social.comments[id];
        db.social.liked = db.social.liked.filter((x) => x !== id);
        db.social.saved = db.social.saved.filter((x) => x !== id);
      }
    });
  },
};

export type { RawItem };
export { professionalItems, recruiterItems };
