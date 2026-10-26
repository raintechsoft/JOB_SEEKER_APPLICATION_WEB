import type { Comment } from "@/types/domain";
import { getDb } from "@/mocks/store/demo-db";
import { homeCompany, ME_ID, person, RECRUITER_ID } from "@/mocks/store/selectors";
import { recruiterItems, toFeedEntry, type RawItem } from "@/services/feed/feed.mock";
import type { ActivityService, CommentGroup } from "./activity.service";

const isVideo = (p: RawItem) => p.type === "post" && (!!p.video || !!p.attachments?.some((m) => m.type === "video"));
const isImage = (p: RawItem) => p.type !== "job" && (!!p.image || ["brand", "code"].includes(p.media) || (p.type === "post" && !!p.attachments?.some((m) => m.type === "image")));

export const mockActivityService: ActivityService = {
  async getProfessionalActivity() {
    const db = getDb();
    const all: RawItem[] = [
      ...db.social.jobs.map((j): RawItem => ({ ...j, type: "job" })),
      ...db.social.posts.map((p): RawItem => ({ ...p, type: "post" })),
      ...db.updates.map((u): RawItem => ({ ...u, body: u.description, type: "update", createdAt: u.date + "T09:00:00", likes: 0, kind: "Work update", media: "", image: "" })),
    ].filter((p) => p.type === "job" || p.owner === ME_ID || (p.visibility !== "Private" && person(db, p.owner).public));
    const entry = (p: RawItem) => toFeedEntry(db, "professional", p);
    const own = all.filter((p) => p.type !== "job" && (p.owner === ME_ID || !!db.social.repostDates?.[p.id])).sort((a, b) => (db.social.repostDates?.[b.id] || b.createdAt).localeCompare(db.social.repostDates?.[a.id] || a.createdAt));
    const byId = new Map(all.map((p) => [p.id, p]));
    const flat = Object.entries(db.social.comments)
      .flatMap(([id, list]) => list.filter((c) => c.owner === ME_ID).map((comment) => ({ comment, post: byId.get(id) })))
      .filter((r): r is { comment: Comment; post: RawItem } => !!r.post)
      .sort((a, b) => b.comment.createdAt.localeCompare(a.comment.createdAt));
    const groups = new Map<string, CommentGroup>();
    for (const { post, comment } of flat) {
      if (!groups.has(post.id)) groups.set(post.id, { post: entry(post), comments: [] });
      groups.get(post.id)!.comments.push(comment);
    }
    const dates = db.social.reactionDates;
    const reactions = db.social.liked
      .map((id) => byId.get(id))
      .filter((p): p is RawItem => !!p)
      .sort((a, b) => (dates[b.id] || b.createdAt).localeCompare(dates[a.id] || a.createdAt));
    return { posts: own.map(entry), images: own.filter(isImage).map(entry), videos: own.filter(isVideo).map(entry), comments: [...groups.values()], commentCount: flat.length, reactions: reactions.map(entry) };
  },

  async getRecruiterActivity() {
    const db = getDb();
    const s = db.recruiterSocial;
    const all = recruiterItems(db);
    const entry = (p: RawItem) => toFeedEntry(db, "recruiter", p);
    const own = all.filter((p) => (p.type === "job" ? p.company === homeCompany(db).id : p.owner === RECRUITER_ID) || !!s.repostDates?.[p.id]);
    const commented = all.filter((p) => (db.social.comments[p.id] || []).some((c) => c.owner === RECRUITER_ID));
    return {
      posts: own.map(entry),
      videos: own.filter((p) => p.type === "post" && !!p.video).map(entry),
      images: own.filter((p) => p.type !== "job" && !!p.image).map(entry),
      comments: commented.map((p) => ({ post: entry(p), comments: (db.social.comments[p.id] || []).filter((c) => c.owner === RECRUITER_ID) })),
      commentCount: commented.length,
      reactions: all.filter((p) => s.liked.includes(p.id)).map(entry),
    };
  },
};
