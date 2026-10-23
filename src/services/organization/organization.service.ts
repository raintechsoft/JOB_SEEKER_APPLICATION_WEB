import type { Id, Invitation, Job, Organization, OrganizationRole, OrganizationWorkspace, RecruiterMember, Verification } from "@/types/domain";
import type { PublicOrganization, PublicRecruiter } from "@/lib/domain/organization";

export interface OrganizationContext {
  workspace: OrganizationWorkspace;
  currentRecruiter: RecruiterMember;
  canManage: boolean;
  companyJobs: Job[];
  openJobs: Job[];
}

export interface PublicOrganizationView {
  organization: PublicOrganization;
  openJobs: Job[];
}

export interface PublicRecruiterView {
  recruiter: PublicRecruiter;
  organization: PublicOrganization;
}

export type OrgResult = { ok: true } | { ok: false; error: string };

/**
 * Organization management. Roles and permissions here are a front-end demonstration only; the
 * backend must enforce access control.
 */
export interface OrganizationService {
  getContext(): Promise<OrganizationContext>;
  /** Commits the editor draft. Validation is done by the caller with `validateOrganization`. */
  saveOrganization(organization: Organization, verification: Verification, options?: { submitVerification?: boolean }): Promise<boolean>;
  saveRecruiter(member: RecruiterMember): Promise<boolean>;
  invite(input: { fullName: string; email: string; role: OrganizationRole; department: string }): Promise<OrgResult>;
  updateAccess(id: Id, role: OrganizationRole, accountStatus: "Active" | "Inactive"): Promise<OrgResult>;
  cancelInvitation(id: Id): Promise<boolean>;
  remindInvitation(id: Id): Promise<boolean>;
  acceptInvitation(id: Id): Promise<boolean>;
  getPublicOrganization(slug: string): Promise<PublicOrganizationView | null>;
  getPublicRecruiter(id: Id): Promise<PublicRecruiterView | null>;
  listInvitations(): Promise<Invitation[]>;
}
