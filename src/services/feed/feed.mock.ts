import type { Draft } from "immer";
import { paginate } from "@/types/api";
import type { DemoDatabase, Id, Job, Post, Role, SocialGraph, WorkUpdate } from "@/types/domain";
import { commit, getDb } from "@/mocks/store/demo-db";
import { companySummary, feedPerson, jobCompany, personSummary, projectSummary } from "@/mocks/store/presenters";
import { currentRecruiter, homeCompany, isJobOpen, ME_ID, person, RECRUITER_ID, socialFor } from "@/mocks/store/selectors";
import { uid } from "@/lib/utils/id";
import type { FeedEntry, FeedQuery, FeedService, Network } from "./feed.service";
import { reportSchema } from "@/lib/validation/communication";
import { peopleSearchSchema } from "@/lib/validation/social";
import { activityCalendarContract, activityLevel, currentPeriod, daysInMonth, isoDate, periodKey, type ActivityType } from "@/lib/activity/activity-calendar";

type RawItem = (Post & { type: "post" }) | (Job & { type: "job"; owner?: undefined }) | (WorkUpdate & { type: "update"; body: string; createdAt: string; likes: number; kind: string; media: ""; image: "" });

const skillsOf = (i: RawItem): string[] => ("skills" in i ? i.skills ?? [] : []);
const bodyOf = (i: RawItem) => (i.type === "job" ? "" : i.body);

const identityId = (role: Role) => (role === "recruiter" ? RECRUITER_ID : ME_ID);

export function blockedInMock(db: DemoDatabase, role: Role, author: Id) {
  const me = identityId(role);
  return !!socialFor(db, role).blocked?.includes(author) || author === ME_ID && !!db.social.blocked?.includes(me) || author === RECRUITER_ID && !!db.recruiterSocial.blocked?.includes(me);
}

function sourceVisible(db: DemoDatabase, role: Role, item: RawItem) {
  return item.type === "job" || item.owner === identityId(role) || !blockedInMock(db, role, item.owner) && item.visibility !== "Private" && (item.owner === RECRUITER_ID || person(db, item.owner).public);
}

function networkRepost(db: DemoDatabase, role: Role, id: Id, preferOwn = true) {
  const viewer = identityId(role), following = socialFor(db, role).following;
  const actors: [Id, SocialGraph][] = [[ME_ID, db.social], [RECRUITER_ID, db.recruiterSocial]];
  const reposts = actors.flatMap(([actor, graph]) => {
    const createdAt = graph.repostDates?.[id];
    if (!createdAt || actor !== viewer && (!following.includes(actor) || actor === ME_ID && !person(db, actor).public)) return [];
    return [{ author: feedPerson(db, actor), createdAt }];
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.author.id.localeCompare(a.author.id));
  return (preferOwn ? reposts.find(repost => repost.author.id === viewer) : undefined) ?? reposts[0] ?? null;
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
    repost: networkRepost(db, role, item.id),
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
  return {
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
    viewer: { liked: s.liked.includes(item.id), saved: s.saved.includes(item.id), following: s.following.includes(item.owner), own: item.owner === viewerId, reposted: !!s.repostDates?.[item.id], canRepost: item.owner === viewerId || item.visibility !== "Private" },
  };
}

function filterItems(db: DemoDatabase, query: FeedQuery) {
  const s = socialFor(db, query.role);
  let list: RawItem[];
  if (query.role === "professional") {
    list = professionalItems(db);
    if (query.filter !== "saved") list = list.filter((p) => p.type === "job" || p.owner === ME_ID || !!networkRepost(db, query.role, p.id) || p.owner === RECRUITER_ID || (s.following.includes(p.owner) && person(db, p.owner).public));
    if (query.filter === "following") list = list.filter((p) => !!networkRepost(db, query.role, p.id) || (p.type === "job" ? s.followingCompanies.includes(p.company) : s.following.includes(p.owner)));
    if (query.filter === "jobs") list = list.filter((p) => p.type === "job");
  } else {
    list = recruiterItems(db);
    if (query.filter === "following") list = list.filter((p) => !!networkRepost(db, query.role, p.id) || (p.type === "job" ? s.followingCompanies.includes(p.company) : s.following.includes(p.owner)));
    if (query.filter === "jobs") list = list.filter((p) => p.type === "job" && p.company === homeCompany(db).id);
  }
  list = list.filter(item => sourceVisible(db, query.role, item));
  if (query.filter === "reposts") list = list.filter(item => !!s.repostDates?.[item.id]);
  if (query.filter === "saved") list = list.filter((p) => s.saved.includes(p.id));
  const q = query.q.trim().toLowerCase();
  if (q) list = list.filter((p) => searchText(db, query.role, p).includes(q));
  const score = (p: RawItem) => (p.likes || 0) + Number(s.liked.includes(p.id));
  if (query.sort === "popular") list.sort((a, b) => score(b) - score(a));
  else {
    const time = (item: RawItem) => [item.createdAt, networkRepost(db, query.role, item.id, false)?.createdAt ?? ""].sort().at(-1)!;
    list.sort((a, b) => time(b).localeCompare(time(a)) || b.id.localeCompare(a.id));
  }
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
    const page = paginate(list.map((item) => toFeedEntry(db, query.role, item)), 1, query.limit);
    const s = socialFor(db, query.role);
    const suggestions = query.role === "professional" ? db.professionals.filter((p) => p.id !== ME_ID && p.public && !blockedInMock(db, query.role, p.id) && !s.following.includes(p.id)).slice(0, 3).map(p => personSummary(p, db)) : [];
    return { ...page, suggestions };
  },

  async getEntry(role, id) {
    const db = getDb();
    const item = (role === "professional" ? professionalItems(db) : recruiterItems(db)).find((p) => p.id === id && sourceVisible(db, role, p));
    return item ? toFeedEntry(db, role, item) : null;
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
    const entry = await mockFeedService.getEntry(role, id);
    if (!entry || enabled && !entry.viewer.canRepost) throw new Error("This post is not available for reposting.");
    const persisted = commit((db) => {
      const dates = graph(db, role).repostDates ??= {};
      if (enabled) dates[id] ??= new Date().toISOString();
      else delete dates[id];
    }, { rollbackOnFailure: true });
    if (!persisted) throw new Error("Your repost could not be saved. Please try again.");
    return enabled;
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

  async toggleFollowCompany(role, companyId) {
    let following = false;
    commit((db) => {
      following = toggleIn(graph(db, role).followingCompanies, companyId);
    });
    return following;
  },

  async addComment(role, postId, text, parentId) {
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
  async reportComment(role, commentId, reason, details) {
    const value = reportSchema.parse({reason, details});
    const postId = Object.keys(getDb().social.comments).find(id => getDb().social.comments[id].some(c => c.id === commentId));
    const comment = postId && (await mockFeedService.getEntry(role, postId))?.comments.find(c => c.id === commentId);
    if (!comment || !comment.canReport) throw new Error("This comment cannot be reported.");
    commit(db => { (graph(db, role).commentReports ??= []).push({commentId, ...value, createdAt: new Date().toISOString()}); });
  },
  async getBlocked(role) { return (socialFor(getDb(), role).blocked ?? []).map(id => ({ identityId: id, person: feedPerson(getDb(), id) })); },
  async unblock(role, id) { commit(db => { const s = graph(db, role); s.blocked = (s.blocked ?? []).filter(target => target !== id); }); },

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

  async createPost(role, input) {
    const id = uid();
    const image = input.attachments.find((m) => m.type === "image");
    const video = input.attachments.find((m) => m.type === "video");
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
    };
    const ok = commit(
      (db) => {
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
