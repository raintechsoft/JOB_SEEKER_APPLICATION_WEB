import type { CompanySummary, Paginated, PersonSummary } from "@/types/api";
import type { Id, IsoDateTime, JobMedia, JobThumbnail, MediaItem, Role, Visibility } from "@/types/domain";
import type { ProjectSummary } from "@/mocks/store/presenters";
import type { LinkPreview } from "@/lib/validation/link-preview";
import type { ActivityCalendarMonth } from "@/lib/activity/activity-calendar";

export type FeedFilter = "all" | "following" | "jobs" | "saved" | "reposts";
export type FeedSort = "recent" | "popular" | "recommended";

export interface FeedQuery {
  role: Role;
  filter: FeedFilter;
  sort: FeedSort;
  q: string;
  limit: number;
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
  likes: number;
  commentCount: number;
  comments: FeedComment[];
  repost?: { author: PersonSummary; createdAt: IsoDateTime } | null;
  /** Stored server metadata for a link in the body; absent for legacy or dismissed previews. */
  linkPreview?: LinkPreview;
  viewer: { liked: boolean; saved: boolean; following: boolean; own: boolean; reposted?: boolean; canRepost?: boolean };
}

export interface FeedPage extends Paginated<FeedEntry> {
  /** Suggested people to follow (professional "For you" feed only). */
  suggestions: PersonSummary[];
}

export interface NetworkPerson extends PersonSummary {
  following: boolean;
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
}

export interface FeedService {
  searchPeople(role: Role, q: string, limit: number): Promise<{ items: PersonSummary[]; total: number; nextCursor: string | null }>;
  getComments?(role: Role, id: Id, limit: number, focus?: Id): Promise<{items: FeedComment[]; nextCursor: string | null}>;
  getFeed(query: FeedQuery): Promise<FeedPage>;
  getEntry(role: Role, id: Id): Promise<FeedEntry | null>;
  toggleLike(role: Role, id: Id, enabled?: boolean): Promise<boolean>;
  setReposted(role: Role, id: Id, enabled: boolean): Promise<boolean>;
  toggleSave(role: Role, id: Id): Promise<{ saved: boolean; persisted: boolean }>;
  toggleFollow(role: Role, personId: Id, enabled?: boolean): Promise<boolean>;
  toggleFollowCompany(role: Role, companyId: Id): Promise<boolean>;
  addComment(role: Role, postId: Id, text: string, parentId?: Id): Promise<void>;
  editComment(postId: Id, commentId: Id, text: string, version?: number): Promise<boolean>;
  deleteComment(role: Role, postId: Id, commentId: Id, version?: number): Promise<void>;
  pinComment(role: Role, postId: Id, commentId: Id, enabled: boolean): Promise<void>;
  blockCommentAuthor(role: Role, postId: Id, commentId: Id): Promise<void>;
  reportComment(role: Role, commentId: Id, reason: string, details: string): Promise<void>;
  getBlocked(role: Role): Promise<{identityId: Id; person: PersonSummary}[]>;
  unblock(role: Role, identityId: Id): Promise<void>;
  getNetwork(role: Role): Promise<Network>;
  createPost(role: Role, input: NewPostInput): Promise<{ id: Id } | null>;
  updatePost(role: Role, id: Id, input: { title: string; body: string; version?: number; previewUrl?: string }): Promise<boolean>;
  /** Server-fetched metadata for a public link, or null when the page offers none. */
  getLinkPreview(role: Role, url: string, signal?: AbortSignal): Promise<LinkPreview | null>;
  /** One month of the selected identity's qualifying activity, a record per date. */
  getActivityCalendar(role: Role, year: number, month: number): Promise<ActivityCalendarMonth>;
  deletePost(role: Role, id: Id, version?: number): Promise<void>;
}
