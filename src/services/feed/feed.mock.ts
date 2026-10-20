import type { Draft } from "immer";
import { paginate } from "@/types/api";
import type { DemoDatabase, Id, Job, Post, Role, SocialGraph, WorkUpdate } from "@/types/domain";
import { commit, getDb } from "@/mocks/store/demo-db";
import { companySummary, feedPerson, jobCompany, personSummary, projectSummary } from "@/mocks/store/presenters";
import { homeCompany, isJobOpen, ME_ID, person, RECRUITER_ID, socialFor } from "@/mocks/store/selectors";
import { uid } from "@/lib/utils/id";
import type { FeedEntry, FeedQuery, FeedService, Network } from "./feed.service";

type RawItem = (Post & { type: "post" }) | (Job & { type: "job"; owner?: undefined }) | (WorkUpdate & { type: "update"; body: string; createdAt: string; likes: number; kind: string; media: ""; image: "" });

const skillsOf = (i: RawItem): string[] => ("skills" in i ? i.skills ?? [] : []);
const bodyOf = (i: RawItem) => (i.type === "job" ? "" : i.body);

const identityId = (role: Role) => (role === "recruiter" ? RECRUITER_ID : ME_ID);

const updateAsItem = (u: WorkUpdate): RawItem => ({ ...u, body: u.description, type: "update", createdAt: u.date + "T09:00:00", likes: 0, kind: "Work update", media: "", image: "" });

function professionalItems(db: DemoDatabase): RawItem[] {
  return [
    ...db.social.jobs.filter(isJobOpen).map((j): RawItem => ({ ...j, type: "job" })),
    ...db.social.posts.map((p): RawItem => ({ ...p, type: "post" })),
    ...db.updates.filter((u) => u.visibility === "Public").map(updateAsItem),
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
  const comments = (db.social.comments[item.id] || []).map((c) => ({ id: c.id, text: c.text, createdAt: c.createdAt, author: feedPerson(db, c.owner) }));
  const projectId = item.type === "job" ? "" : item.project;
  const project = projectId ? db.projects.find((p) => p.id === projectId) : undefined;
  const base = {
    id: item.id,
    createdAt: item.createdAt,
    title: item.title,
    skills: skillsOf(item),
    likes: item.likes ?? 0,
    comments,
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
      viewer: { liked: s.liked.includes(item.id), saved: s.saved.includes(item.id), following: s.followingCompanies.includes(company.id), own: ownedByViewer },
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
    viewer: { liked: s.liked.includes(item.id), saved: s.saved.includes(item.id), following: s.following.includes(item.owner), own: item.owner === viewerId },
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
  if (query.filter === "saved") list = list.filter((p) => s.saved.includes(p.id));
  const q = query.q.trim().toLowerCase();
  if (q) list = list.filter((p) => searchText(db, query.role, p).includes(q));
  const score = (p: RawItem) => (p.likes || 0) + Number(s.liked.includes(p.id));
  if (query.sort === "popular") list.sort((a, b) => score(b) - score(a));
  else if (query.role === "professional") list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
  async getFeed(query) {
    const db = getDb();
    const list = filterItems(db, query);
    const page = paginate(list.map((item) => toFeedEntry(db, query.role, item)), 1, query.limit);
    const s = socialFor(db, query.role);
    const suggestions = query.role === "professional" ? db.professionals.filter((p) => p.id !== ME_ID && p.public && !s.following.includes(p.id)).slice(0, 3).map(personSummary) : [];
    return { ...page, suggestions };
  },

  async getEntry(role, id) {
    const db = getDb();
    const item = (role === "professional" ? professionalItems(db) : recruiterItems(db)).find((p) => p.id === id);
    return item ? toFeedEntry(db, role, item) : null;
  },

  async toggleLike(role, id) {
    let liked = false;
    commit((db) => {
      const s = graph(db, role);
      liked = toggleIn(s.liked, id);
      if (liked) s.reactionDates[id] = new Date().toISOString();
      else delete s.reactionDates[id];
    });
    return liked;
  },

  async toggleSave(role, id) {
    let saved = false;
    const persisted = commit((db) => {
      saved = toggleIn(graph(db, role).saved, id);
    });
    return { saved, persisted };
  },

  async toggleFollow(role, personId) {
    let following = false;
    commit((db) => {
      following = toggleIn(graph(db, role).following, personId);
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

  async addComment(role, postId, text) {
    commit((db) => {
      (db.social.comments[postId] ??= []).push({ id: uid(), owner: identityId(role), text, createdAt: new Date().toISOString() });
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
    commit((db) => {
      db.social.comments[postId] = (db.social.comments[postId] || []).filter((c) => !(c.id === commentId && c.owner === identityId(role)));
    });
  },

  async getNetwork(role): Promise<Network> {
    const db = getDb();
    const s = socialFor(db, role);
    const self = identityId(role);
    const people = db.professionals.filter((p) => p.id !== self && p.public);
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
