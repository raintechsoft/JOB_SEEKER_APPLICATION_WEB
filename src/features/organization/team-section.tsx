"use client";

import { useRef, useState } from "react";
import type { OrganizationRole, RecruiterMember } from "@/types/domain";
import { ORGANIZATION_ROLES } from "@/lib/domain/organization";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { useDismissableDetails } from "@/hooks/use-dismissable";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, LinkButton } from "@/components/ui/primitives";
import { FloatingInput, SelectField, TextField } from "@/components/ui/field";
import { DevOnly } from "@/components/ui/dev-only";
import { useFormAction } from "@/hooks/use-form-action";
import { organizationInviteSchema, organizationAccessSchema } from "@/services/organization/organization.http";
import { validationFields } from "@/lib/validation/profile";
import { devCopy } from "@/lib/env/app-env";

interface TeamRow {
  id: string;
  invitation?: boolean;
  fullName: string;
  workEmail: string;
  jobTitle: string;
  role: OrganizationRole;
  hiringDepartments: string[];
  accountStatus: string;
  avatarUrl?: string;
  profileVisibility?: string;
}

const statusClass = (s: string) => (s === "Active" ? "verified" : s === "Invitation Pending" ? "pending" : "not-started");
export const recruiterAvatar = (r: { id: string; fullName: string; avatarUrl?: string; workEmail?: string }) => ({ id: r.id, name: r.fullName || r.workEmail || "Recruiter", picture: r.avatarUrl || undefined, color: "#E8EDF5" });

function InviteForm({ organizationName }: { organizationName: string }) {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction((fields) => { setErrors(fields); setError(fields._form ?? Object.values(fields).join(" ")); });
  return (
    <form
      id="org-invite-form"
      noValidate
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const email = String(f.get("email") || "").trim();
        const parsed = organizationInviteSchema.safeParse({ fullName: String(f.get("fullName") || "").trim(), email, role: String(f.get("role")), department: String(f.get("department") || "").trim() });
        if (!parsed.success) { setErrors(validationFields(parsed.error)); return; }
        setError(""); setErrors({});
        const ok = await execute(async (s) => { const result = await s.organization.invite(parsed.data); if (!result.ok) throw new Error(result.error); });
        if (!ok) return;
        modal.show(
          devCopy("Invitation created · Simulated", "Invitation created"),
          <div className="org-invitation-success">
            <Icon name="check" />
            <h3>{devCopy("Demo invitation ready", "Invitation ready")}</h3>
            <p>{email.toLowerCase()} is marked Invitation Pending in your team list.</p>
            <DevOnly>
              <p>No email has been sent. Use the invitation’s menu to simulate acceptance.</p>
            </DevOnly>
            <div className="modal-footer">
              <Button variant="primary" onClick={() => modal.close()}>
                Done
              </Button>
            </div>
          </div>,
        );
      }}
    >
      <p className="org-help">Invite a teammate to {organizationName}.{devCopy(" This creates a local invitation record; no email is sent.", "")}</p>
      <TextField label="Full name (optional)" name="fullName" error={errors.fullName} maxLength={100} />
      <TextField label="Work email" name="email" error={errors.email} type="email" required maxLength={150} />
      <SelectField label="Organization role" name="role" error={errors.role} defaultValue="Recruiter" options={[...ORGANIZATION_ROLES]} />
      <TextField label="Hiring department (optional)" name="department" error={errors.department} maxLength={100} />
      <div id="org-invite-error" className="org-field-error" role="alert">
        {error}
      </div>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" loading={pending} disabled={pending} variant="primary" icon="send">
          Send Invitation
        </Button>
      </div>
    </form>
  );
}

function DeactivateMember({ member, role }: { member: RecruiterMember; role: OrganizationRole }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction(setErrors);
  return <>
    <p className="org-help">{member.fullName} will be inactive{devCopy(" in this prototype", "")} and their public recruiter profile will be hidden. You can reactivate them later.</p>
    {Object.keys(errors).length > 0 && <p role="alert">{Object.values(errors).join(" ")}</p>}
    <div className="modal-footer"><Button loading={pending} disabled={pending} onClick={() => modal.close()}>Cancel</Button>
      <Button variant="danger" loading={pending} disabled={pending} onClick={async () => {
        const input = organizationAccessSchema.safeParse({ role, accountStatus: "Inactive" });
        if (!input.success) { setErrors(validationFields(input.error)); return; }
        const ok = await execute(async (s) => { const result = await s.organization.updateAccess(member.id, input.data.role, input.data.accountStatus); if (!result.ok) throw new Error(result.error); });
        if (ok) { modal.close(); toast("Team access updated."); }
      }}>Deactivate recruiter</Button>
    </div>
  </>;
}

