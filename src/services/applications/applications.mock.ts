import type { DemoDatabase, Job } from "@/types/domain";
import { commit, getDb } from "@/mocks/store/demo-db";
import { mockApplicationResults } from "@/lib/domain/applications";
import { matchesAlert } from "@/lib/domain/jobs";
import rules from "../../../contracts/validation/application.json";
import { APPLICATION_STATUSES } from "./applications.service";
import type { ApplicationRecord, ApplicationsService, JobRef } from "./applications.service";
import { applicationFiltersSchema, savedJobSelectionSchema, savedJobStateSchema, savedJobActionSchema } from "@/lib/validation/application";
import { jobCompany } from "@/mocks/store/presenters";

export function companyName(db: DemoDatabase, j: Job | undefined) {
  if (!j) return "Company unavailable";
  return j.hideCompany ? "Confidential company" : j.companyDisplayName || db.companies.find((c) => c.id === j.company)?.name || "Company unavailable";
}

const ref = (db: DemoDatabase, j: Job): JobRef => ({
  id: j.id,
  title: j.title,
  companyId: j.company,
  companyName: companyName(db, j),
  location: j.location,
  arrangement: j.arrangement,
  employment: j.employment,
  salary: j.salary,
  description: j.description,
});

const matchesQuery = (db: DemoDatabase, j: Job | undefined, q: string) => !q || [j?.title, companyName(db, j), j?.location, ...(j?.skills || [])].join(" ").toLowerCase().includes(q);

function record(db: DemoDatabase, a: DemoDatabase["social"]["applications"][number]): ApplicationRecord {
  const j = db.social.jobs.find((x) => x.id === a.job);
  const trackingStatus=APPLICATION_STATUSES.find(stage => stage === a.status) ?? "Applied";
  const employer=db.recruiter.tracking[a.id];
  const stage=employer?.status ?? "New";
  const source=a.withdrawnAt || trackingStatus === "Withdrawn" ? "withdrawn" : stage !== "New" || employer?.stageUpdated ? "employer" : "tracking";
  const status=source === "withdrawn" ? "Withdrawn" : source === "employer" ? rules.employerStatusMap[stage] as ApplicationRecord["status"] : trackingStatus;
  return { ...a, status,trackingStatus,statusSource:source,employerStage:stage, jobRef: j ? ref(db, j) : null };
}

export const mockApplicationsService: ApplicationsService = {
  async getApplicationResults(query) {
    const input=applicationFiltersSchema.parse(query);
    const rows=await mockApplicationsService.listApplications({q:input.q,status:""});
    return mockApplicationResults(rows,input.status);
  },

  async getOverview() {
    const db = getDb();
    return { counts: { applied: db.social.applications.length, saved: db.social.jobs.filter((j) => db.social.saved.includes(j.id)).length, activeAlerts: db.social.jobAlerts.filter((a) => a.enabled).length } };
  },

  async listApplications({ q, status }) {
    const db = getDb();
    const query = q.toLowerCase().trim();
    return db.social.applications
      .filter((a) => matchesQuery(db, db.social.jobs.find((j) => j.id === a.job), query))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => record(db, a))
      .filter(a => !status || a.status === status);
  },

  async listSavedJobs({ q, state = "active" }) {
    const db = getDb();
    savedJobStateSchema.parse(state);
    const query = q.toLowerCase().trim();
    return db.social.jobs
      .filter((j) => db.social.saved.includes(j.id) && (state === "all" || (state === "archived") === !!db.social.archivedSavedJobs?.[j.id]) && matchesQuery(db, j, query))
      .map((j) => ({ ...ref(db, j), companyId: jobCompany(db,j).id, companyLogo: jobCompany(db,j).logoUrl, confidential: !!j.hideCompany, postedAt: j.publishedAt || j.createdAt, archivedAt: db.social.archivedSavedJobs?.[j.id] ?? null, acceptingApplications: !j.draft && !j.closed && (!j.expiresAt || j.expiresAt >= new Date().toISOString().slice(0,10)), application: db.social.applications.find((a) => a.job === j.id) ?? null }));
  },

  async unsaveJobs(ids) {
    const selected = new Set(savedJobSelectionSchema.parse(ids));
    commit(db => { db.social.saved = db.social.saved.filter(id => !selected.has(id));for(const id of selected)delete db.social.archivedSavedJobs?.[id]; });
  },

  async archiveSavedJobs(ids, action) {
    const selected = savedJobSelectionSchema.parse(ids);savedJobActionSchema.parse(action);
    commit(db => {const archived = db.social.archivedSavedJobs ??= {};for(const id of selected)if(db.social.saved.includes(id)){if(action==="archive")archived[id]??=new Date().toISOString();else delete archived[id];}});
  },

  async listAlerts({ q }) {
    const db = getDb();
    const query = q.toLowerCase().trim();
    return db.social.jobAlerts
      .filter((a) => !query || [a.name, a.keywords, a.location].join(" ").toLowerCase().includes(query))
      .map((a) => ({
        ...a,
        matches: db.social.jobs
          .filter((j) => matchesAlert(j, a))
          .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
          .map((j) => ref(db, j)),
      }));
  },

  async getApplication(id) {
    const db = getDb();
    const a = db.social.applications.find((x) => x.id === id);
    return a ? record(db, a) : null;
  },

  async updateTracking(id, input) {
    commit((db) => {
      const a = db.social.applications.find((x) => x.id === id);
      if (!a) return;
      Object.assign(a, input, { updatedAt: new Date().toISOString() });
    });
  },

  async remove(id) {
    commit((db) => {
      db.social.applications = db.social.applications.filter((a) => a.id !== id);
    });
  },
};
