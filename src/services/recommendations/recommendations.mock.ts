import type { DemoDatabase, Job } from "@/types/domain";
import { getDb } from "@/mocks/store/demo-db";
import { jobCompany } from "@/mocks/store/presenters";
import { me } from "@/mocks/store/selectors";
import { isOpenJob, matchesAlert, normalizeKeywords as norm } from "@/lib/domain/jobs";
import { DAY_MS } from "@/lib/utils/date";
import type { RecommendationsService, RecommendedJob } from "./recommendations.service";

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
};
