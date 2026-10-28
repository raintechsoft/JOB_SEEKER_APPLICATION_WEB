/**
 * Shared API contract shapes. Service interfaces in `src/services/**` return these so that a
 * future HTTP implementation can be dropped in without changing the UI.
 */
import type { Id } from "./domain";

export interface PageRequest {
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

/** Common search request used for jobs, candidates, companies and posts. */
export interface SearchRequest<TFilters = Record<string, string | string[] | undefined>> extends PageRequest {
  q?: string;
  filters?: TFilters;
  sort?: string;
}

export function paginate<T>(list: T[], page = 1, pageSize = list.length || 1): Paginated<T> {
  const size = Math.max(1, pageSize);
  const pages = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(pages, Math.max(1, page));
  return { items: list.slice((current - 1) * size, current * size), total: list.length, page: current, pageSize: size, pages };
}

/** Minimal identity used for avatars and bylines. */
export interface PersonSummary {
  recruiter?: boolean;
  id: Id;
  name: string;
  headline?: string;
  picture?: string;
  color?: string;
  slug?: string;
  followerCount?: number;
  /** Profile cover image; present only for professionals in the public directory. */
  cover?: string;
}

/** Company as displayed on jobs (may be confidential). */
export interface CompanySummary {
  id: Id;
  name: string;
  industry?: string;
  logoUrl?: string;
  confidential?: boolean;
  slug?: string;
  description?: string;
  companySize?: string;
  followerCount?: number;
}
