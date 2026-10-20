import type { DemoDatabase, Id, Professional, Role, SocialGraph } from "@/types/domain";
import { today } from "@/lib/utils/date";

/** The signed-in demo professional (Alex Morgan). */
export const ME_ID = "p0";
/** The signed-in demo recruiter identity (Emma Wilson). */
export const RECRUITER_ID = "r0";

export const me = (db: DemoDatabase) => db.professionals[0];

export const findProfessional = (db: DemoDatabase, id: Id) => db.professionals.find((p) => p.id === id);

/** Prototype `person()`: unknown ids fall back to the signed-in professional. */
export const person = (db: DemoDatabase, id: Id): Professional => findProfessional(db, id) ?? me(db);

export const projectsFor = (db: DemoDatabase, id: Id) => db.projects.filter((p) => p.owner === id);

export const updatesFor = (db: DemoDatabase, id: Id) =>
  db.updates.filter((u) => u.owner === id).sort((a, b) => b.date.localeCompare(a.date));

export const homeCompany = (db: DemoDatabase) => db.companies[0];

export const currentRecruiter = (db: DemoDatabase) => {
  const w = db.organizationWorkspace;
  return w.recruiters.find((r) => r.id === w.currentRecruiterId) ?? w.recruiters[0];
};

export const canManageOrganization = (db: DemoDatabase) => {
  const r = currentRecruiter(db);
  return r?.role === "Organization Admin" && r.accountStatus === "Active";
};

/** The recruiter identity used in the feed, messaging and shells. */
export function recruiterIdentity(db: DemoDatabase) {
  const c = homeCompany(db);
  return {
    id: RECRUITER_ID,
    name: c.recruiter,
    picture: db.organizationWorkspace.recruiters.find((r) => r.id === RECRUITER_ID)?.avatarUrl || undefined,
    headline: (c.title ?? "") + " · " + c.name,
    color: "#E4E9EF",
  };
}

export const socialFor = (db: DemoDatabase, role: Role): SocialGraph => (role === "recruiter" ? db.recruiterSocial : db.social);

export const isJobOpen = (j: { closed?: boolean; draft?: boolean; expiresAt?: string }) => !j.closed && !j.draft && (!j.expiresAt || j.expiresAt >= today());

export const ownJobs = (db: DemoDatabase) => db.social.jobs.filter((j) => j.company === homeCompany(db).id);
