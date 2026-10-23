"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Organization, Verification, VerificationStatus } from "@/types/domain";
import { errorSection, isOrganizationSection, ORGANIZATION_SECTION_DESCRIPTIONS, ORGANIZATION_SECTIONS, organizationCompletion, validateOrganization, VERIFICATION_NEXT_STEP, type OrganizationSection } from "@/lib/domain/organization";
import { formatLocaleDate } from "@/lib/utils/date";
import { MB } from "@/lib/utils/files";
import { useState } from "react";
import { useFormAction } from "@/hooks/use-form-action";
import { organizationSchema, verificationSchema } from "@/lib/validation/organization";
import { validateMedia, validationFields } from "@/lib/validation/profile";
import { apiConfig } from "@/services/api/config";
import { errorMessage } from "@/services/api/client";
import { uid } from "@/lib/utils/id";
import { isValidEmail, safeUrl } from "@/lib/utils/url";
import { useServiceAction, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button, IconButton, LinkButton } from "@/components/ui/primitives";
import { SelectField } from "@/components/ui/field";
import { ScreenFallback } from "@/components/ui/feedback";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { OrgArea, OrgCheck, OrgChips, OrgChoices, OrgField, OrgImageUpload, OrgPublicHint, OrgSelect, VerificationBadge } from "@/components/organization/controls";
import { useJobActions } from "@/features/feed/job-dialogs";
import { addChips, useImageUploads, useOrganizationEditor } from "./use-organization-editor";
import { TeamSection } from "./team-section";

const ROOT = "/recruiter/company";
const SECTION_ICONS: Record<OrganizationSection, IconName> = { overview: "building", about: "file", culture: "users", hiring: "briefcase", verification: "shield", team: "user", contact: "settings" };
const VERIFICATION_LABELS: Record<string, string> = { registrationName: "the registered business name", registrationNumber: "the registration number", jurisdiction: "the jurisdiction", representative: "the authorized representative", representativeTitle: "the representative designation", businessEmail: "the business email", website: "the business website" };

function confirmDanger(title: string, body: string, onConfirm: () => void) {
  modal.show(
    title,
    <>
      <p className="org-help">{body}</p>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>
          Confirm
        </Button>
      </div>
    </>,
  );
}

