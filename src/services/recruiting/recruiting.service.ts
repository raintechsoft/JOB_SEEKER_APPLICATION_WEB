import type { Paginated, PersonSummary } from "@/types/api";
import type { HiringStage, Id, IsoDateTime, Job, ReceivedApplication } from "@/types/domain";
import type { JobStatus } from "@/lib/domain/jobs";
import type {PortfolioView} from "../portfolio/portfolio.service";
import type { components } from "@/types/generated/api";

export const HIRING_STAGES: HiringStage[] = ["New", "Reviewing", "Shortlisted", "Interview", "Hired", "Rejected"];

export const RESPONSE_TABS = { all: "All", New: "New responses", unviewed: "Not viewed", pending: "Action pending", Shortlisted: "Shortlisted", Reviewing: "In review", Interview: "Interview", Hired: "Hired", Rejected: "Rejected" } as const;
export type ResponseTab = keyof typeof RESPONSE_TABS;

/** Advanced filter keys carried in the response centre URL. */
export const RESPONSE_FILTER_KEYS = ["keywords", "keywordMode", "location", "locality", "distance", "expMin", "expMax", "salaryMin", "salaryMax", "education", "notice", "joining", "industry", "designation", "department"] as const;

export interface HiringSummary {
  openJobs: number;
  received: number;
  newCount: number;
  newApplications: { id: Id; person: PersonSummary; jobTitle: string; createdAt: IsoDateTime }[];
  jobs: { id: Id; title: string; location: string; arrangement: string; applications: number }[];
  shortlistCount: number;
}

export interface ReviewView {
  application: ReceivedApplication;
  person: PersonSummary & { headline: string };
  jobTitle: string;
}

// ---- Jobs manager ---------------------------------------------------------------------------

export interface ManagedJobsQuery {
  drafts: boolean;
  q: string;
  statuses: string[];
  categories: string[];
  location: string;
  days: number;
  sort: "newest" | "oldest" | "responses";
  page: number;
  pageSize: number;
}

export interface ManagedJob extends Job {
  status: JobStatus;
  responses: number;
  fresh: number;
  shortlisted: number;
  author: string;
  posted: IsoDateTime;
}

export interface ManagedJobsPage extends Paginated<ManagedJob> {
  publishedCount: number;
  draftCount: number;
  statusCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
}

// ---- Response centre ------------------------------------------------------------------------

/** Plain key/value view of the response centre URL query. */
export type ResponseParams = Record<string, string>;

export interface ApplicantProfile extends PersonSummary {
  experience?:string;
  headline: string;
  summary: string;
  skills: string[];
  email: string;
  location: string;
  locality: string;
  years: number;
  expectedSalary: number | null;
  notice: number | null;
  joining: number | null;
  industry: string;
  designation: string;
  department: string;
  educationText: string;
  currentRole: string;
  previousRole: string;
  preferredLocations: string;
  phone: string;
}

export interface ResponseItem {
  portfolio?:PortfolioView|null;
  application: ReceivedApplication;
  profile: ApplicantProfile;
  jobTitle: string;
  fit: { score: number; matched: string[] };
  distance: { km: number; estimated: boolean } | null;
  /** Best match (R14b): why this applicant fits the job, by structured skills, experience and location. */
  ranking?: components["schemas"]["ResponseItem"]["ranking"];
  analyticsContext?: components["schemas"]["AnalyticsContext"];
}

export interface ResponsesPage extends Paginated<ResponseItem> {
  stage: ResponseTab;
  tabCounts: Record<ResponseTab, number>;
  jobs: { id: Id; title: string; skills: string[] }[];
  sort: string;
}

export interface RecruitingService {
  getHiringSummary(): Promise<HiringSummary>;
  getReview(id: Id): Promise<ReviewView | null>;
  saveReview(id: Id, input: { status: HiringStage; note: string; followUp: string; version?:number }): Promise<boolean>;

  listManagedJobs(query: ManagedJobsQuery): Promise<ManagedJobsPage>;
  getManagedJob(id: Id): Promise<ManagedJob | null>;
  toggleJob(id: Id): Promise<JobStatus | null>;
  repostJob(id: Id): Promise<boolean>;
  closeJobs(ids: Id[]): Promise<number>;
  saveCollaboration(ids: Id[], emails: string[], note: string, versions?:Record<string,number>): Promise<void>;
  deleteDraft(id: Id): Promise<void>;

  listResponses(params: ResponseParams): Promise<ResponsesPage>;
  /** Ids visible on the current page (for "select all"). */
  setStatus(ids: Id[], status: HiringStage): Promise<number>;
  saveNote(id: Id, note: string, version?:number): Promise<void>;
  markViewed(id: Id): Promise<Id | null>;
  remove(ids: Id[]): Promise<void>;
  saveOutreach(ids: Id[], subject: string, message: string): Promise<void|{draftId:string}>;
  outreachPreview?(id:string):Promise<import("@/types/generated/api").components["schemas"]["OutreachPreview"]>;
  sendOutreach?(id:string,version:number,confirmed:boolean):Promise<void>;
  requestExport?(ids:Id[]):Promise<string>;
  exportStatus?(id:string):Promise<import("@/types/generated/api").components["schemas"]["ExportStatus"]>;
  downloadExport?(id:string):Promise<Blob>;
  runKeywordMatch(params: ResponseParams, autoShortlist: boolean): Promise<{ matches: number; shortlisted: number }>;
  exportCsv(ids: Id[]): Promise<string>;
  exportProfile(id: Id): Promise<{ fileName: string; text: string } | null>;
  getApplicant(id: Id): Promise<ResponseItem | null>;
  applicantNames(ids: Id[]): Promise<string[]>;
}
