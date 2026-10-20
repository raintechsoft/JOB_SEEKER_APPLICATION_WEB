import type { DemoDatabase, Job, JobDraft, JobWizardValues, PostDraft } from "@/types/domain";
import { commit, getDb } from "@/mocks/store/demo-db";
import { projectsFor } from "@/mocks/store/selectors";
import { formatSalary } from "@/lib/domain/jobs";
import { uid } from "@/lib/utils/id";
import type { JobPostsService } from "./job-posts.service";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Initial wizard values for a new job or an existing one (prototype `initial`). */
function initialValues(db: DemoDatabase, job?: Job): JobWizardValues {
  const range = (job?.salary || "").match(/([\d.]+)\s*[–-]\s*([\d.]+)/);
  const company = db.companies[0];
  return {
    companyName: job?.companyDisplayName || company.name,
    hideCompany: job?.hideCompany || false,
    title: job?.title || "",
    department: job?.department || ((job?.title || "").includes("Design") ? "Design" : "Other"),
    role: job?.role || job?.title || "",
    employment: job?.employment || "Full-time",
    experienceMin: 0,
    experienceMax: 10,
    currency: "INR",
    salaryMin: range?.[1] || "",
    salaryMax: range?.[2] || "",
    variableEnabled: false,
    variablePercent: "",
    hideSalary: job?.hideSalary || false,
    arrangement: job?.arrangement || "Hybrid",
    locations: job?.location ? [job.location] : [],
    relocate: true,
    vacancies: 1,
    skills: job?.skills ? [...job.skills] : [],
    essentialSkills: job?.skills?.slice(0, 2) || [],
    education: ["Any graduate"],
    industries: [],
    description: job?.description || "",
    responsibilities: job?.responsibilities?.join("\n") || "",
    requirements: job?.requirements || "",
    benefits: "",
    questions: job?.screeningQuestions ? clone(job.screeningQuestions) : [],
    expiresAt: job?.expiresAt || "",
    reference: job?.reference || "",
    contactEmail: company.email || "",
    requirePortfolio: job?.requirePortfolio || false,
    notifyResponses: true,
    applicationInstructions: job?.applicationInstructions || "",
    thumbnail: job?.thumbnail ? clone(job.thumbnail) : { template: "cobalt", image: "", alt: "", headline: "" },
    jobMedia: job?.jobMedia ? clone(job.jobMedia) : { video: "", files: [] },
    ...(job?.wizardValues ? clone(job.wizardValues) : {}),
  };
}

function jobRecord(db: DemoDatabase, d: JobDraft, draft: boolean): Job {
  const v = d.values;
  const wizardValues: Partial<JobWizardValues> = clone(v);
  delete wizardValues.thumbnail;
  delete wizardValues.jobMedia;
  const old = db.social.jobs.find((j) => j.id === d.id);
  const company = db.companies[0];
  return {
    ...(old ?? {}),
    id: d.id,
    company: company.id,
    companyDisplayName: v.companyName,
    hideCompany: v.hideCompany,
    hideSalary: v.hideSalary,
    title: v.title,
    department: v.department,
    role: v.role,
    employment: v.employment,
    location: v.locations.join(" · "),
    arrangement: v.arrangement,
    salary: formatSalary(v),
    skills: [...v.skills],
    description: v.description,
    responsibilities: v.responsibilities
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    requirements: v.requirements,
    benefits: v.benefits,
    screeningQuestions: clone(v.questions),
    requirePortfolio: v.requirePortfolio,
    applicationInstructions: v.applicationInstructions,
    expiresAt: v.expiresAt,
    reference: v.reference,
    postedBy: old?.postedBy || company.recruiter,
    createdAt: old && !old.draft ? old.createdAt : new Date().toISOString(),
    likes: old?.likes || 0,
    art: old?.art || "northstar",
    draft,
    closed: old?.closed || false,
    thumbnail: clone(v.thumbnail),
    jobMedia: clone(v.jobMedia),
    wizardValues,
    workflowStep: d.step,
  };
}

function upsertJob(db: { social: { jobs: Job[] } }, record: Job) {
  const index = db.social.jobs.findIndex((j) => j.id === record.id);
  if (index >= 0) db.social.jobs[index] = record;
  else db.social.jobs.unshift(record);
}

export const mockJobPostsService: JobPostsService = {
  async openJobDraft(jobId) {
    const db = getDb();
    const company = db.companies[0];
    const job = jobId ? db.social.jobs.find((j) => j.id === jobId && j.company === company.id) : undefined;
    if (jobId && !job) return null;
    const key = jobId || "new";
    const stored = db.jobEditorDrafts[key];
    const draft: JobDraft = stored
      ? clone(stored)
      : { id: job?.id || uid(), existingId: job?.id || "", step: job?.draft ? job.workflowStep || 0 : 0, reached: job && !job.draft ? 6 : job?.workflowStep || 0, values: initialValues(db, job), savedAt: "" };
    if (job) draft.values = { ...initialValues(db, job), ...draft.values };
    return { key, draft, editingPublished: !!job && !job.draft, companyName: company.name, companyId: company.id };
  },

  async storeJobDraft(key, draft) {
    const snapshot = clone({ ...draft, savedAt: new Date().toISOString() });
    const original = getDb().social.jobs.find((j) => j.id === draft.existingId);
    const values = snapshot.values as Partial<JobWizardValues>;
    if (original && JSON.stringify(values.thumbnail) === JSON.stringify(original.thumbnail)) delete values.thumbnail;
    if (original && JSON.stringify(values.jobMedia) === JSON.stringify(original.jobMedia)) delete values.jobMedia;
    return commit(
      (db) => {
        db.jobEditorDrafts[key] = snapshot;
      },
      { rollbackOnFailure: true },
    );
  },

  async saveJobAsDraft(key, draft) {
    const db = getDb();
    const old = db.social.jobs.find((j) => j.id === draft.id);
    if (old && !old.draft) return { ok: await this.storeJobDraft(key, draft), editingPublished: true };
    const ok = commit(
      (d) => {
        upsertJob(d, jobRecord(db, draft, true));
        delete d.jobEditorDrafts[key];
      },
      { rollbackOnFailure: true },
    );
    if (!ok) await this.storeJobDraft(key, draft);
    return { ok, editingPublished: false };
  },

  async publishJob(key, draft) {
    const db = getDb();
    return commit(
      (d) => {
        upsertJob(d, jobRecord(db, draft, false));
        delete d.jobEditorDrafts[key];
      },
      { rollbackOnFailure: true },
    );
  },

  async discardJobDraft(key) {
    commit((db) => {
      delete db.jobEditorDrafts[key];
    });
  },

  async getPostDraft(role, mode) {
    const db = getDb();
    const stored = db.postEditorDrafts[role];
    if (stored) return clone(stored);
    const project = mode === "project" && role === "professional" ? projectsFor(db, "p0").find((p) => p.visibility === "Public")?.id || "" : "";
    return { id: uid(), title: "", body: "", project, media: [], videoUrl: "", step: 0, reached: 0 } satisfies PostDraft;
  },

  async storePostDraft(role, draft) {
    return commit((db) => {
      db.postEditorDrafts[role] = clone(draft);
    });
  },
};
