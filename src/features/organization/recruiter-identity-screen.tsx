"use client";

import Link from "next/link";
import type { RecruiterMember } from "@/types/domain";
import { recruiterSchema } from "@/lib/validation/organization";
import { validationFields } from "@/lib/validation/profile";
import { useFormAction } from "@/hooks/use-form-action";
import { apiConfig } from "@/services/api/config";
import { errorMessage } from "@/services/api/client";

import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, EmptyState, LinkButton } from "@/components/ui/primitives";
import { ScreenFallback } from "@/components/ui/feedback";
import { OrgArea, OrgChips, OrgField, OrgSelect } from "@/components/organization/controls";
import { recruiterAvatar } from "./team-section";
import { ADMIN_ONLY, addChips, useImageUploads, useOrganizationEditor, useRecruiterDraft } from "./use-organization-editor";

const ROOT = "/recruiter/company";

export function RecruiterIdentityScreen({ memberId }: { memberId?: string }) {
  const uploads = useImageUploads();
  const { query, ctx, errors, setErrors, canManage } = useOrganizationEditor();
  const { execute, pending } = useFormAction(setErrors);
  const id = memberId ?? ctx?.currentRecruiter.id;
  const member = ctx?.workspace.recruiters.find((m) => m.id === id);
  const { draft: r, update, discard } = useRecruiterDraft(member);
  if (query.isError && !ctx) return <div className="org-workspace"><p role="alert">{errorMessage(query.error)}</p><Button onClick={() => void query.refetch()}>Try again</Button></div>;
  if (!ctx) return <ScreenFallback />;
  if (!member)
    return (
      <EmptyState
        title="Recruiter not found."
        description="This member is not part of your organization."
        action={
          <LinkButton href={ROOT + "?section=team"} variant="primary">
            Back to team
          </LinkButton>
        }
      />
    );
  if (!r) return <ScreenFallback />;
  const own = member.id === ctx.currentRecruiter.id;
  const editable = own || canManage;
  const o = ctx.workspace.organization;
  const guard = () => {
    if (!editable) toast(ADMIN_ONLY);
    return editable;
  };
  const text = (label: string, name: keyof RecruiterMember, props: { required?: boolean; maxLength?: number } = {}) => <OrgField label={label} name={name} value={String(r[name] ?? "")} error={errors[name]} onValue={(value) => update((d) => void ((d as unknown as Record<string, unknown>)[name] = value))} {...props} />;
  const save = async () => {
    if (!editable) return toast("You can edit your own recruiter profile only.");
    if (uploads.busy || pending) return toast("Wait for the profile photo to finish loading.");
    const e: Record<string, string> = {};
    if (!r.fullName.trim()) e.fullName = "Add the recruiter’s full name.";
    if (!r.jobTitle.trim()) e.jobTitle = "Add a professional designation.";
    if (apiConfig.dataSource === "http") { const parsed = recruiterSchema.safeParse(r); if (!parsed.success) Object.assign(e, validationFields(parsed.error)); }
    setErrors(e);
    if (Object.keys(e).length) return;
    const ok = await execute((s) => s.organization.saveRecruiter(r));
    if (!ok) return;
    discard();
    toast("Recruiter identity saved. Organization details were not changed.");
  };
  return (
    <div className="org-workspace org-recruiter-editor">
      <nav className="org-breadcrumb" aria-label="Breadcrumb">
        <Link href={ROOT}>Organization</Link>
        <Icon name="chevron" />
        <Link href={ROOT + "?section=team"}>Team & Recruiters</Link>
        <Icon name="chevron" />
        <span>Recruiter identity</span>
      </nav>
      <header className="org-page-header">
        <div>
          <h1>{own ? "My Recruiter Profile" : "Recruiter Profile"}</h1>
          <p>Your personal hiring identity, associated with {o.name}.</p>
        </div>
        <div className="org-page-actions">
          <LinkButton href={"/recruiter/profile/preview?id=" + member.id} variant="sm" icon="eye">
            Preview Profile
          </LinkButton>
          <button form="org-recruiter-form" type="submit" className="btn primary sm" disabled={!editable || pending || uploads.busy}>
            Save Changes
          </button>
        </div>
      </header>
      <section className="card org-editor-panel">
        {Object.keys(errors).length > 0 && (
          <p className="org-error-summary" role="alert">
            {Object.values(errors).join(" ")}
          </p>
        )}
        <form
          id="org-recruiter-form"
          noValidate
          className="org-form"
          data-id={member.id}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="org-linked-company">
            {o.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded logo data URL
              <img src={o.logoUrl} alt={o.name + " logo"} />
            ) : (
              <Icon name="building" />
            )}
            <div>
              <span>Organization association</span>
              <LinkButton href={ROOT} variant="text sm" icon="arrow">
                {o.name}
              </LinkButton>
            </div>
            <small>Managed centrally by organization admins</small>
          </div>
          <fieldset className="org-edit-fieldset" disabled={!editable}>
            <div className="org-recruiter-photo">
              <Avatar person={recruiterAvatar(r)} size="xl" />
              <div>
                <h3>Profile photo</h3>
                <p className="org-help">PNG, JPEG or WebP, up to 500 KB. Public when your recruiter profile is visible.</p>
                <div className="row wrap gap8">
                  <label className="btn sm org-file-button">
                    <Icon name="upload" />
                    {r.avatarUrl ? "Replace photo" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file || !guard()) return;
                        const images = await uploads.load([file], uploads.limits.photo, "recruiter_photo");
                        if (images) update((d) => void (d.avatarUrl = images[0].url));
                      }}
                    />
                  </label>
                  {r.avatarUrl && (
                    <Button
                      variant="text sm"
                      icon="trash"
                      onClick={() =>
                        guard() &&
                        modal.show(
                          "Remove this profile photo?",
                          <>
                            <p className="org-help">Save the recruiter profile to apply this change.</p>
                            <div className="modal-footer">
                              <Button onClick={() => modal.close()}>Cancel</Button>
                              <Button
                                variant="danger"
                                onClick={() => {
                                  update((d) => void (d.avatarUrl = ""));
                                  modal.close();
                                }}
                              >
                                Confirm
                              </Button>
                            </div>
                          </>,
                        )
                      }
                    >
                      Remove photo
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="org-form-grid">
              {text("Full name", "fullName", { required: true, maxLength: 100 })}
              {text("Professional designation", "jobTitle", { required: true, maxLength: 100 })}
              <OrgSelect label="Personal profile visibility" name="profileVisibility" value={r.profileVisibility} options={["Public", "Hidden"]} onValue={(value) => update((d) => void (d.profileVisibility = value as "Public" | "Hidden"))} />
              <OrgSelect label="Candidate communication preference" name="communicationPreference" value={r.communicationPreference} options={["Messages on Skillora", "Application follow-up only", "Not open to inquiries"]} onValue={(value) => update((d) => void (d.communicationPreference = value))} />
            </div>
            <OrgArea label="Professional introduction" name="professionalBio" value={r.professionalBio} maxLength={1200} onValue={(value) => update((d) => void (d.professionalBio = value))} />
            {(["hiringDepartments", "hiringLocations"] as const).map((key) => (
              <OrgChips key={key} label={key === "hiringDepartments" ? "Hiring departments" : "Hiring locations"} name={key} scope="recruiter" values={r[key]} onAdd={(raw) => guard() && update((d) => void (d[key] = addChips(d[key], raw)))} onRemove={(i) => guard() && update((d) => void d[key].splice(i, 1))} />
            ))}
            <OrgField label="Public LinkedIn URL" name="professionalLinks.linkedin" type="url" maxLength={250} value={r.professionalLinks.linkedin} error={errors["professionalLinks.linkedin"]} onValue={(value) => update((d) => void (d.professionalLinks.linkedin = value))} />
          </fieldset>
          <div className="org-private-contact">
            <span>
              <Icon name="shield" />
              Private account details
            </span>
            <p>
              Work email: <strong>{r.workEmail}</strong>
            </p>
            <p>
              <span className="org-role-badge">{r.role}</span> <span className={"org-status " + (r.accountStatus === "Active" ? "verified" : "not-started")}>{r.accountStatus}</span>
            </p>
            <small>Account email, internal role, and account status are excluded from public profiles. Admins manage team access in Team & Recruiters.</small>
          </div>
        </form>
        <div id="org-upload-status" className="org-upload-status" role="status">
          {uploads.busy ? "Loading selected image…" : ""}
        </div>
        <footer className="org-panel-footer">
          <span>Changes apply to this recruiter’s identity only.</span>
          {editable && (
            <>
              <Button
                variant="text sm"
                onClick={() => {
                  discard();
                  setErrors({});
                  toast("Saved recruiter identity restored.");
                }}
              >
                Cancel changes
              </Button>
              <button form="org-recruiter-form" type="submit" className="btn primary sm">
                Save Changes
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
