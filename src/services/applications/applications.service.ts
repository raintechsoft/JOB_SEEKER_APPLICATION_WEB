import type { ApplicationStatus, TrackingStatus, Id, IsoDate, Job, JobAlert, SeekerApplication } from "@/types/domain";

export const APPLICATION_STATUSES: TrackingStatus[] = ["Applied", "In review", "Interview", "Offer", "Rejected", "Withdrawn"];

export const APPLICATION_DISPLAY_STATUSES: ApplicationStatus[] = ["Applied", "In review", "Shortlisted", "Interview", "Offer", "Hired", "Rejected", "Withdrawn"];

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

export type ApplicationFilter = ApplicationStatus | "in-progress" | "other" | "";
export interface ApplicationCounts {
  all: number;
  inProgress: number;
  other: number;
  statuses: Record<ApplicationStatus, number>;
}
export interface ApplicationResults { items: ApplicationRecord[]; counts: ApplicationCounts }

export interface SavedJobRecord extends JobRef {
  application: SeekerApplication | null;
  postedAt?: string | null;
  companyLogo?: string;
  confidential?: boolean;
  acceptingApplications?: boolean;
  archivedAt?: string | null;
}

export type SavedJobState = "active" | "archived" | "all";
export type SavedJobAction = "archive" | "restore";

export interface AlertRecord extends JobAlert {
  matches: JobRef[];
}

export interface ApplicationsOverview {
  counts: { applied: number; saved: number; activeAlerts: number };
}

export interface ApplicationsService {
  getOverview(): Promise<ApplicationsOverview>;
  listApplications(query: { q: string; status: ApplicationStatus | "" }): Promise<ApplicationRecord[]>;
  getApplicationResults(query: { q: string; status: ApplicationFilter }): Promise<ApplicationResults>;
  listSavedJobs(query: { q: string; state?: SavedJobState }): Promise<SavedJobRecord[]>;
  unsaveJobs(ids: Id[]): Promise<void>;
  archiveSavedJobs(ids: Id[], action: SavedJobAction): Promise<void>;
  listAlerts(query: { q: string }): Promise<AlertRecord[]>;
  getApplication(id: Id): Promise<ApplicationRecord | null>;
  updateTracking(id: Id, input: { status: TrackingStatus; followUp: IsoDate | ""; trackingNote: string; version?:number }): Promise<void>;
  remove(id: Id): Promise<void>;
}

export type { Job };
