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
  analyticsContext?:{requestId:string;itemId:string;position:number};
  recommendationReason?:string;
  featuredProject?: ProjectSummary;
  saved: boolean;
  recentDays: number[];
}

/** The fields a talent discovery card shows; the full public view stays on the profile page. */
export interface TalentSuggestion {
  id: Id;
  slug: string;
  name: string;
  headline: string;
  location: string;
  years: number;
  available: boolean;
  color: string;
  picture?: string;
  cover?: string;
  saved: boolean;
  /** Whether the recruiter follows this person; absent where the list does not report it. */
  following?: boolean;
  reason?: string;
  recommendationReason?: string;
  analyticsContext?: { requestId: string; itemId: string; position: number };
}

export type DiscoverySectionKey = "jobMatches" | "peopleYouMayKnow" | "interests" | "suggestions" | "skills";
/** Job seeker people discovery rows. */
export type PeopleSectionKey = "peopleYouMayKnow" | "skills" | "suggestions";
export interface DiscoverySection {
  key: DiscoverySectionKey;
  title: string;
  subtitle: string;
  job: { id: Id; title: string } | null;
  items: TalentSuggestion[];
}
export interface TalentInterests { skills: string[]; version: number }
export interface TalentDiscovery { sections: DiscoverySection[]; interests: TalentInterests }

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
  conversations: { id: Id; person: import("@/types/api").PersonSummary; lastMessage: string }[];
}

export interface TalentService {
  shareShortlist?(id:Id,input:{visibility:"private"|"organization";version?:number}):Promise<void>;
  search(filters: TalentFilters): Promise<TalentCardData[]>;
  getFilterOptions(): Promise<{ locations: string[]; skills: string[] }>;
  getCandidate(id: Id): Promise<CandidateView | null>;
  getCandidateBySlug(slug: string): Promise<CandidateView | null>;
  listShortlists(): Promise<ShortlistView[]>;
  createShortlist(name: string): Promise<Id>;
  renameShortlist(id: Id, name: string, version?:number): Promise<void>;
  deleteShortlist(id: Id): Promise<void>;
  removeFromShortlist(shortlistId: Id, candidateId: Id): Promise<boolean>;
  setCandidateShortlists(candidateId: Id, shortlistIds: Id[], versions?:Record<string,number>): Promise<boolean>;
  compare(ids: Id[]): Promise<ComparisonPerson[]>;
  listPublicPeople(): Promise<PublicProfessional[]>;
  getRecommendedTalent(): Promise<TalentCardData[]>;
  getOverview(): Promise<RecruiterOverview>;
  /** Recruiter discovery rows, or one full row for "See all" (job matches also need the job id). */
  getDiscovery(section?: DiscoverySectionKey, jobId?: Id): Promise<TalentDiscovery>;
  saveInterests(skills: string[], version: number): Promise<TalentInterests>;
  /** Job seeker people discovery rows, or one full row for "See all". */
  getPeopleDiscovery(section?: PeopleSectionKey): Promise<TalentDiscovery>;
}

export const EMPTY_TALENT_FILTERS: TalentFilters = { q: "", category: "", skill: "", location: "", years: "", availability: "", completeness: false, recent: false, sort: "relevance" };
