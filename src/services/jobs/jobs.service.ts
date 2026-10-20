import type { CompanySummary } from "@/types/api";
import type { Id, Job, JobAlert, RecruitmentDetails, Role, SeekerApplication } from "@/types/domain";

export interface JobDetail {
  job: Job;
  company: CompanySummary;
  saved: boolean;
  application: SeekerApplication | null;
  /** The viewing recruiter's company owns the job. */
  ownedByViewer: boolean;
}

export interface ApplyInput {
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
  getJob(id: Id, role: Role): Promise<JobDetail | null>;
  markSeen(id: Id): Promise<boolean>;
  apply(input: ApplyInput): Promise<void>;
  listAlerts(): Promise<JobAlert[]>;
  saveAlert(input: JobAlertInput): Promise<void>;
  toggleAlert(id: Id): Promise<boolean | null>;
  deleteAlert(id: Id): Promise<void>;
}
