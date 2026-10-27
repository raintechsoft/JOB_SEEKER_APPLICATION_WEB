import { paginate } from "@/types/api";
import { commit, getDb } from "@/mocks/store/demo-db";
import { jobCompany } from "@/mocks/store/presenters";
import { homeCompany, me, socialFor } from "@/mocks/store/selectors";
import { isOpenJob } from "@/lib/domain/jobs";
import { jobSearchSchema } from "@/lib/validation/search";
import { uid } from "@/lib/utils/id";
import type { JobsService } from "./jobs.service";

export const mockJobsService: JobsService = {
  async listOpportunities(query) {
    const values = jobSearchSchema.parse(query);
    const db = getDb();
    const term = values.q.toLowerCase();
    const rows = db.social.jobs.filter(isOpenJob).filter((job) => {
      const haystack = [job.title, job.description, job.location, job.role, ...job.skills].filter(Boolean).join(" ").toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (values.arrangement && job.arrangement !== values.arrangement) return false;
      if (values.employment && job.employment !== values.employment) return false;
      if (values.location && !job.location.toLowerCase().includes(values.location.toLowerCase())) return false;
      if (values.skill && !job.skills.some((skill) => skill.toLowerCase().includes(values.skill!.toLowerCase()))) return false;
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((job) => ({ job, company: jobCompany(db, job), saved: db.social.saved.includes(job.id) }));
    const page = paginate(rows, values.page, values.pageSize ?? 20);
    return { items: page.items, total: page.total };
  },
  async getJob(id, role) {
    const db = getDb();
    const job = db.social.jobs.find((j) => j.id === id);
    if (!job) return null;
    return {
      job,
      company: jobCompany(db, job),
      saved: socialFor(db, role).saved.includes(id),
      application: db.social.applications.find((a) => a.job === id) ?? null,
      ownedByViewer: role === "recruiter" && job.company === homeCompany(db).id,
    };
  },

  async markSeen(id) {
    if (getDb().social.seenJobs.includes(id)) return false;
    commit((db) => {
      db.social.seenJobs.push(id);
    });
    return true;
  },

  async apply(input) {
    const db = getDb();
    if (db.social.applications.some((a) => a.job === input.jobId)) return;
    const p = me(db);
    const job = db.social.jobs.find((j) => j.id === input.jobId);
    const d = input.recruitmentDetails;
    commit((draft) => {
      draft.social.applications.push({
        id: uid(),
        job: input.jobId,
        name: input.name,
        email: input.email,
        note: input.note,
        portfolio: input.portfolio,
        recruitmentDetails: { ...d, location: d.location || p.location, designation: d.designation || p.headline, department: d.department || p.category },
        screeningAnswers: (job?.screeningQuestions || []).map((q) => ({ id: q.id, question: q.text, answer: input.answers[q.id] ?? "" })),
        createdAt: new Date().toISOString(),
        status: "Applied",
        trackingNote: "",
        followUp: "",
      });
    });
  },

  async listAlerts() {
    return getDb().social.jobAlerts;
  },

  async saveAlert(input) {
    commit((db) => {
      const id = input.id || uid();
      const item = { ...input, id };
      const index = db.social.jobAlerts.findIndex((a) => a.id === id);
      if (index < 0) db.social.jobAlerts.push(item);
      else db.social.jobAlerts[index] = item;
    });
  },

  async toggleAlert(id) {
    let enabled: boolean | null = null;
    commit((db) => {
      const a = db.social.jobAlerts.find((x) => x.id === id);
      if (!a) return;
      a.enabled = !a.enabled;
      enabled = a.enabled;
    });
    return enabled;
  },

  async deleteAlert(id) {
    commit((db) => {
      db.social.jobAlerts = db.social.jobAlerts.filter((a) => a.id !== id);
    });
  },
};
