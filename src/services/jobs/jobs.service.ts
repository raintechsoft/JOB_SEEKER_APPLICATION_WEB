import type { CompanySummary } from "@/types/api";
import type { Id, Job, JobAlert, RecruitmentDetails, Role, SeekerApplication } from "@/types/domain";
import type { MatchBadgeData } from "@/components/jobs/match-badge";

export interface JobDetail {
  job: Job;
  company: CompanySummary;
  saved: boolean;
  application: SeekerApplication | null;
  /** The viewing recruiter's company owns the job. */
  ownedByViewer: boolean;
  /** How the signed-in job seeker fits the job. */
  match?: MatchBadgeData | null;
}

export interface ApplyInput {
  questionsVersion?: number;
  jobId: Id;
  name: string;
  email: string;
  note: string;
  portfolio: boolean;
  recruitmentDetails: RecruitmentDetails;
  answers: Record<Id, string>;
}

export type JobAlertInput = Omit<JobAlert, "id"> & { id?: Id };

export interface JobsService {
  listOpportunities(query:import("@/lib/validation/search").JobSearchInput):Promise<{items:{job:Job;company:CompanySummary;saved?:boolean;match?:MatchBadgeData|null}[];total:number}>;
  toggleSave?(id: Id): Promise<{ saved: boolean; persisted?: boolean }>;
  getJob(id: Id, role: Role): Promise<JobDetail | null>;
  markSeen(id: Id): Promise<boolean>;
  apply(input: ApplyInput): Promise<void>;
  listAlerts(): Promise<JobAlert[]>;
  saveAlert(input: JobAlertInput): Promise<void>;
  toggleAlert(id: Id): Promise<boolean | null>;
  deleteAlert(id: Id): Promise<void>;
}
