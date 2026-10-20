import type { Comment } from "@/types/domain";
import type { FeedEntry } from "@/services/feed/feed.service";

export const ACTIVITY_SECTIONS = { posts: "Posts", comments: "Comments", videos: "Videos", images: "Images", reactions: "Reactions" } as const;
export type ActivitySection = keyof typeof ACTIVITY_SECTIONS;

export interface CommentGroup {
  post: FeedEntry;
  comments: Comment[];
}

export interface ActivityData {
  posts: FeedEntry[];
  images: FeedEntry[];
  videos: FeedEntry[];
  /** Grouped by post, newest comment first (professional) or as a flat list of posts (recruiter). */
  comments: CommentGroup[];
  /** Total own comments (professional counts comments, recruiter counts posts). */
  commentCount: number;
  reactions: FeedEntry[];
}

export interface ActivityService {
  getProfessionalActivity(): Promise<ActivityData>;
  getRecruiterActivity(): Promise<ActivityData>;
}