function ManageMember({ member, own }: { member: RecruiterMember; own: boolean }) {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction((fields) => { setErrors(fields); setError(fields._form ?? Object.values(fields).join(" ")); });
  const apply = async (role: OrganizationRole, status: "Active" | "Inactive") => {
    const parsed = organizationAccessSchema.safeParse({ role, accountStatus: status });
    if (!parsed.success) { setErrors(validationFields(parsed.error)); return; }
    const ok = await execute(async (s) => { const result = await s.organization.updateAccess(member.id, parsed.data.role, parsed.data.accountStatus); if (!result.ok) throw new Error(result.error); });
    if (!ok) return;
    modal.close();
    toast(devCopy("Prototype team access updated.", "Team access updated."));
  };
  return (
    <form
      id="org-member-form"
      noValidate
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (own) {
          modal.close();
          return toast("Your current admin access is unchanged.");
        }
        const f = new FormData(e.currentTarget);
        const role = String(f.get("role")) as OrganizationRole;
        const status = String(f.get("accountStatus")) as "Active" | "Inactive";
        if (status === "Inactive" && member.accountStatus !== "Inactive") {
          modal.show(
            "Deactivate this recruiter?",
            <DeactivateMember member={member} role={role} />,
          );
          return;
        }
        await apply(role, status);
      }}
    >
      <div className="row">
        <Avatar person={recruiterAvatar(member)} size="lg" />
        <div>
          <h3>{member.fullName}</h3>
          <p className="org-help">{member.workEmail}</p>
        </div>
      </div>
      <SelectField label="Organization role" name="role" error={errors.role} defaultValue={member.role} options={[...ORGANIZATION_ROLES]} disabled={own} />
      <SelectField label="Account status" name="accountStatus" error={errors.accountStatus} defaultValue={member.accountStatus} options={["Active", "Inactive"]} disabled={own} />
      {own ? <p className="org-section-note">Your current admin access cannot be removed from this view.</p> : <p className="org-help">Inactive members are hidden from public recruiter pages.{devCopy(" This is a prototype permission setting.", "")}</p>}
      <div id="org-member-error" className="org-field-error" role="alert">
        {error}
      </div>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" loading={pending} disabled={pending} variant="primary">
          Save access
        </Button>
      </div>
    </form>
  );
}

function RowMenu({ row, admin, own, member }: { row: TeamRow; admin: boolean; own: boolean; member?: RecruiterMember }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(ref, { closeOnAction: true });
  const run = useServiceAction();
  const close = () => ref.current && (ref.current.open = false);
  return (
    <details
      className="org-team-menu"
      ref={ref}
      onToggle={(e) => {
        if (!(e.currentTarget as HTMLDetailsElement).open) return;
        document.querySelectorAll<HTMLDetailsElement>(".org-team-menu[open]").forEach((d) => d !== e.currentTarget && (d.open = false));
      }}
    >
      <summary aria-label={"Actions for " + row.fullName}>
        <Icon name="more" />
      </summary>
      <div>
        {row.invitation ? (
          admin && (
            <>
              <DevOnly>
                <Button
                  variant="text sm"
                  icon="check"
                  onClick={async () => {
                    close();
                    const ok = await run((s) => s.organization.acceptInvitation(row.id));
                    if (ok !== undefined) toast(ok ? "Invitation accepted in the demo. The new recruiter profile starts hidden." : "The sample member could not be saved.");
                  }}
                >
                  Simulate acceptance
                </Button>
                <Button
                  variant="text sm"
                  icon="send"
                  onClick={async () => {
                    const ok = await run((s) => s.organization.remindInvitation(row.id));
                    if (ok !== undefined) toast(ok ? "Demo reminder recorded. No invitation email was sent." : "The reminder could not be saved.");
                  }}
                >
                  Resend demo invite
                </Button>
              </DevOnly>
              <Button
                variant="text sm"
                icon="close"
                onClick={() =>
                  modal.show(
                    devCopy("Cancel this demo invitation?", "Cancel this invitation?"),
                    <>
                      <p className="org-help">This removes the pending invitation from the active team list.{devCopy(" No email is sent.", "")}</p>
                      <div className="modal-footer">
                        <Button onClick={() => modal.close()}>Cancel</Button>
                        <Button
                          variant="danger"
                          onClick={async () => {
                            const ok = await run((s) => s.organization.cancelInvitation(row.id));
                            modal.close();
                            if (ok !== undefined) toast(ok ? devCopy("Demo invitation cancelled.", "Invitation cancelled.") : "Could not save this change.");
                          }}
                        >
                          Confirm
                        </Button>
                      </div>
                    </>,
                  )
                }
              >
                Cancel invitation
              </Button>
            </>
          )
        ) : (
          <>
            <LinkButton href={own ? "/recruiter/profile" : "/recruiter/team/" + row.id} variant="text sm" icon="user">
              {own ? "My recruiter profile" : "Recruiter profile"}
            </LinkButton>
            {admin && member && (
              <Button variant="text sm" icon="settings" onClick={() => modal.show("Manage team access", <ManageMember member={member} own={own} />)}>
                Manage role & status
              </Button>
            )}
            {row.profileVisibility === "Public" && row.accountStatus === "Active" && (
              <LinkButton href={"/recruiters/" + row.id} variant="text sm" icon="external">
                Public profile
              </LinkButton>
            )}
          </>
        )}
      </div>
    </details>
  );
}

