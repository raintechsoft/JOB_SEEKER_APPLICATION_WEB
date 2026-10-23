import type { Id, Job, JobDraft, PostDraft, Role } from "@/types/domain";

export interface JobDraftContext {
  latestJobVersion?:number;
  latestJob?:Job|null;
  /** Key under which the working draft is stored: the job id, or "new". */
  key: string;
  draft: JobDraft;
  /** The job being edited is already published (not a saved draft). */
  editingPublished: boolean;
  companyName: string;
  companyId: Id;
}

export interface JobPostsService {
  rebaseJobDraft?(key:string,draft:JobDraft,latestJobVersion:number):Promise<JobDraft>;
  /** `null` when an id is given but the job is not in the recruiter's company. */
  openJobDraft(jobId: Id | null, creationKey?:string): Promise<JobDraftContext | null>;
  storeJobDraft(key: string, draft: JobDraft): Promise<boolean>;
  /** Saves a draft job record (or keeps private edits for a published job). */
  saveJobAsDraft(key: string, draft: JobDraft): Promise<{ ok: boolean; editingPublished: boolean }>;
  publishJob(key: string, draft: JobDraft): Promise<boolean>;
  discardJobDraft(key: string): Promise<void>;

  getPostDraft(role: Role, mode: string): Promise<PostDraft>;
  storePostDraft(role: Role, draft: PostDraft): Promise<boolean>;
}
