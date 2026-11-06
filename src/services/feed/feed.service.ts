import type { CompanySummary, Paginated, PersonSummary } from "@/types/api";
import type { Id, IsoDateTime, JobMedia, JobThumbnail, MediaItem, Role, Visibility } from "@/types/domain";
import type { ProjectSummary } from "@/mocks/store/presenters";
import type { LinkPreview } from "@/lib/validation/link-preview";
import type { ActivityCalendarMonth } from "@/lib/activity/activity-calendar";
import type { ReadScope } from "../realtime/realtime.http";

export type FeedFilter = "all" | "following" | "jobs" | "saved" | "reposts";
export type FeedSort = "recent" | "popular" | "recommended";

export interface FeedQuery {
  role: Role;
  filter: FeedFilter;
  sort: FeedSort;
  q: string;
  limit: number;
  cursor?: string;
}

export interface FeedComment {
  id: Id;
  text: string;
  createdAt: IsoDateTime;
  author: PersonSummary;
  parentId?: Id | null;
  version?: number;
  own?: boolean;
  pinned?: boolean;
  canPin?: boolean;
  canDelete?: boolean;
  following?: boolean;
  canMessage?: boolean;
  canBlock?: boolean;
  canReport?: boolean;
}

export interface FeedJobInfo {
  open?: boolean;
  location: string;
  arrangement: string;
  employment: string;
  salary: string;
  hideSalary: boolean;
  art: string;
  thumbnail?: JobThumbnail;
  jobMedia?: JobMedia;
  /** The viewing recruiter's own company posted this job. */
  ownedByViewer: boolean;
  /** The viewing professional has a saved demo application for it. */
  applied: boolean;
}

/**
 * One item in the feed. Ranking metadata from the future recommendation service is intentionally
 * not exposed; the client only receives display data and the viewer's interaction state.
 */
export interface FeedEntry {
  analyticsContext?:{requestId:string;itemId:string;position:number};
  recommendationReason?:string;
  commentsNextCursor?: string | null;
  version?: number;
  id: Id;
  type: "post" | "job" | "update";
  ownerId: Id;
  title: string;
  body: string;
  kind: string;
  createdAt: IsoDateTime;
  skills: string[];
  media: "" | "brand" | "code";
  image: string;
  imageAlt?: string;
  video?: string;
  attachments?: MediaItem[];
  visibility?: Visibility;
  project?: ProjectSummary;
  author?: PersonSummary;
  company?: CompanySummary;
  job?: FeedJobInfo;
  /** Present when a recruiter quick-job post links a real hiring job for Apply. */
  linkedJob?: {
    id: Id;
    title: string;
    location: string;
    arrangement: string;
    employment: string;
    ownedByViewer: boolean;
    applied: boolean;
    open: boolean;
  };
  likes: number;
  commentCount: number;
  comments: FeedComment[];
  /** False when the author disabled comments on this post. */
  commentsEnabled: boolean;
  /** Carousel frame ratio chosen when publishing ("original", "1:1", "4:5", "3:4", "1.91:1"); null/absent = per-slide frame. */
  mediaAspect?: string | null;
  /** Repost entries: who reposted, when, their optional commentary, the reposted repost and the chain to the original. Originals carry null. */
  repost?: (RepostSummary & { parentId?: Id | null; chain?: RepostSummary[] }) | null;
  /** Repost entries: the original entry's id. */
  rootId?: Id;
  /** Repost entries: where likes and comments attach (the original for a plain repost; the repost itself when it carries commentary). */
  interactionId?: Id;
  /** Stored server metadata for a link in the body; absent for legacy or dismissed previews. */
  linkPreview?: LinkPreview;
  viewer: { liked: boolean; saved: boolean; following: boolean; own: boolean; reposted?: boolean; canRepost?: boolean };
}

/** One person's repost. `removed` marks a soft-deleted repost kept as a tombstone in a chain. */
export interface RepostSummary {
  id: Id;
  author: PersonSummary | null;
  createdAt: IsoDateTime;
  commentary: string | null;
  removed: boolean;
}

export interface RepostListItem {
  id: Id;
  author: PersonSummary;
  createdAt: IsoDateTime;
  commentary: string | null;
  own: boolean;
}

export interface FeedPage extends Paginated<FeedEntry> {
  /** Suggested people to follow (professional "For you" feed only). */
  suggestions: PersonSummary[];
  nextCursor: string | null;
}

export interface NetworkPerson extends PersonSummary {
  following: boolean;
}

/** Followers who received the entry link and those who could not (blocked or unavailable). */
export interface PostShareResult {
  shared: Id[];
  failed: Id[];
}

export interface Network {
  following: NetworkPerson[];
  companies: CompanySummary[];
  followers: NetworkPerson[];
}

