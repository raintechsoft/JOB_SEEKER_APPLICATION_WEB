import type { Draft } from "immer";
import { paginate } from "@/types/api";
import type { ApplicationTracking, DemoDatabase, HiringStage, Id, Job, ReceivedApplication } from "@/types/domain";
import { commit, getDb } from "@/mocks/store/demo-db";
import { personSummary } from "@/mocks/store/presenters";
import { isJobOpen, ownJobs, person } from "@/mocks/store/selectors";
import { jobStatus } from "@/lib/domain/jobs";
import { DAY_MS, today } from "@/lib/utils/date";
import { uid } from "@/lib/utils/id";
import { HIRING_STAGES, RESPONSE_TABS, type ManagedJob, type RecruitingService, type ResponseItem, type ResponseParams, type ResponseTab } from "./recruiting.service";
import { applicantProfile, matchScore, passesFilters, splitTerms, stageMatch, distance } from "./response-matching";

/** Applications received for the recruiter's own jobs (samples plus the professional's demo applications). */
export function receivedApplications(db: DemoDatabase): ReceivedApplication[] {
  const d = db.recruiter;
  const ids = new Set(ownJobs(db).map((j) => j.id));
  const fromSeeker = db.social.applications.map((a) => ({ ...a, candidate: db.professionals.find((p) => p.email === a.email)?.id || "p0" }));
  return [...d.sampleApplications, ...fromSeeker]
    .filter((a) => ids.has(a.job) && !d.tracking[a.id]?.removed)
    .map((a) => {
      const t = d.tracking[a.id];
      return {
        id: a.id,
        job: a.job,
        candidate: a.candidate,
        createdAt: a.createdAt,
        sample: "sample" in a ? a.sample : undefined,
        name: "name" in a ? a.name : undefined,
        email: "email" in a ? a.email : undefined,
        note: a.note,
        portfolio: a.portfolio,
        recruitmentDetails: "recruitmentDetails" in a ? a.recruitmentDetails : undefined,
        screeningAnswers: "screeningAnswers" in a ? a.screeningAnswers : undefined,
        status: t?.status || "New",
        recruiterNote: t?.note || "",
        followUp: t?.followUp || "",
        viewedAt: t?.viewedAt || "",
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const track = (db: Draft<DemoDatabase>, id: Id): Draft<ApplicationTracking> => (db.recruiter.tracking[id] ??= {});
const posted = (j: Job) => j.publishedAt || j.createdAt;

function managed(db: DemoDatabase, j: Job, apps: ReceivedApplication[]): ManagedJob {
  const responses = apps.filter((a) => a.job === j.id);
  return {
    ...j,
    status: jobStatus(j),
    responses: responses.length,
    fresh: responses.filter((a) => a.status === "New").length,
    shortlisted: responses.filter((a) => a.status === "Shortlisted").length,
    author: j.postedBy || db.companies[0].recruiter,
    posted: posted(j),
  };
}

function responseItem(db: DemoDatabase, a: ReceivedApplication, params: ResponseParams): ResponseItem {
  const job = ownJobs(db).find((j) => j.id === a.job);
  const profile = applicantProfile(db, a);
  const { text: _text, ...rest } = profile;
  const fit = matchScore(job, profile, params);
  return { application: a, profile: rest, jobTitle: job?.title ?? "", fit: { score: fit.score, matched: fit.matched }, distance: params.distance ? distance(profile, job) : null };
}

const csvCell = (value: unknown) => {
  let s = String(value ?? "");
  if (/^[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
};

export const mockRecruitingService: RecruitingService = {
  async getHiringSummary() {
    const db = getDb();
    const apps = receivedApplications(db);
    const jobs = ownJobs(db);
    return {
      openJobs: jobs.filter(isJobOpen).length,
      received: apps.length,
      newCount: apps.filter((a) => a.status === "New").length,
      newApplications: apps
        .filter((a) => a.status === "New")
        .slice(0, 3)
        .map((a) => {
          const p = person(db, a.candidate);
          return { id: a.id, person: { ...personSummary(p), name: a.name || p.name }, jobTitle: jobs.find((j) => j.id === a.job)?.title ?? "", createdAt: a.createdAt };
        }),
      jobs: jobs.slice(0, 3).map((j) => ({ id: j.id, title: j.title, location: j.location, arrangement: j.arrangement, applications: apps.filter((a) => a.job === j.id).length })),
      shortlistCount: db.shortlists.length,
    };
  },

  async getReview(id) {
    const db = getDb();
    const a = receivedApplications(db).find((x) => x.id === id);
    if (!a) return null;
    const p = person(db, a.candidate);
    return { application: a, person: { ...personSummary(p), name: a.name || p.name, headline: p.headline }, jobTitle: ownJobs(db).find((j) => j.id === a.job)?.title ?? "" };
  },

  async saveReview(id, input) {
    return commit((db) => {
      Object.assign(track(db, id), { status: HIRING_STAGES.includes(input.status) ? input.status : "New", note: input.note, followUp: input.followUp });
    });
  },

  async listManagedJobs(q) {
    const db = getDb();
    const apps = receivedApplications(db);
    const all = ownJobs(db);
    const search = q.q.toLowerCase().trim();
    const location = q.location.toLowerCase().trim();
    const list = all.filter(
      (j) =>
        !!j.draft === q.drafts &&
        (!search || [j.title, j.id, j.reference].join(" ").toLowerCase().includes(search)) &&
        (!q.statuses.length || q.statuses.includes(jobStatus(j))) &&
        (!q.categories.length || q.categories.includes(j.employment)) &&
        (!location || (j.location || "").toLowerCase().includes(location)) &&
        (!q.days || (Date.now() - new Date(posted(j)).getTime()) / DAY_MS <= q.days),
    );
    const count = (id: Id) => apps.filter((r) => r.job === id).length;
    list.sort((a, b) => (q.sort === "oldest" ? posted(a).localeCompare(posted(b)) : q.sort === "responses" ? count(b.id) - count(a.id) : posted(b).localeCompare(posted(a))));
    const published = all.filter((j) => !j.draft);
    const statusCounts = Object.fromEntries(["Active", "Closed", "Expired"].map((s) => [s, published.filter((j) => jobStatus(j) === s).length]));
    const categoryCounts = Object.fromEntries(["Full-time", "Part-time", "Contract", "Internship"].map((s) => [s, all.filter((j) => !!j.draft === q.drafts && j.employment === s).length]));
    const page = paginate(
      list.map((j) => managed(db, j, apps)),
      q.page,
      q.pageSize,
    );
    return { ...page, publishedCount: published.length, draftCount: all.filter((j) => j.draft).length, statusCounts, categoryCounts };
  },

  async getManagedJob(id) {
    const db = getDb();
    const j = ownJobs(db).find((x) => x.id === id);
    return j ? managed(db, j, receivedApplications(db)) : null;
  },

  async toggleJob(id) {
    let status: ReturnType<typeof jobStatus> | null = null;
    commit((db) => {
      const j = db.social.jobs.find((x) => x.id === id && x.company === db.companies[0].id);
      if (!j || j.draft) return;
      if (jobStatus(j) === "Active") j.closed = true;
      else {
        j.closed = false;
        if (j.expiresAt && j.expiresAt < today()) j.expiresAt = new Date(Date.now() + 30 * DAY_MS).toISOString().slice(0, 10);
      }
      status = jobStatus(j);
    });
    return status;
  },

  async repostJob(id) {
    const job = ownJobs(getDb()).find((j) => j.id === id);
    if (!job || jobStatus(job) !== "Active") return false;
    commit((db) => {
      const j = db.social.jobs.find((x) => x.id === id)!;
      j.publishedAt = new Date().toISOString();
      j.createdAt = j.publishedAt;
    });
    return true;
  },

  async closeJobs(ids) {
    let count = 0;
    commit((db) => {
      for (const id of ids) {
        const j = db.social.jobs.find((x) => x.id === id && x.company === db.companies[0].id);
        if (j && jobStatus(j) === "Active") {
          j.closed = true;
          count++;
        }
      }
    });
    return count;
  },

  async saveCollaboration(ids, emails, note) {
    commit((db) => {
      for (const id of ids) {
        const j = db.social.jobs.find((x) => x.id === id && x.company === db.companies[0].id);
        if (j) {
          j.collaborators = emails;
          j.collaborationNote = note;
        }
      }
    });
  },

  async deleteDraft(id) {
    commit((db) => {
      db.social.jobs = db.social.jobs.filter((j) => !(j.id === id && j.company === db.companies[0].id && j.draft));
    });
  },

  async listResponses(params) {
    const db = getDb();
    const job = params.job || "";
    const search = params.q || "";
    const stage: ResponseTab = Object.hasOwn(RESPONSE_TABS, params.stage) ? (params.stage as ResponseTab) : "all";
    const jobs = ownJobs(db);
    const data = receivedApplications(db)
      .filter((a) => !job || a.job === job)
      .map((a) => ({ a, p: applicantProfile(db, a), j: jobs.find((x) => x.id === a.job) }))
      .filter(({ a, p, j }) => (!search || [p.name, p.headline, p.designation, j?.title].join(" ").toLowerCase().includes(search.toLowerCase())) && passesFilters(jobs.find((x) => x.id === a.job), p, params));
    const list = data.filter(({ a }) => stageMatch(a, stage));
    const sort = params.sort || "newest";
    list.sort((x, y) =>
      sort === "experience" ? y.p.years - x.p.years : sort === "relevance" ? matchScore(y.j, y.p, params).score - matchScore(x.j, x.p, params).score : sort === "oldest" ? x.a.createdAt.localeCompare(y.a.createdAt) : y.a.createdAt.localeCompare(x.a.createdAt),
    );
    const size = [10, 20, 40].includes(Number(params.size)) ? Number(params.size) : 10;
    const page = paginate(
      list.map(({ a }) => responseItem(db, a, params)),
      Number(params.page) || 1,
      size,
    );
    const tabCounts = Object.fromEntries((Object.keys(RESPONSE_TABS) as ResponseTab[]).map((k) => [k, data.filter(({ a }) => stageMatch(a, k)).length])) as Record<ResponseTab, number>;
    return { ...page, stage, tabCounts, jobs: jobs.filter((j) => !j.draft).map((j) => ({ id: j.id, title: j.title, skills: j.skills })), sort };
  },

  async setStatus(ids, status) {
    const known = new Set(receivedApplications(getDb()).map((a) => a.id));
    const valid = ids.filter((id) => known.has(id));
    commit((db) => {
      for (const id of valid) Object.assign(track(db, id), { status, updatedAt: new Date().toISOString() });
    });
    return valid.length;
  },

  async saveNote(id, note) {
    commit((db) => {
      track(db, id).note = note;
    });
  },

  async markViewed(id) {
    const a = receivedApplications(getDb()).find((x) => x.id === id);
    if (!a) return null;
    commit((db) => {
      track(db, id).viewedAt = new Date().toISOString();
    });
    return a.candidate;
  },

  async remove(ids) {
    const known = new Set(receivedApplications(getDb()).map((a) => a.id));
    commit((db) => {
      for (const id of ids) if (known.has(id)) track(db, id).removed = true;
    });
  },

  async saveOutreach(ids, subject, message) {
    commit((db) => {
      db.recruiter.responseOutreach.push({ id: uid(), responses: ids, subject, message, createdAt: new Date().toISOString() });
    });
  },

  async runKeywordMatch(params, autoShortlist) {
    const db = getDb();
    const jobs = ownJobs(db);
    const matches = receivedApplications(db).filter((a) => (!params.job || a.job === params.job) && passesFilters(jobs.find((j) => j.id === a.job), applicantProfile(db, a), params));
    let shortlisted = 0;
    if (autoShortlist) {
      commit((d) => {
        for (const a of matches) {
          if (!["New", "Reviewing"].includes(a.status)) continue;
          const job = jobs.find((j) => j.id === a.job);
          const p = applicantProfile(db, a);
          const t = track(d, a.id);
          t.status = "Shortlisted" as HiringStage;
          t.matchRun = { terms: params.fitTerms ? splitTerms(params.fitTerms) : job?.skills || [], score: matchScore(job, p, params).score, at: new Date().toISOString() };
          shortlisted++;
        }
      });
    }
    return { matches: matches.length, shortlisted };
  },

  async exportCsv(ids) {
    const db = getDb();
    const jobs = ownJobs(db);
    const rows = receivedApplications(db)
      .filter((a) => ids.includes(a.id))
      .map((a) => {
        const p = applicantProfile(db, a);
        return [p.name, p.email, jobs.find((j) => j.id === a.job)?.title, a.status, p.location, p.locality, p.years, p.expectedSalary ?? "", p.notice ?? "", p.joining ?? "", p.educationText, (p.skills || []).join("; "), p.industry, p.designation, p.department, a.recruiterNote];
      });
    const header = ["Name", "Email", "Job", "Status", "Location", "Locality", "Experience years", "Expected salary LPA", "Notice days", "Joining days", "Education", "Skills", "Industry", "Designation", "Department", "Recruiter note"];
    return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  },

  async exportProfile(id) {
    const db = getDb();
    const a = receivedApplications(db).find((x) => x.id === id);
    if (!a) return null;
    const p = applicantProfile(db, a);
    return {
      fileName: p.name.replace(/[^a-z0-9]/gi, "-") + "-profile.txt",
      text: [p.name, p.designation, p.location, "Experience: " + p.years + " years", "Current: " + p.currentRole, "Previous: " + (p.previousRole || "Not provided"), "Education: " + p.educationText, "Skills: " + p.skills.join(", "), "Profile summary: " + p.summary, "", "Profile export from the Skillora browser-local prototype. This is not an uploaded CV."].join("\n"),
    };
  },

  async getApplicant(id) {
    const db = getDb();
    const a = receivedApplications(db).find((x) => x.id === id);
    return a ? responseItem(db, a, {}) : null;
  },

  async applicantNames(ids) {
    const db = getDb();
    return receivedApplications(db)
      .filter((a) => ids.includes(a.id))
      .map((a) => applicantProfile(db, a).name);
  },
};
