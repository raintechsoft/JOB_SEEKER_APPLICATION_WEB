import type { Draft } from "immer";
import type { DemoDatabase, OrganizationWorkspace } from "@/types/domain";
import { commit, getDb } from "@/mocks/store/demo-db";
import { canManageOrganization, currentRecruiter, isJobOpen } from "@/mocks/store/selectors";
import { ORGANIZATION_ROLES, publicOrganization, publicRecruiter } from "@/lib/domain/organization";
import { uid } from "@/lib/utils/id";
import { isValidEmail } from "@/lib/utils/url";
import type { OrganizationService } from "./organization.service";

/** Mirrors organization identity onto the legacy company record used by jobs and the feed. */
function syncCompany(db: Draft<DemoDatabase>) {
  const w = db.organizationWorkspace;
  const c = db.companies.find((x) => x.id === w.organization.id);
  if (!c) return;
  const status = w.organization.verificationStatus;
  Object.assign(c, { name: w.organization.name, industry: w.organization.industry, website: w.organization.websiteUrl, summary: w.organization.description, status: status === "Verified" ? "Demo verified" : status === "Pending review" ? "Pending review" : "Not verified" });
  const identity = w.recruiters.find((r) => r.id === "r0");
  if (identity) Object.assign(c, { recruiter: identity.fullName, title: identity.jobTitle, email: identity.workEmail });
}

const companyJobs = (db: DemoDatabase) => db.social.jobs.filter((j) => j.company === db.organizationWorkspace.organization.id);

const mutate = (fn: (w: Draft<OrganizationWorkspace>) => void) =>
  commit(
    (db) => {
      fn(db.organizationWorkspace);
    },
    { rollbackOnFailure: true },
  );

export const mockOrganizationService: OrganizationService = {
  async getContext() {
    const db = getDb();
    return { workspace: db.organizationWorkspace, currentRecruiter: currentRecruiter(db), canManage: canManageOrganization(db), companyJobs: companyJobs(db), openJobs: companyJobs(db).filter(isJobOpen) };
  },

  async saveOrganization(organization, verification) {
    return commit(
      (db) => {
        db.organizationWorkspace.organization = { ...structuredClone(organization), updatedAt: new Date().toISOString() };
        db.organizationWorkspace.verification = structuredClone(verification);
        syncCompany(db);
      },
      { rollbackOnFailure: true },
    );
  },

  async saveRecruiter(member) {
    return commit(
      (db) => {
        const w = db.organizationWorkspace;
        const i = w.recruiters.findIndex((r) => r.id === member.id);
        if (i < 0) return;
        w.recruiters[i] = structuredClone(member);
        syncCompany(db);
      },
      { rollbackOnFailure: true },
    );
  },

  async invite({ fullName, email, role, department }) {
    const w = getDb().organizationWorkspace;
    const normalized = email.trim().toLowerCase();
    if (!isValidEmail(normalized)) return { ok: false, error: "Enter a valid work email." };
    if (!ORGANIZATION_ROLES.includes(role)) return { ok: false, error: "Choose a valid organization role." };
    if (w.recruiters.some((r) => r.workEmail.toLowerCase() === normalized) || w.invitations.some((i) => i.email.toLowerCase() === normalized && i.invitationStatus === "Invitation Pending")) {
      return { ok: false, error: "This email already belongs to a team member or pending invitation." };
    }
    const ok = mutate((ws) => {
      ws.invitations.push({ id: uid(), organizationId: ws.organization.id, fullName, email: normalized, role, hiringDepartment: department, invitationStatus: "Invitation Pending", createdAt: new Date().toISOString() });
    });
    return ok ? { ok: true } : { ok: false, error: "Browser storage is full. The invitation was not saved." };
  },

  async updateAccess(id, role, accountStatus) {
    const w = getDb().organizationWorkspace;
    const r = w.recruiters.find((x) => x.id === id);
    if (!r) return { ok: false, error: "Recruiter not found." };
    if (!ORGANIZATION_ROLES.includes(role) || !["Active", "Inactive"].includes(accountStatus)) return { ok: false, error: "Choose a valid role and status." };
    if (r.role === "Organization Admin" && r.accountStatus === "Active" && (role !== "Organization Admin" || accountStatus !== "Active") && w.recruiters.filter((v) => v.role === "Organization Admin" && v.accountStatus === "Active").length <= 1) {
      return { ok: false, error: "Keep at least one active organization admin." };
    }
    const ok = mutate((ws) => {
      Object.assign(ws.recruiters.find((v) => v.id === id)!, { role, accountStatus });
    });
    return ok ? { ok: true } : { ok: false, error: "Browser storage is full. Access was not changed." };
  },

  async cancelInvitation(id) {
    return mutate((w) => {
      const i = w.invitations.find((v) => v.id === id && v.invitationStatus === "Invitation Pending");
      if (i) i.invitationStatus = "Cancelled";
    });
  },

  async remindInvitation(id) {
    return mutate((w) => {
      const i = w.invitations.find((v) => v.id === id);
      if (i) i.reminderAt = new Date().toISOString();
    });
  },

  async acceptInvitation(id) {
    return mutate((w) => {
      const i = w.invitations.find((v) => v.id === id && v.invitationStatus === "Invitation Pending");
      if (!i) return;
      w.recruiters.push({ id: uid(), organizationId: w.organization.id, fullName: i.fullName || "New recruiter", avatarUrl: "", jobTitle: i.role === "Hiring Manager" ? "Hiring Manager" : "Recruiter", professionalBio: "", workEmail: i.email, hiringDepartments: i.hiringDepartment ? [i.hiringDepartment] : [], hiringLocations: [], professionalLinks: { linkedin: "" }, role: i.role, accountStatus: "Active", profileVisibility: "Hidden", communicationPreference: "Messages on Skillora" });
      i.invitationStatus = "Accepted";
    });
  },

  async getPublicOrganization(slug) {
    const db = getDb();
    const o = db.organizationWorkspace.organization;
    if (slug !== o.slug || o.profileVisibility !== "Public") return null;
    return { organization: publicOrganization(o), openJobs: companyJobs(db).filter(isJobOpen) };
  },

  async getPublicRecruiter(id) {
    const w = getDb().organizationWorkspace;
    const member = w.recruiters.find((r) => r.id === id);
    if (!member || member.profileVisibility !== "Public" || member.accountStatus !== "Active") return null;
    return { recruiter: publicRecruiter(member), organization: publicOrganization(w.organization) };
  },

  async listInvitations() {
    return getDb().organizationWorkspace.invitations;
  },
};