export function OrganizationEditorScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const run = useServiceAction();
  const jobs = useJobActions();
  const uploads = useImageUploads();
  const editor = useOrganizationEditor();
  const { query, ctx, draft, dirty, errors, setErrors, canManage, guard, setOrg, updateOrganization, discardOrganization } = editor;
  const { execute, pending } = useFormAction(setErrors);
  const services = useServices();
  const [documentBusy, setDocumentBusy] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const key: OrganizationSection = isOrganizationSection(params.get("section")) ? (params.get("section") as OrganizationSection) : "overview";

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>("[aria-current=page]");
    if (nav && active && matchMedia("(max-width:680px)").matches) nav.scrollLeft += active.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - active.clientWidth) / 2;
  }, [key]);

  if (query.isError && !ctx) return <div className="org-workspace"><p role="alert">{errorMessage(query.error)}</p><Button onClick={() => void query.refetch()}>Try again</Button></div>;
  if (!ctx || !draft) return <ScreenFallback />;
  const o = draft.organization;
  const v = draft.verification;
  const completion = organizationCompletion(o);
  const go = (section: OrganizationSection) => {
    setErrors({});
    router.push(ROOT + "?section=" + section);
  };
  const field = (label: string, name: keyof Organization, props: { type?: string; required?: boolean; maxLength?: number; pattern?: string; min?: number; max?: number } = {}) => <OrgField label={label} name={name} value={String(o[name] ?? "")} error={errors[name]} onValue={(value) => setOrg((d) => void ((d as unknown as Record<string, unknown>)[name] = value))} {...props} />;
  const area = (label: string, name: keyof Organization, props: { required?: boolean; maxLength?: number; placeholder?: string } = {}) => <OrgArea label={label} name={name} value={String(o[name] ?? "")} error={errors[name]} onValue={(value) => setOrg((d) => void ((d as unknown as Record<string, unknown>)[name] = value))} {...props} />;
  const select = (label: string, name: keyof Organization, options: string[], required = false) => <OrgSelect label={label} name={name} value={String(o[name] ?? "")} error={errors[name]} required={required} options={options} onValue={(value) => setOrg((d) => void ((d as unknown as Record<string, unknown>)[name] = value))} />;
  const chips = (label: string, name: "expertiseAreas" | "workplaceLocations" | "benefits" | "hiringDepartments" | "hiringLocations") => (
    <OrgChips
      label={label}
      name={name}
      scope="organization"
      values={o[name]}
      onAdd={(raw) => guard() && setOrg((d) => void (d[name] = addChips(d[name], raw)))}
      onRemove={(i) => guard() && setOrg((d) => void d[name].splice(i, 1))}
    />
  );
  const check = (label: string, name: "showPublicContact" | "showCareers" | "acceptInquiries" | "notifyApplications" | "notifyTeam" | "weeklyDigest", hint?: string) => <OrgCheck label={label} checked={o[name]} hint={hint} onChange={(value) => setOrg((d) => void (d[name] = value))} />;
  const vField = (label: string, name: keyof Verification, type = "text", maxLength = 150) => <OrgField label={label} name={name} type={type} maxLength={maxLength} value={String(v[name] ?? "")} error={errors[name]} onValue={(value) => updateOrganization((d) => void ((d.verification as unknown as Record<string, unknown>)[name] = value))} />;

  const uploadImage = async (kind: "logoUrl" | "coverImageUrl", file: File) => {
    if (!guard()) return;
    const images = await uploads.load([file], kind === "logoUrl" ? uploads.limits.logo : uploads.limits.cover, kind === "logoUrl" ? "logo" : "cover");
    if (images) setOrg((d) => void (d[kind] = images[0].url));
  };
  const uploadGallery = async (files: File[], replace?: number) => {
    if (!guard() || !files.length) return;
    const existing = o.workplaceImages.reduce((n, im, i) => n + (replace === i ? 0 : im.bytes || 0), 0);
    if ((replace === undefined && files.length + o.workplaceImages.length > 4) || existing + files.reduce((n, f) => n + f.size, 0) > 1.5 * MB) return toast("Use up to four workplace images, totaling 1.5 MB or less.");
    const images = await uploads.load(files, uploads.limits.gallery);
    if (images) setOrg((d) => (replace === undefined ? void d.workplaceImages.push(...images) : void (d.workplaceImages[replace] = images[0])));
  };

  const save = async () => {
    if (!canManage) return toast("Organization admin access is required.");
    if (uploads.busy || documentBusy || pending) return toast("Wait for the selected image to finish loading.");
    const parsed = apiConfig.dataSource === "http" ? organizationSchema.safeParse(o) : null;
    const proof = apiConfig.dataSource === "http" ? verificationSchema(false).safeParse(v) : null;
    const e = { ...validateOrganization(o), ...(parsed && !parsed.success ? validationFields(parsed.error) : {}), ...(proof && !proof.success ? validationFields(proof.error) : {}) };
    setErrors(e);
    if (Object.keys(e).length) {
      router.push(ROOT + "?section=" + errorSection(e));
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    const organization = o.verificationStatus === "Not started" && JSON.stringify(v) !== JSON.stringify(ctx.workspace.verification) ? { ...o, verificationStatus: "In progress" as VerificationStatus } : o;
    const ok = await execute((s) => s.organization.saveOrganization(organization, v));
    if (!ok) return;
    discardOrganization();
    toast(devCopy("Organization profile saved in this browser.", "Organization profile saved."));
  };

  const submitVerification = async () => {
    if (!guard() || uploads.busy || documentBusy || pending) return;
    const e: Record<string, string> = {};
    for (const k of Object.keys(VERIFICATION_LABELS) as (keyof Verification)[]) if (!String(v[k]).trim()) e[k] = "Complete " + VERIFICATION_LABELS[k] + ".";
    if (v.businessEmail && !isValidEmail(v.businessEmail)) e.businessEmail = "Use a valid business email.";
    if (v.website && !safeUrl(v.website)) e.website = "Use a complete HTTP or HTTPS website URL.";
    if (apiConfig.dataSource === "http") { const parsed = verificationSchema(true).safeParse(v); if (!parsed.success) Object.assign(e, validationFields(parsed.error)); }
    if (Object.keys(e).length) return setErrors(e);
    const parsedOrg = apiConfig.dataSource === "http" ? organizationSchema.safeParse(o) : null;
    const orgErrors = { ...validateOrganization(o), ...(parsedOrg && !parsedOrg.success ? validationFields(parsedOrg.error) : {}) };
    if (Object.keys(orgErrors).length) {
      setErrors(orgErrors);
      return router.push(ROOT + "?section=" + errorSection(orgErrors));
    }
    setErrors({});
    const ok = await execute((s) => s.organization.saveOrganization({ ...o, verificationStatus: "Pending review" }, { ...v, submittedAt: new Date().toISOString(), reviewNote: devCopy("Your demo request is queued. No external review has been started.", "Your request is queued for review.") }, { submitVerification: true }));
    if (!ok) return;
    discardOrganization();
    toast(devCopy("Demo verification request saved as Pending review. No real verification occurred.", "Verification request submitted for review."));
  };

  const applyOutcome = async (outcome: string) => {
    if (!guard()) return;
    if (!v.submittedAt) return toast("Submit a demo verification request first.");
    if (!["Pending review", "Verified", "Action required"].includes(outcome)) return;
    const note = outcome === "Verified" ? "Simulated review approved. This is a fictional demo verification." : outcome === "Action required" ? "Demo reviewer: clarify the registration details, then resubmit." : "Waiting for a simulated review.";
    const ok = await run((s) => s.organization.saveOrganization({ ...o, verificationStatus: outcome as VerificationStatus }, { ...v, reviewNote: note }));
    if (ok === undefined) return;
    if (!ok) return toast("Browser storage is full. The outcome has not been saved.");
    discardOrganization();
    toast("Sample review state updated. No real company was verified.");
  };

  const sections: Record<OrganizationSection, () => ReactNode> = {
    overview: () => (
      <>
        <OrgPublicHint />
        <div className="org-upload-pair">
          <OrgImageUpload label="Organization logo" kind="logoUrl" value={o.logoUrl} onFile={(f) => uploadImage("logoUrl", f)} onRemove={() => guard() && confirmDanger("Remove this image?", "The image will be removed from your draft. Save Changes to update the public profile.", () => (setOrg((d) => void (d.logoUrl = "")), modal.close()))} />
          <OrgImageUpload label="Cover image" kind="coverImageUrl" value={o.coverImageUrl} onFile={(f) => uploadImage("coverImageUrl", f)} onRemove={() => guard() && confirmDanger("Remove this image?", "The image will be removed from your draft. Save Changes to update the public profile.", () => (setOrg((d) => void (d.coverImageUrl = "")), modal.close()))} />
        </div>
        <div className="org-form-grid">
          {field("Organization name", "name", { required: true, maxLength: 100 })}
          {field("Public profile slug", "slug", { required: true, maxLength: 80, pattern: "[a-z0-9]+(-[a-z0-9]+)*" })}
          {field("Industry", "industry", { required: true, maxLength: 100 })}
          {select("Organization type", "organizationType", ["Privately held", "Public company", "Nonprofit", "Government", "Partnership", "Self-employed", "Other"])}
          {select("Company size", "companySize", ["", "1–10 employees", "11–50 employees", "51–200 employees", "201–500 employees", "501–1,000 employees", "1,001–5,000 employees", "5,001+ employees"], true)}
          {field("Founding year", "foundingYear", { type: "number", min: 1800, max: new Date().getFullYear() })}
          {field("Headquarters country", "headquartersCountry", { required: true, maxLength: 80 })}
          {field("Headquarters city", "headquartersCity", { required: true, maxLength: 80 })}
          {field("Website URL", "websiteUrl", { type: "url", maxLength: 250 })}
        </div>
        {field("Short company tagline", "tagline", { maxLength: 140 })}
        {area("Company description", "description", { required: true, maxLength: 1200 })}
      </>
    ),
    about: () => (
      <>
        <OrgPublicHint />
        {area("Company overview", "overview", { maxLength: 2000, placeholder: "Introduce the work you do and the people you serve." })}
        <div className="org-form-grid">
          {area("Mission", "mission", { maxLength: 600 })}
          {area("Vision", "vision", { maxLength: 600 })}
        </div>
        {area("Products and services", "productsAndServices", { maxLength: 1200, placeholder: "Describe your main products and services." })}
        {chips("Areas of expertise", "expertiseAreas")}
        {area("Company culture", "cultureDescription", { maxLength: 1200 })}
        {area("What candidates can expect", "candidateExpectations", { maxLength: 1200 })}
        <aside className="org-inline-preview">
          <span>PUBLIC PROFILE SNAPSHOT</span>
          <h3>{o.name}</h3>
          <p id="org-about-snapshot">{o.overview || o.description || "Add an overview to introduce your organization."}</p>
        </aside>
      </>
    ),
    culture: () => (
      <>
        <OrgPublicHint />
        {area("Work environment", "workEnvironment", { maxLength: 1200 })}
        <OrgChoices label="Work modes" options={["On-site", "Hybrid", "Remote"]} chosen={o.workModes} onChange={(values) => setOrg((d) => void (d.workModes = values))} />
        {chips("Workplace locations", "workplaceLocations")}
        <div className="org-gallery-block">
          <div className="row between wrap">
            <h3>Workplace gallery</h3>
            <label className="btn sm org-file-button">
              <Icon name="plus" />
              Add images
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                hidden
                disabled={o.workplaceImages.length >= 4}
                onChange={(e) => {
                  void uploadGallery([...(e.target.files || [])]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="org-help">Up to 4 images, 500 KB each and 1.5 MB total. {devCopy("Public gallery; files stay in this browser.", "Shown in your public gallery.")}</p>
          {o.workplaceImages.length ? (
            <div className="org-gallery">
              {o.workplaceImages.map((im, i) => (
                <figure key={im.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded data URL */}
                  <img src={im.url} alt={im.alt} />
                  <figcaption>
                    <span>{im.alt}</span>
                    <div>
                      <label className="iconbtn org-file-button" aria-label={"Replace workplace image " + (i + 1)}>
                        <Icon name="edit" />
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          hidden
                          onChange={(e) => {
                            void uploadGallery([...(e.target.files || [])], i);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <IconButton icon="trash" label={"Remove workplace image " + (i + 1)} onClick={() => guard() && confirmDanger("Remove workplace image?", "This removes the selected image from your unsaved gallery.", () => (setOrg((d) => void d.workplaceImages.splice(i, 1)), modal.close()))} />
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="org-inline-empty">
              <Icon name="image" />
              <strong>Show candidates where your team works.</strong>
              <p>Add office or team images to your public gallery.</p>
            </div>
          )}
        </div>
        {chips("Benefits and perks", "benefits")}
        {area("Team activities and culture highlights", "cultureHighlights", { maxLength: 1200 })}
      </>
    ),
    hiring: () => (
      <>
        <OrgPublicHint />
        <div className="org-form-grid">
          {select("Hiring status", "hiringStatus", ["Actively hiring", "Open to future talent", "Not currently hiring"])}
          {field("Careers page URL", "careersUrl", { type: "url", maxLength: 250 })}
        </div>
        {chips("Hiring departments", "hiringDepartments")}
        {chips("Hiring locations", "hiringLocations")}
        <OrgChoices label="Preferred employment types" options={["Full-time", "Part-time", "Contract", "Internship"]} chosen={o.employmentTypes} onChange={(values) => setOrg((d) => void (d.employmentTypes = values))} />
        {field("Application contact email (private)", "applicationContact", { type: "email", maxLength: 150 })}
        <p className="org-help">For your team’s reference. Candidates apply through the existing job flow; this does not forward applications by email.</p>
        <section className="org-open-jobs">
          <div className="row between wrap">
            <div>
              <h3>Open positions</h3>
              <p className="org-help">
                {ctx.openJobs.length} active · {ctx.companyJobs.filter((j) => j.draft).length} drafts. Uses your existing job posts.
              </p>
            </div>
            <LinkButton href="/recruiter/applications" variant="sm" icon="briefcase">
              Manage jobs
            </LinkButton>
          </div>
          {ctx.openJobs.length ? (
            ctx.openJobs.map((j) => (
              <article key={j.id}>
                <div>
                  <h4>{j.title}</h4>
                  <p>
                    {j.location} · {j.employment}
                  </p>
                </div>
                <span className="org-status verified">Active</span>
                <Button variant="text sm" icon="eye" onClick={() => jobs.view(j.id, "organization")}>
                  View
                </Button>
                <LinkButton href={"/recruiter/jobs/new?id=" + j.id} variant="text sm" icon="edit">
                  Manage
                </LinkButton>
              </article>
            ))
          ) : (
            <div className="org-inline-empty">
              <Icon name="briefcase" />
              <strong>No active positions right now.</strong>
              <p>Create a job to start building your hiring presence.</p>
              <LinkButton href="/recruiter/jobs/new" variant="primary sm" icon="plus">
                Post a job
              </LinkButton>
            </div>
          )}
        </section>
      </>
    ),
    verification: () =>
      !canManage ? (
        <div className="org-inline-empty">
          <Icon name="shield" />
          <strong>Verification is managed by organization admins.</strong>
          <p>Private registration and representative details are not shown to this role.</p>
          <VerificationBadge status={o.verificationStatus} />
        </div>
      ) : (
        <>
          <div className="org-verification-status">
            <VerificationBadge status={o.verificationStatus} />
            <h3>{VERIFICATION_NEXT_STEP[o.verificationStatus]}</h3>
            {v.reviewNote && <p>{v.reviewNote}</p>}
            {v.submittedAt && (
              <p>
                Submitted {formatLocaleDate(v.submittedAt)}
                {devCopy(" · Demo only", "")}
              </p>
            )}
          </div>
          <div className="org-verification-benefits">
            <h3>Why verification matters</h3>
            <p>It gives candidates context about the organization behind a hiring post.{devCopy(" This prototype demonstrates the review process without validating real businesses.", "")}</p>
          </div>
          <div className="org-section-note private">
            <Icon name="shield" />
            Private administration details. Never included in public profile previews.
          </div>
          <div className="org-form-grid">
            {vField("Registered business name", "registrationName")}
            {vField("Business registration number", "registrationNumber", "text", 100)}
            {vField("Registration country / jurisdiction", "jurisdiction", "text", 100)}
            {vField("Authorized representative", "representative", "text", 100)}
            {vField("Representative designation", "representativeTitle", "text", 100)}
            {vField("Business email", "businessEmail", "email")}
            {vField("Business website", "website", "url", 250)}
          </div>
          <div className="org-check-status">
            <span>
              <Icon name="globe" />
              Website verification
            </span>
            <strong>Not independently verified</strong>
            <span>
              <Icon name="mail" />
              Business email verification
            </span>
            <strong>Not independently verified</strong>
          </div>
          <div className="org-proof-files">
            <h3>
              Supporting document references <span className="org-private-label">Private</span>
            </h3>
            <p className="org-help">PDF, PNG or JPEG, up to 2 MB. Attach at least one document to submit.{devCopy(" Only file names are recorded for this demo. File contents are not uploaded or stored.", "")}</p>
            <label className="btn sm org-file-button">
              <Icon name="file" />
              Select a document
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                hidden
                disabled={v.documents.length >= 5 || documentBusy || pending}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file || !guard()) return;
                  const error = validateMedia(file, "business_document");
                  if (error) return setErrors({ documents: error });
                  if (v.documents.length >= 5) return setErrors({ documents: "Use up to five documents." });
                  setDocumentBusy(true);
                  try {
                    const asset = apiConfig.dataSource === "http" ? await services.media.upload(file, "business_document", o.id) : { id: uid() };
                    updateOrganization((d) => void d.verification.documents.push({ id: asset.id, name: file.name, size: file.size, type: file.type }));
                    setErrors({});
                  } catch (error) { setErrors({ documents: errorMessage(error) }); }
                  finally { setDocumentBusy(false); }
                }}
              />
            </label>
            {v.documents.map((doc, i) => (
              <div className="org-proof-reference" key={doc.id}>
                <Icon name="file" />
                <span>
                  {doc.name} · {Math.ceil(doc.size / 1024)} KB
                </span>
                <Button variant="text sm" icon="trash" onClick={() => guard() && updateOrganization((d) => void d.verification.documents.splice(i, 1))}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <div className="row wrap org-verification-actions">
            <Button variant="primary sm" icon="shield" onClick={submitVerification} disabled={pending || documentBusy || uploads.busy}>
              {o.verificationStatus === "Action required" ? devCopy("Resubmit demo request", "Resubmit for review") : devCopy("Submit demo request", "Submit for review")}
            </Button>
            <DevOnly>{o.verificationStatus === "Pending review" && <span className="org-help">No external review service is connected.</span>}</DevOnly>
          </div>
          <DevOnly>
            <details className="org-demo-review">
              <summary>Prototype review controls</summary>
              <p>Explicit sample outcomes for testing these screens. Selecting Verified creates a “Verified · Demo” badge and does not verify a real company.</p>
              <div className="row wrap">
                <SelectField label="Sample review outcome" name="demoOutcome" id="org-demo-outcome" defaultValue={["Pending review", "Verified", "Action required"].includes(o.verificationStatus) ? o.verificationStatus : "Pending review"} options={["Pending review", "Verified", "Action required"]} />
                <Button variant="sm" icon="check" onClick={() => applyOutcome((document.getElementById("org-demo-outcome") as HTMLSelectElement).value)}>
                  Apply sample outcome
                </Button>
              </div>
            </details>
          </DevOnly>
        </>
      ),
    team: () => <TeamSection admin={canManage} />,
    contact: () => (
      <>
        <div className="org-section-note">
          <Icon name="globe" />
          Public contact details are separate from recruiter account emails.
        </div>
        <div className="org-form-grid">
          {field("Public contact email", "publicContactEmail", { type: "email", maxLength: 150 })}
          {field("Public phone (optional)", "publicPhone", { type: "tel", maxLength: 25 })}
          <OrgField label="Public LinkedIn URL" name="socialLinks.linkedin" type="url" maxLength={250} value={o.socialLinks.linkedin} error={errors["socialLinks.linkedin"]} onValue={(value) => setOrg((d) => void (d.socialLinks.linkedin = value))} />
          <OrgField label="Other public social URL" name="socialLinks.other" type="url" maxLength={250} value={o.socialLinks.other} error={errors["socialLinks.other"]} onValue={(value) => setOrg((d) => void (d.socialLinks.other = value))} />
          {field("Careers page URL", "careersUrl", { type: "url", maxLength: 250 })}
          {select("Organization profile visibility", "profileVisibility", ["Public", "Hidden"])}
        </div>
        <div className="org-setting-group">
          <h3>Public profile controls</h3>
          {check("Show public contact information", "showPublicContact")}
          {check("Show careers page link", "showCareers")}
        </div>
        <div className="org-setting-group">
          <h3>Private communication preferences</h3>
          {check("Open to candidate inquiries", "acceptInquiries", devCopy("A prototype preference; it does not send or block real messages.", undefined))}
          {check("New application notifications", "notifyApplications")}
          {check("Team and invitation updates", "notifyTeam")}
          {check("Weekly hiring digest", "weeklyDigest")}
        </div>
        <DevOnly>
          <p className="org-help">Notification preferences are saved locally. No emails or notifications are delivered.</p>
        </DevOnly>
      </>
    ),
  };

  const openCompletion = () =>
    modal.show(
      "Organization profile completion",
      <div className="org-completion-dialog">
        <strong>{completion.percent}% complete</strong>
        <p>Recommended profile information; a logo is encouraged, not required to save.</p>
        {completion.items.map(([, label, done, section]) => (
          <div key={label}>
            <Icon name={done ? "check" : "help"} />
            <span>
              {label}
              {done ? " · Added" : " · Recommended"}
            </span>
            {!done && (
              <Button
                variant="text sm"
                icon="arrow"
                onClick={() => {
                  modal.close();
                  go(section);
                }}
              >
                Add
              </Button>
            )}
          </div>
        ))}
      </div>,
    );

  return (
    <div className="org-workspace">
      <nav className="org-breadcrumb" aria-label="Breadcrumb">
        <Link href="/recruiter/dashboard">Dashboard</Link>
        <Icon name="chevron" />
        <Link href={ROOT}>Organization</Link>
        <Icon name="chevron" />
        <span>Profile</span>
      </nav>
      <header className="org-page-header">
        <div>
          <h1>Organization Profile</h1>
          <p>Manage your company’s identity and hiring presence on Skillora.</p>
        </div>
        <div className="org-page-actions">
          <LinkButton href={ROOT + "/preview?section=" + key} variant="sm" icon="eye">
            Preview Profile
          </LinkButton>
          <button className="btn primary sm" type="submit" form="organization-form" disabled={!canManage || pending || documentBusy || uploads.busy}>
            <Icon name="check" />
            Save Changes
          </button>
        </div>
      </header>
      <section className="card org-summary" id="org-summary">
        <div className="org-summary-main">
          <span className="org-summary-logo">
            {o.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded logo data URL
              <img src={o.logoUrl} alt={o.name + " logo"} />
            ) : (
              <Icon name="building" />
            )}
          </span>
          <div>
            <div className="row wrap">
              <h2>{o.name || "Your organization"}</h2>
              <VerificationBadge status={o.verificationStatus} />
            </div>
            <p>
              {o.industry || "Add industry"} <span>·</span> {[o.headquartersCity, o.headquartersCountry].filter(Boolean).join(", ") || "Add headquarters"}
            </p>
            {safeUrl(o.websiteUrl) ? (
              <a href={safeUrl(o.websiteUrl)} target="_blank" rel="noopener">
                <Icon name="globe" />
                {o.websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <span className="org-help">Website not added</span>
            )}
          </div>
        </div>
        <div className="org-summary-progress">
          <button type="button" onClick={openCompletion}>
            <strong>{completion.percent}%</strong>
            <span>
              profile complete <Icon name="chevron" />
            </span>
          </button>
          <div className="org-progress" role="progressbar" aria-label="Organization profile completion" aria-valuenow={completion.percent} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: completion.percent + "%" }} />
          </div>
          <small>
            {completion.items.filter((i) => i[2]).length} of {completion.items.length} recommended items added
          </small>
        </div>
      </section>
      <div className="org-editor-layout">
        <aside className="card org-sidebar">
          <span className="org-sidebar-label">ORGANIZATION MANAGEMENT</span>
          <nav aria-label="Organization profile sections" ref={navRef}>
            {(Object.entries(ORGANIZATION_SECTIONS) as [OrganizationSection, string][]).map(([id, title]) => (
              <button type="button" key={id} onClick={() => go(id)} className={key === id ? "active" : ""} aria-current={key === id ? "page" : undefined}>
                <Icon name={SECTION_ICONS[id]} />
                <span>{title}</span>
                <Icon name="chevron" />
              </button>
            ))}
          </nav>
          <div className="org-sidebar-personal">
            <Icon name="user" />
            <p>Your personal identity is separate from the organization.</p>
            <LinkButton href="/recruiter/profile" variant="text sm" icon="arrow">
              My recruiter profile
            </LinkButton>
          </div>
        </aside>
        <section className="card org-editor-panel">
          <header className="org-panel-heading">
            <div>
              <h2>{ORGANIZATION_SECTIONS[key]}</h2>
              <p>{ORGANIZATION_SECTION_DESCRIPTIONS[key]}</p>
            </div>
            <DevOnly>
              <span className="org-data-tag">Demo data</span>
            </DevOnly>
          </header>
          {!canManage && (
            <p className="org-section-note">
              <Icon name="shield" />
              Organization settings are read-only for your role. An organization admin manages changes and team access.
            </p>
          )}
          {Object.keys(errors).length > 0 && (
            <div className="org-error-summary" role="alert">
              <strong>Check the highlighted details.</strong>
              <p>{[...new Set(Object.values(errors))].join(" ")}</p>
            </div>
          )}
          <form
            id="organization-form"
            noValidate
            className="org-form"
            data-section={key}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset className="org-edit-fieldset" disabled={pending || documentBusy || uploads.busy || (!canManage && key !== "team")}>
              {sections[key]()}
            </fieldset>
          </form>
          <div id="org-upload-status" className="org-upload-status" role="status">
            {uploads.busy ? "Loading selected image…" : ""}
          </div>
          <footer className="org-panel-footer">
            <span id="org-save-state">{dirty ? "Unsaved changes" : devCopy("All changes saved in this browser", "All changes saved")}</span>
            {canManage && (
              <>
                <Button
                  variant="text sm"
                  onClick={() => {
                    if (!dirty) return toast("There are no unsaved changes.");
                    confirmDanger("Discard unsaved organization changes?", "Saved profile details will be restored. Team invitations and saved recruiter identities are separate.", () => {
                      discardOrganization();
                      setErrors({});
                      modal.close();
                      toast("Saved organization details restored.");
                    });
                  }}
                >
                  Cancel changes
                </Button>
                <button className="btn primary sm" type="submit" form="organization-form">
                  Save Changes
                </button>
              </>
            )}
          </footer>
        </section>
      </div>
      <DevOnly>
        <p className="org-demo-caption">
          <Icon name="shield" />
          Fictional organization and team data. Saved locally in this browser; no real invitations, document checks, or notifications.
        </p>
      </DevOnly>
    </div>
  );
}

