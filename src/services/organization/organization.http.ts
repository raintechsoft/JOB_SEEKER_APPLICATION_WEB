import type { HttpClient } from "../api/client";
import type { AuthService } from "../auth/auth.service";
import type { OrganizationContext, OrganizationService, PublicOrganizationView, PublicRecruiterView } from "./organization.service";
import { organizationSchema, recruiterSchema, verificationSchema } from "@/lib/validation/organization";
import type { OrganizationRole } from "@/types/domain";
import { z } from "zod";
import contract from "../../../../../contracts/validation/organization.json";

const roles = { "Organization Admin": "organization_admin", Recruiter: "recruiter", "Hiring Manager": "hiring_manager" } as const;
export const organizationInviteSchema = z.object({ fullName: z.string().trim().max(100), email: z.string().trim().toLowerCase().max(254).pipe(z.email()), role: z.enum(["Organization Admin", "Recruiter", "Hiring Manager"]), department: z.string().trim().max(100) });
export const organizationAccessSchema = z.object({ role: z.enum(["Organization Admin", "Recruiter", "Hiring Manager"]), accountStatus: z.enum(["Active", "Inactive"]) });
export function createHttpOrganizationService(http: HttpClient, auth: AuthService): OrganizationService {
  const organizationId = async () => {
    const session = await auth.me();
    const workspace = session.workspaces.find((w) => w.id === session.selected_identity_id && w.kind === "recruiter") ?? session.workspaces.find((w) => w.kind === "recruiter");
    if (!workspace?.organization) throw new Error("An active organization workspace is required.");
    return workspace.organization.id;
  };
  const getContext = async () => (await http.get<{ data: OrganizationContext }>(`organizations/${await organizationId()}/profile`)).data;
  return {
    getContext,
    async saveOrganization(organization, verification, options) {
      organizationSchema.parse(organization);
      const submit = options?.submitVerification === true;
      verificationSchema(submit).parse(verification);
      const id = await organizationId();
      const original = (await getContext()).workspace.verification;
      const editable = (v: typeof verification) => ({ ...Object.fromEntries(Object.entries(v).filter(([key]) => !["submittedAt", "reviewNote", "documents"].includes(key))), documents: v.documents.map((d) => d.id) });
      const changed = JSON.stringify(editable(original)) !== JSON.stringify(editable(verification)) || submit;
      const keys = [...Object.keys(contract.fields), ...contract.lists, ...contract.flags, "version", "logoUrl", "coverImageUrl", "workplaceImages", "socialLinks"];
      const data = Object.fromEntries(Object.entries(organization).filter(([key]) => keys.includes(key)));
      const proof = { ...Object.fromEntries(Object.entries(verification).filter(([key]) => Object.hasOwn(contract.verification, key))), documents: verification.documents.map((document) => ({ id: document.id })), submit };
      await http.patch(`organizations/${id}/profile`, { ...data, ...(changed ? { verification: proof } : {}) });
      return true;
    },
    async saveRecruiter(member) {
      recruiterSchema.parse(member);
      await http.patch(`organizations/${await organizationId()}/recruiters/${encodeURIComponent(member.id)}`, member);
      return true;
    },
    async invite(input) {
      const values = organizationInviteSchema.parse(input);
      await http.post(`organizations/${await organizationId()}/invitations`, { email: values.email, role: roles[values.role], full_name: values.fullName, department: values.department });
      return { ok: true };
    },
    async updateAccess(id, role, accountStatus) {
      organizationAccessSchema.parse({ role, accountStatus });
      await auth.updateMember(await organizationId(), id, { role: roles[role as OrganizationRole], status: accountStatus === "Active" ? "active" : "inactive" });
      return { ok: true };
    },
    async cancelInvitation(id) { await http.post(`organizations/${await organizationId()}/invitations/${encodeURIComponent(id)}/cancel`); return true; },
    async remindInvitation(id) { await http.post(`organizations/${await organizationId()}/invitations/${encodeURIComponent(id)}/remind`); return true; },
    async acceptInvitation() { throw new Error("Accept the secure invitation link delivered to the invited email account."); },
    async getPublicOrganization(slug) { return (await http.get<{ data: PublicOrganizationView }>(`public/organizations/${encodeURIComponent(slug)}`)).data; },
    async getPublicRecruiter(id) { return (await http.get<{ data: PublicRecruiterView }>(`public/recruiters/${encodeURIComponent(id)}`)).data; },
    async listInvitations() { return (await getContext()).workspace.invitations; },
  };
}