export interface NewPostInput {
  editorToken?: string;
  creationKey?: string;
  draftId?: string;
  draftVersion?: number;
  title: string;
  body: string;
  project: Id | "";
  attachments: MediaItem[];
  /** Raw link from the body whose server preview should be shown; empty for none. */
  previewUrl?: string;
  commentsEnabled?: boolean;
  mediaAspect?: string | null;
  quickJob?: import("@/types/domain").QuickJobPost;
}

export interface FeedService {
  searchPeople(role: Role, q: string, limit: number): Promise<{ items: PersonSummary[]; total: number; nextCursor: string | null }>;
  getComments?(role: Role, id: Id, limit: number, focus?: Id, scope?: ReadScope): Promise<{items: FeedComment[]; nextCursor: string | null}>;
  getFeed(query: FeedQuery, scope?: ReadScope): Promise<FeedPage>;
  refreshEntries?(query: FeedQuery, ids: string[], scope?: ReadScope): Promise<FeedEntry[]>;
  getEntry(role: Role, id: Id, scope?: ReadScope): Promise<FeedEntry | null>;
  toggleLike(role: Role, id: Id, enabled?: boolean): Promise<boolean>;
  setReposted(role: Role, id: Id, enabled: boolean): Promise<boolean>;
  /** Independent repost of the original behind `id` (any id in a chain), optionally with commentary; idempotent per person and original. */
  createRepost(role: Role, id: Id, commentary: string | null): Promise<{ id: Id; rootId: Id }>;
  /** Remove only the viewer's own repost of the original behind `id`. */
  removeRepost(role: Role, id: Id): Promise<boolean>;
  /** People who reposted the original behind `id` (one per person, nested reposts counted once). */
  listReposts(role: Role, id: Id): Promise<{ items: RepostListItem[]; total: number }>;
  toggleSave(role: Role, id: Id, enabled?: boolean): Promise<{ saved: boolean; persisted: boolean }>;
  /** "Not interested": hide a job, post or update from recommendations and the main feeds, or undo it. */
  setHidden(role: Role, id: Id, type: FeedEntry["type"], hidden: boolean): Promise<boolean>;
  toggleFollow(role: Role, personId: Id, enabled?: boolean): Promise<boolean>;
  toggleFollowCompany(role: Role, companyId: Id, enabled?: boolean): Promise<boolean>;
  addComment(role: Role, postId: Id, text: string, parentId?: Id): Promise<void>;
  editComment(postId: Id, commentId: Id, text: string, version?: number): Promise<boolean>;
  deleteComment(role: Role, postId: Id, commentId: Id, version?: number): Promise<void>;
  pinComment(role: Role, postId: Id, commentId: Id, enabled: boolean): Promise<void>;
  blockCommentAuthor(role: Role, postId: Id, commentId: Id): Promise<void>;
  /** Block a public person or recruiter (same id as follow). */
  blockPerson(role: Role, personId: Id): Promise<void>;
  /** Block a public organization (same id as company follow). */
  blockOrganization(role: Role, organizationId: Id): Promise<void>;
  reportComment(role: Role, commentId: Id, reason: string, details: string): Promise<void>;
  /** Report a public person or recruiter profile (same id as follow). */
  reportPerson(role: Role, personId: Id, reason: string, details: string): Promise<void>;
  /** Report a public organization profile (same id as company follow). */
  reportOrganization(role: Role, organizationId: Id, reason: string, details: string): Promise<void>;
  getBlocked(role: Role): Promise<{identityId: Id; person: PersonSummary}[]>;
  unblock(role: Role, identityId: Id): Promise<void>;
  getBlockedOrganizations(role: Role): Promise<{organizationId: Id; company: CompanySummary}[]>;
  unblockOrganization(role: Role, organizationId: Id): Promise<void>;
  getNetwork(role: Role, scope?: ReadScope): Promise<Network>;
  /** Sends the entry link to selected current followers as a direct message from the selected identity. */
  shareWithFollowers(role: Role, id: Id, recipientIds: Id[]): Promise<PostShareResult>;
  createPost(role: Role, input: NewPostInput): Promise<{ id: Id } | null>;
  updatePost(role: Role, id: Id, input: {
    title: string;
    body: string;
    version?: number;
    previewUrl?: string;
    project?: Id | "";
    attachments?: MediaItem[];
    commentsEnabled?: boolean;
    mediaAspect?: string | null;
    quickJob?: import("@/types/domain").QuickJobPost;
  }): Promise<boolean>;
  /** Server-fetched metadata for a public link, or null when the page offers none. */
  getLinkPreview(role: Role, url: string, signal?: AbortSignal): Promise<LinkPreview | null>;
  /** One month of the selected identity's qualifying activity, a record per date. */
  getActivityCalendar(role: Role, year: number, month: number): Promise<ActivityCalendarMonth>;
  deletePost(role: Role, id: Id, version?: number): Promise<void>;
}
