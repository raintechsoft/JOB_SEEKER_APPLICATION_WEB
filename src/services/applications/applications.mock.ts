import type { DemoDatabase, Job } from "@/types/domain";
import { commit, getDb } from "@/mocks/store/demo-db";
import { matchesAlert } from "@/lib/domain/jobs";
import type { ApplicationRecord, ApplicationsService, JobRef } from "./applications.service";

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
  return { ...a, jobRef: j ? ref(db, j) : null };
}

export const mockApplicationsService: ApplicationsService = {
  async getOverview() {
    const db = getDb();
    return { counts: { applied: db.social.applications.length, saved: db.social.jobs.filter((j) => db.social.saved.includes(j.id)).length, activeAlerts: db.social.jobAlerts.filter((a) => a.enabled).length } };
  },

  async listApplications({ q, status }) {
    const db = getDb();
    const query = q.toLowerCase().trim();
    return db.social.applications
      .filter((a) => matchesQuery(db, db.social.jobs.find((j) => j.id === a.job), query) && (!status || a.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => record(db, a));
  },

  async listSavedJobs({ q }) {
    const db = getDb();
    const query = q.toLowerCase().trim();
    return db.social.jobs
      .filter((j) => db.social.saved.includes(j.id) && matchesQuery(db, j, query))
      .map((j) => ({ ...ref(db, j), application: db.social.applications.find((a) => a.job === j.id) ?? null }));
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
