import type { Id, Project, Shortlist, WorkUpdate } from "@/types/domain";
import type { ProjectSummary } from "@/mocks/store/presenters";
import type { PublicProfessional } from "./public-profile";

export interface TalentFilters {
  q: string;
  category: string;
  skill: string;
  location: string;
  years: "" | "0-4" | "5-7" | "8+";
  availability: "" | "available" | "Remote" | "Hybrid";
  completeness: boolean;
  recent: boolean;
  sort: "relevance" | "recent" | "experience";
}

export interface TalentCardData extends PublicProfessional {
  featuredProject?: ProjectSummary;
  saved: boolean;
  recentDays: number[];
}

export interface CandidateView {
  person: PublicProfessional;
  projects: Project[];
  updates: WorkUpdate[];
  portfolioSlug: string;
  saved: boolean;
}

export interface ShortlistView extends Shortlist {
  people: TalentCardData[];
}

export interface ComparisonPerson extends PublicProfessional {
  featuredWork: { id: Id; title: string }[];
  portfolioSlug: string;
  publicUpdates: number;
}

export interface RecruiterOverview {
  talentCount: number;
  savedCandidates: number;
  shortlists: Shortlist[];
  conversationCount: number;
  recentTalent: TalentCardData[];
  conversations: { id: Id; person: PublicProfessional; lastMessage: string }[];
}

export interface TalentService {
  search(filters: TalentFilters): Promise<TalentCardData[]>;
  getFilterOptions(): Promise<{ locations: string[]; skills: string[] }>;
  getCandidate(id: Id): Promise<CandidateView | null>;
  getCandidateBySlug(slug: string): Promise<CandidateView | null>;
  listShortlists(): Promise<ShortlistView[]>;
  createShortlist(name: string): Promise<Id>;
  renameShortlist(id: Id, name: string): Promise<void>;
  deleteShortlist(id: Id): Promise<void>;
  removeFromShortlist(shortlistId: Id, candidateId: Id): Promise<boolean>;
  setCandidateShortlists(candidateId: Id, shortlistIds: Id[]): Promise<boolean>;
  compare(ids: Id[]): Promise<ComparisonPerson[]>;
  listPublicPeople(): Promise<PublicProfessional[]>;
  getOverview(): Promise<RecruiterOverview>;
}

export const EMPTY_TALENT_FILTERS: TalentFilters = { q: "", category: "", skill: "", location: "", years: "", availability: "", completeness: false, recent: false, sort: "relevance" };
