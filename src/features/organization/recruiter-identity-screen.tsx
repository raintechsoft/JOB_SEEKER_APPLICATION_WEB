"use client";
import {uploadManager} from "@/services/media/upload-manager";

import { PhotoEditor } from "@/components/profile/photo-editor";

import Link from "next/link";
import type { RecruiterMember } from "@/types/domain";
import { recruiterSchema } from "@/lib/validation/organization";
import { validationFields } from "@/lib/validation/profile";
import { useFormAction } from "@/hooks/use-form-action";
import { apiConfig } from "@/services/api/config";

import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, EmptyState, LinkButton } from "@/components/ui/primitives";
import { ScreenError } from "@/components/ui/feedback";
import { AvatarSkeleton, LoadingRegion, Skeleton, TextSkeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/field";
import { OrgArea, OrgCatalogChips, OrgField, OrgSelect, VerifiedCompanyMark } from "@/components/organization/controls";
import { ProfileActionsMenu } from "@/features/profile/profile-actions-menu";
import { recruiterAvatar } from "./team-section";
import { ADMIN_ONLY, useImageUploads, useOrganizationEditor, useRecruiterDraft } from "./use-organization-editor";
import { EditorUpdateNotice } from "@/components/ui/editor-update-notice";
import { devCopy } from "@/lib/env/app-env";

const ROOT = "/recruiter/company";

export function RecruiterIdentityScreen({ memberId }: { memberId?: string }) {
  const uploads = useImageUploads();
  const { query, ctx, errors, setErrors, canManage } = useOrganizationEditor();
  const { execute, pending } = useFormAction(setErrors);
  const id = memberId ?? ctx?.currentRecruiter.id;
  const member = ctx?.workspace.recruiters.find((m) => m.id === id);
  const { draft: r, dirty, update, discard } = useRecruiterDraft(member);
  if (!ctx || (member && !r)) {
    const failed = query.isError && !ctx;
    return (
      <div className="org-workspace org-recruiter-editor">
        <section className="card org-editor-panel">
          {failed ? (
            <ScreenError error={query.error} compact onRetry={() => void query.refetch()} title="Recruiter profile couldn’t load" homeHref={ROOT + "?section=team"} homeLabel="Back to team" />
          ) : (
            <LoadingRegion label="Loading recruiter profile">
              <div className="org-recruiter-identity"><div className="skeleton-identity grow"><AvatarSkeleton /><TextSkeleton lines={2} /></div></div>
              <div className="org-form-grid">{[0, 1, 2, 3].map((i) => <div className="skeleton-lines" key={i}><Skeleton style={{ width: "40%" }} /><Skeleton style={{ height: 46 }} /></div>)}</div>
              <div className="skeleton-lines"><Skeleton style={{ width: "30%" }} /><Skeleton style={{ height: 110 }} /></div>
            </LoadingRegion>
          )}
        </section>
      </div>
    );
  }
  if (!member)
    return (
      <EmptyState
        icon="compass"
        title="Recruiter not found"
        description="This member is not part of your organization."
        action={
          <LinkButton href={ROOT + "?section=team"} variant="primary">
            Back to team
          </LinkButton>
        }
      />
    );
  if (!r) return null; // Unreachable: a member without a draft renders the pending frame above.
  const own = member.id === ctx.currentRecruiter.id;
  const remoteChange = r.version !== member.version;
  const editable = own || canManage;
  const o = ctx.workspace.organization;
  const guard = () => {
    if (!editable) toast(ADMIN_ONLY);
    return editable;
  };
  const photo = () => {
    if (!guard()) return;
    modal.show("Profile photo", <PhotoEditor person={recruiterAvatar(r)} purpose="recruiter_photo" savedMessage="Photo added to your draft. Save Changes to apply it." removedMessage="Photo removed from your draft. Save Changes to apply it." onSave={async file => {
      const current=uploadManager.claimEdit(`${r.id}:avatar`);
      if (!guard()) throw new Error("You cannot edit this profile.");
      const images = await uploads.load([file], uploads.limits.photo, "recruiter_photo");
      if (!images) throw new Error("The photo could not be uploaded. Please try again.");
      if(!current())throw new Error("A newer image change is already in progress.");
      update(d => { d.avatarUrl = images[0].url; });
    }} onRemove={async () => {uploadManager.claimEdit(`${r.id}:avatar`); if (!guard()) throw new Error("You cannot edit this profile."); update(d => { d.avatarUrl = ""; }); }} />, "photo");
  };
  const text = (label: string, name: keyof RecruiterMember, props: { required?: boolean; maxLength?: number } = {}) => <OrgField label={label} name={name} value={String(r[name] ?? "")} error={errors[name]} onValue={(value) => update((d) => void ((d as unknown as Record<string, unknown>)[name] = value))} {...props} />;
  const save = async () => {
    if (remoteChange || !dirty) return;
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
  const copyProfileLink = async () => {
    const url = window.location.origin + "/recruiters/" + member.id;
    try {
      await navigator.clipboard.writeText(url);
      toast(devCopy("Public profile link copied. Local edits stay in this browser.", "Public profile link copied."));
    } catch {
      modal.show("Your public profile link", <TextField label="Copy this link" name="copy" defaultValue={url} readOnly onClick={(ev) => ev.currentTarget.select()} />);
    }
  };
  return (
    <div className="org-workspace org-recruiter-editor">
      <EditorUpdateNotice changed={remoteChange} reload={discard} />
      <section className="card org-editor-panel org-recruiter-identity-card">
        <ProfileActionsMenu
          previewHref={"/recruiter/profile/preview?id=" + member.id}
          onCopy={copyProfileLink}
        />
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
          <div className="org-recruiter-identity">
            <div className="org-recruiter-photo">
              <button type="button" className="profile-avatar-trigger" aria-label="View or edit recruiter profile photo" onClick={photo} disabled={!editable || uploads.busy}>
                <Avatar person={recruiterAvatar(r)} size="xl" />
              </button>
              <Button variant="sm" icon="camera" onClick={photo} disabled={!editable || uploads.busy}>
                Manage photo
              </Button>
            </div>
            <div className="org-recruiter-meta">
              <h2 className="org-recruiter-name">{r.fullName.trim() || "Recruiter"}</h2>
              <p className="org-recruiter-title">
                {[
                  r.jobTitle.trim(),
                  (r.followerCount ?? 0) === 1 ? "1 follower" : `${(r.followerCount ?? 0).toLocaleString()} followers`,
                ].filter(Boolean).join(" · ")}
              </p>
              <p className="org-recruiter-company">
                <Link href={ROOT} className="org-recruiter-company-link">
                  {o.name}
                </Link>
                <VerifiedCompanyMark status={o.verificationStatus} />
              </p>
            </div>
          </div>
          <fieldset className="org-edit-fieldset" disabled={!editable}>
            <div className="org-form-grid">
              {text("Full name", "fullName", { required: true, maxLength: 100 })}
              {text("Professional designation", "jobTitle", { required: true, maxLength: 100 })}
              <OrgSelect label="Personal profile visibility" name="profileVisibility" value={r.profileVisibility} options={["Public", "Hidden"]} onValue={(value) => update((d) => void (d.profileVisibility = value as "Public" | "Hidden"))} />
              <OrgSelect label="Candidate communication preference" name="communicationPreference" value={r.communicationPreference} options={["Messages on Skillora", "Application follow-up only", "Not open to inquiries"]} onValue={(value) => update((d) => void (d.communicationPreference = value))} />
            </div>
            <OrgArea label="Professional introduction" name="professionalBio" value={r.professionalBio} maxLength={1200} onValue={(value) => update((d) => void (d.professionalBio = value))} />
            <OrgCatalogChips
              label="Hiring departments"
              name="hiringDepartments"
              catalog="department"
              values={r.hiringDepartments}
              error={errors.hiringDepartments}
              onChange={(values) => guard() && update((d) => void (d.hiringDepartments = values))}
            />
            <OrgCatalogChips
              label="Hiring locations"
              name="hiringLocations"
              catalog="location"
              values={r.hiringLocations}
              error={errors.hiringLocations}
              onChange={(values) => guard() && update((d) => void (d.hiringLocations = values))}
            />
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
          </div>
        </form>
        <div id="org-upload-status" className="org-upload-status" role="status" aria-label={uploads.busy ? "Uploading image" : undefined} aria-busy={uploads.busy || undefined}>
          {uploads.busy && <Spinner />}
        </div>
        <footer className="org-panel-footer">
          <span id="org-save-state">{dirty ? "Unsaved changes" : devCopy("All changes saved in this browser", "All changes saved")}</span>
          {editable && (
            <>
              <Button
                variant="text sm"
                disabled={!dirty || pending || uploads.busy}
                onClick={() => {
                  if (!dirty) return;
                  discard();
                  setErrors({});
                  toast("Saved recruiter identity restored.");
                }}
              >
                Cancel changes
              </Button>
              <button form="org-recruiter-form" type="submit" className="btn primary sm" disabled={!dirty || remoteChange || pending || uploads.busy}>
                Save Changes
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
