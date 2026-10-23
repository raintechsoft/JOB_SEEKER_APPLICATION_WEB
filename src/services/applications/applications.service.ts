import type { ApplicationStatus, Id, IsoDate, Job, JobAlert, SeekerApplication } from "@/types/domain";

export const APPLICATION_STATUSES: ApplicationStatus[] = ["Applied", "In review", "Interview", "Offer", "Rejected", "Withdrawn"];

export interface JobRef {
  id: Id;
  title: string;
  companyId: Id;
  companyName: string;
  location: string;
  arrangement: string;
  employment: string;
  salary: string;
  description: string;
}

export interface ApplicationRecord extends SeekerApplication {
  job: Id;
  jobRef: JobRef | null;
}

export interface SavedJobRecord extends JobRef {
  application: SeekerApplication | null;
}

export interface AlertRecord extends JobAlert {
  matches: JobRef[];
}

export interface ApplicationsOverview {
  counts: { applied: number; saved: number; activeAlerts: number };
}

export interface ApplicationsService {
  getOverview(): Promise<ApplicationsOverview>;
  listApplications(query: { q: string; status: ApplicationStatus | "" }): Promise<ApplicationRecord[]>;
  listSavedJobs(query: { q: string }): Promise<SavedJobRecord[]>;
  listAlerts(query: { q: string }): Promise<AlertRecord[]>;
  getApplication(id: Id): Promise<ApplicationRecord | null>;
  updateTracking(id: Id, input: { status: ApplicationStatus; followUp: IsoDate | ""; trackingNote: string; version?:number }): Promise<void>;
  remove(id: Id): Promise<void>;
}

export type { Job };