export function TeamSection({ admin }: { admin: boolean }) {
  const filter = useUiStore((s) => s.teamFilter);
  const setTeamFilter = useUiStore((s) => s.setTeamFilter);
  const { data: ctx } = useServiceQuery(["organization"], (s) => s.organization.getContext());
  if (!ctx) return null;
  const w = ctx.workspace;
  const pending = w.invitations.filter((i) => i.invitationStatus === "Invitation Pending");
  const records: TeamRow[] = [...w.recruiters, ...pending.map((i) => ({ id: i.id, invitation: true, fullName: i.fullName || "Invited recruiter", workEmail: i.email, jobTitle: "Invitation pending", role: i.role, hiringDepartments: i.hiringDepartment ? [i.hiringDepartment] : [], accountStatus: "Invitation Pending" }))];
  const q = filter.q.toLowerCase();
  const rows = records.filter((r) => (!q || [r.fullName, r.workEmail, r.jobTitle, ...r.hiringDepartments].join(" ").toLowerCase().includes(q)) && (!filter.role || r.role === filter.role) && (!filter.status || r.accountStatus === filter.status));
  return (
    <>
      <div className="org-team-heading">
        <div>
          <h3>{w.recruiters.length} team members</h3>
          <p className="org-help">Manage organization access separately from each recruiter’s public identity.</p>
        </div>
        {admin && (
          <Button variant="primary sm" icon="plus" onClick={() => modal.show("Invite Recruiter", <InviteForm organizationName={w.organization.name} />)}>
            Invite Recruiter
          </Button>
        )}
        <LinkButton href="/recruiter/profile" variant="sm" icon="user">
          My recruiter profile
        </LinkButton>
      </div>
      <div className="org-role-explainer">
        <p>
          <strong>Organization Admin</strong> manages the company and team access.
        </p>
        <p>
          <strong>Recruiter</strong> uses the organization’s hiring features.
        </p>
        <p>
          <strong>Hiring Manager</strong> participates in assigned hiring activities.
        </p>
        <DevOnly>
          <small>These roles demonstrate frontend permissions. They do not provide real authentication or access control.</small>
        </DevOnly>
      </div>
      <div className="org-team-filter">
        <label className="application-search">
          <Icon name="search" />
          <FloatingInput label="Search team members" compact id="org-team-search" type="search" value={filter.q} onChange={(e) => setTeamFilter({ q: e.target.value })} aria-label="Search team members" placeholder="Search name, email, or designation" />
        </label>
        <SelectField label="Filter team role" name="org-team-role" value={filter.role} onChange={(e) => setTeamFilter({ role: e.target.value })} options={[{ value: "", label: "All roles" }, ...ORGANIZATION_ROLES]} />
        <SelectField label="Filter team status" name="org-team-status" value={filter.status} onChange={(e) => setTeamFilter({ status: e.target.value })} options={[{ value: "", label: "All statuses" }, "Active", "Invitation Pending", "Inactive"]} />
      </div>
      <div className="org-table-wrap">
        <table className="org-team-table">
          <thead>
            <tr>
              <th>Recruiter</th>
              <th>Designation</th>
              <th>Role</th>
              <th>Hiring departments</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody id="org-team-rows">
            {rows.length ? (
              rows.map((r) => {
                const own = r.id === ctx.currentRecruiter.id;
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="org-team-person">
                        <Avatar person={recruiterAvatar(r)} />
                        <div>
                          <strong>
                            {r.fullName}
                            {own && (
                              <>
                                {" "}
                                <small>You</small>
                              </>
                            )}
                          </strong>
                          <span>{r.workEmail}</span>
                        </div>
                      </div>
                    </td>
                    <td>{r.jobTitle}</td>
                    <td>
                      <span className="org-role-badge">{r.role}</span>
                    </td>
                    <td>{r.hiringDepartments.join(", ") || "Not assigned"}</td>
                    <td>
                      <span className={"org-status " + statusClass(r.accountStatus)}>{r.accountStatus}</span>
                    </td>
                    <td>
                      <RowMenu row={r} admin={admin} own={own} member={w.recruiters.find((m) => m.id === r.id)} />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6}>
                  <div className="org-inline-empty">
                    <strong>No recruiters match these filters.</strong>
                    <p>Try another name, role, or status.</p>
                    <Button variant="sm" onClick={() => setTeamFilter({ q: "", role: "", status: "" })}>
                      Clear filters
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="org-help">{pending.length} pending {devCopy("demo invitations", "invitations")}. Team emails and internal roles are private to this management view.</p>
    </>
  );
}

