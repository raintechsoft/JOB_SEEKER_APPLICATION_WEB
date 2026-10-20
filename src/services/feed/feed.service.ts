import type { CompanySummary, Paginated, PersonSummary } from "@/types/api";
import type { Id, IsoDateTime, JobMedia, JobThumbnail, MediaItem, Role, Visibility } from "@/types/domain";
import type { ProjectSummary } from "@/mocks/store/presenters";

export type FeedFilter = "all" | "following" | "jobs" | "saved";
export type FeedSort = "recent" | "popular";

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
}

export interface FeedJobInfo {
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
  comments: FeedComment[];
  viewer: { liked: boolean; saved: boolean; following: boolean; own: boolean };
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
  title: string;
  body: string;
  project: Id | "";
  attachments: MediaItem[];
}

export interface FeedService {
  getFeed(query: FeedQuery): Promise<FeedPage>;
  getEntry(role: Role, id: Id): Promise<FeedEntry | null>;
  toggleLike(role: Role, id: Id): Promise<boolean>;
  toggleSave(role: Role, id: Id): Promise<{ saved: boolean; persisted: boolean }>;
  toggleFollow(role: Role, personId: Id): Promise<boolean>;
  toggleFollowCompany(role: Role, companyId: Id): Promise<boolean>;
  addComment(role: Role, postId: Id, text: string): Promise<void>;
  editComment(postId: Id, commentId: Id, text: string): Promise<boolean>;
  deleteComment(role: Role, postId: Id, commentId: Id): Promise<void>;
  getNetwork(role: Role): Promise<Network>;
  createPost(role: Role, input: NewPostInput): Promise<{ id: Id } | null>;
  updatePost(role: Role, id: Id, input: { title: string; body: string }): Promise<boolean>;
  deletePost(role: Role, id: Id): Promise<void>;
}
