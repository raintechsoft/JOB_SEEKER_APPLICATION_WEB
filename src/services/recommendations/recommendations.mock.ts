import type { DemoDatabase, Job } from "@/types/domain";
import { getDb } from "@/mocks/store/demo-db";
import { jobCompany } from "@/mocks/store/presenters";
import { me } from "@/mocks/store/selectors";
import { isOpenJob, matchesAlert, normalizeKeywords as norm } from "@/lib/domain/jobs";
import { DAY_MS } from "@/lib/utils/date";
import { personSummary } from "@/mocks/store/presenters";
import type { RecommendationsService, RecommendedJob, SimilarPerson } from "./recommendations.service";

const SENIORITY = ["senior", "junior", "lead", "principal", "manager"];

function relevantToProfile(db: DemoDatabase, job: Job) {
  if (Date.now() - Date.parse(job.createdAt) > 7 * DAY_MS) return false;
  const p = me(db);
  const skills = new Set(p.skills.map(norm));
  const preferred = p.professionalDetails?.career?.roles || "";
  if (
    preferred
      .split(",")
      .map(norm)
      .filter(Boolean)
      .some((role) => role.split(" ").every((word) => norm(job.title).includes(word)))
  )
    return true;
  if (job.skills.some((s) => skills.has(norm(s)))) return true;
  const words = norm(p.headline)
    .split(" ")
    .filter((w) => w.length > 3 && !SENIORITY.includes(w));
  return words.some((w) => norm(job.title).includes(w));
}

const shared = (a: string[], b: string[]) => { const set = new Set(a.map(norm)); return b.filter((s) => set.has(norm(s))).length; };

const isNew = (db: DemoDatabase, job: Job) => Date.now() - Date.parse(job.createdAt) <= 7 * DAY_MS && !db.social.seenJobs.includes(job.id);

export const mockRecommendationsService: RecommendationsService = {
  async getJobsForYou() {
    const db = getDb();
    const alerts = db.social.jobAlerts;
    const forYou = db.social.jobs
      .filter(isOpenJob)
      .map((job) => ({ job, alerts: alerts.filter((a) => matchesAlert(job, a)), profile: relevantToProfile(db, job) }))
      .filter((r) => r.alerts.length || r.profile)
      .sort((a, b) => b.job.createdAt.localeCompare(a.job.createdAt))
      .map(
        ({ job, alerts: matched }): RecommendedJob => ({
          id: job.id,
          title: job.title,
          companyId: job.company,
          company: jobCompany(db, job),
          location: job.location,
          arrangement: job.arrangement,
          employment: job.employment,
          salary: job.salary,
          createdAt: job.createdAt,
          isNew: isNew(db, job),
          saved: db.social.saved.includes(job.id),
          matchedAlerts: matched.map((a) => a.name),
        }),
      );
    return { forYou, alertMatches: forYou.filter((r) => r.matchedAlerts.length), newCount: forYou.filter((r) => r.isNew).length, alerts };
  },

  /** Demo: open jobs sharing the most skills with this one. */
  async similarJobs(jobId, limit = 4) {
    const db = getDb();
    const source = db.social.jobs.find((job) => job.id === jobId);
    if (!source) return [];
    return db.social.jobs
      .filter((job) => job.id !== jobId && isOpenJob(job) && shared(source.skills, job.skills) > 0)
      .sort((a, b) => shared(source.skills, b.skills) - shared(source.skills, a.skills) || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map((job): RecommendedJob => ({ id: job.id, title: job.title, companyId: job.company, company: jobCompany(db, job), location: job.location, arrangement: job.arrangement, employment: job.employment, salary: job.salary, createdAt: job.createdAt, isNew: isNew(db, job), saved: db.social.saved.includes(job.id), matchedAlerts: [], reason: "Asks for similar skills" }));
  },

  /** Demo: public professionals sharing the most skills with this one. */
  async similarPeople(professionalId, limit = 4) {
    const db = getDb();
    const source = db.professionals.find((p) => p.id === professionalId);
    if (!source) return [];
    return db.professionals
      .filter((p) => p.id !== professionalId && p.public && shared(source.skills, p.skills) > 0)
      .sort((a, b) => shared(source.skills, b.skills) - shared(source.skills, a.skills) || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map((p): SimilarPerson => { const s = personSummary(p, db); return { id: s.id, name: s.name, headline: s.headline ?? "", picture: s.picture, color: s.color, reason: "Has similar skills" }; });
  },
};
