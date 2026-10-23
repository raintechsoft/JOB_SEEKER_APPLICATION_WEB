import type { CompanySummary } from "@/types/api";
import type { Id, IsoDateTime, JobAlert } from "@/types/domain";

/**
 * Recommendation boundary.
 *
 * The future backend (K-Means segments, pgvector similarity, XGBoost ranking) owns which jobs
 * and posts are recommended and in which order. The frontend only renders what it receives and
 * the human-readable reason. The mock implementation reproduces the prototype's transparent rules
 * (job-alert keyword matches and profile/skill overlap). It is NOT a model and is labelled
 * "Matches from demo jobs" in the UI.
 */
export interface RecommendedJob {
  analyticsContext?:{requestId:string;itemId:string;position:number};
  reason?: string;
  id: Id;
  title: string;
  companyId: Id;
  company: CompanySummary;
  location: string;
  arrangement: string;
  employment: string;
  salary: string;
  createdAt: IsoDateTime;
  isNew: boolean;
  saved: boolean;
  /** Names of the viewer's alerts that matched; empty means "based on your role & skills". */
  matchedAlerts: string[];
}

export interface JobRecommendations {
  strategyVersion?:string;
  forYou: RecommendedJob[];
  alertMatches: RecommendedJob[];
  newCount: number;
  alerts: JobAlert[];
}

export interface RecommendationsService {
  getJobsForYou(): Promise<JobRecommendations>;
}
