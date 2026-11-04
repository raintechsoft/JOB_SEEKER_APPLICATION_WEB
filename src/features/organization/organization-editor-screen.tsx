"use client";
import {uploadManager} from "@/services/media/upload-manager";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { AvatarSkeleton, LoadingRegion, Skeleton, TextSkeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Organization, Verification, VerificationStatus } from "@/types/domain";
import { errorSection, isOrganizationSection, ORGANIZATION_SECTIONS, organizationCompletion, validateOrganization, VERIFICATION_NEXT_STEP, type OrganizationSection } from "@/lib/domain/organization";
import { formatLocaleDate } from "@/lib/utils/date";
import { MB } from "@/lib/utils/files";
import { useState } from "react";
import { useFormAction } from "@/hooks/use-form-action";
import { useQueryClient } from "@tanstack/react-query";
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
import { MediaImage } from "@/components/ui/media-image";
import { Button, IconButton, LinkButton } from "@/components/ui/primitives";
import { SelectField, TextField } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import { ScreenError } from "@/components/ui/feedback";
import { Spinner } from "@/components/ui/spinner";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { PhotoEditor } from "@/components/profile/photo-editor";
import { ProfileActionsMenu } from "@/features/profile/profile-actions-menu";
import { OrgArea, OrgCatalogChips, OrgCatalogField, OrgCheck, OrgChoices, OrgField, OrgPublicHint, OrgSelect, VerificationBadge, VerifiedCompanyMark } from "@/components/organization/controls";
import { useJobActions } from "@/features/feed/job-dialogs";
import { ADMIN_ONLY, useImageUploads, useOrganizationEditor } from "./use-organization-editor";
import { TeamSection } from "./team-section";
import { EditorUpdateNotice } from "@/components/ui/editor-update-notice";

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

function EditorSidebar({ section, go, navRef }: { section: OrganizationSection; go: (section: OrganizationSection) => void; navRef: RefObject<HTMLElement | null> }) {
  return (
    <aside className="card org-sidebar">
      <span className="org-sidebar-label">ORGANIZATION MANAGEMENT</span>
      <nav aria-label="Organization profile sections" ref={navRef}>
        {(Object.entries(ORGANIZATION_SECTIONS) as [OrganizationSection, string][]).map(([id, title]) => (
          <button type="button" key={id} onClick={() => go(id)} className={section === id ? "active" : ""} aria-current={section === id ? "page" : undefined}>
            <Icon name={SECTION_ICONS[id]} />
            <span>{title}</span>
            <Icon name="chevron" />
          </button>
        ))}
      </nav>
      
    </aside>
  );
}

const PUBLIC_HINT_SECTIONS = new Set<OrganizationSection>(["overview", "about", "culture", "hiring"]);

function PanelHeading({ section }: { section: OrganizationSection }) {
  return (
    <header className="org-panel-heading">
      <div>
        <h2>{ORGANIZATION_SECTIONS[section]}</h2>
      </div>
      <div className="org-panel-heading-meta">
        {PUBLIC_HINT_SECTIONS.has(section) ? <OrgPublicHint /> : null}
        <DevOnly>
          <span className="org-data-tag">Demo data</span>
        </DevOnly>
      </div>
    </header>
  );
}

export function OrganizationEditorScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const run = useServiceAction();
  const jobs = useJobActions();
  const uploads = useImageUploads();
  const editor = useOrganizationEditor();
  const { query, ctx, draft, saved, dirty, errors, setErrors, canManage, guard, setOrg, updateOrganization, discardOrganization } = editor;
  const cache = useQueryClient();
  const { execute, pending } = useFormAction(setErrors);
  const services = useServices();
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentPreviews, setDocumentPreviews] = useState<Record<string, string>>({});
  const documentPreviewsRef = useRef(documentPreviews);
  documentPreviewsRef.current = documentPreviews;
  const navRef = useRef<HTMLElement>(null);
  const key: OrganizationSection = isOrganizationSection(params.get("section")) ? (params.get("section") as OrganizationSection) : "overview";

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>("[aria-current=page]");
    if (nav && active && matchMedia("(max-width:680px)").matches) nav.scrollLeft += active.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - active.clientWidth) / 2;
  }, [key]);

  useEffect(() => () => {
    Object.values(documentPreviewsRef.current).forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    });
  }, []);

  const go = (section: OrganizationSection) => {
    setErrors({});
    router.push(ROOT + "?section=" + section);
  };
  if (!ctx || !draft) {
    const failed = query.isError && !ctx;
    return (
      <div className="org-workspace">
        {failed ? null : (
          <LoadingRegion label="Loading organization summary">
            <section className="card org-summary"><div className="org-summary-body"><div className="skeleton-identity grow"><AvatarSkeleton /><TextSkeleton lines={2} /></div></div></section>
          </LoadingRegion>
        )}
        <div className="org-editor-layout">
          <EditorSidebar section={key} go={go} navRef={navRef} />
          <section className="card org-editor-panel">
            <PanelHeading section={key} />
            {failed ? <ScreenError error={query.error} compact onRetry={() => void query.refetch()} title="Organization settings couldn’t load" homeHref="/recruiter/dashboard" homeLabel="Back to dashboard" /> : (
              <LoadingRegion label="Loading organization settings">
                <div className="org-form-grid">{[0, 1, 2, 3, 4, 5].map((i) => <div className="skeleton-lines" key={i}><Skeleton style={{ width: "40%" }} /><Skeleton style={{ height: 46 }} /></div>)}</div>
                <div className="skeleton-lines"><Skeleton style={{ width: "30%" }} /><Skeleton style={{ height: 110 }} /></div>
              </LoadingRegion>
            )}
          </section>
        </div>
      </div>
    );
  }
  const o = draft.organization;
  const remoteChange = o.version !== ctx.workspace.organization.version;
  const v = draft.verification;
  const completion = organizationCompletion(o);
  const field = (label: string, name: keyof Organization, props: { type?: string; required?: boolean; maxLength?: number; pattern?: string; min?: number; max?: number } = {}) => <OrgField label={label} name={name} value={String(o[name] ?? "")} error={errors[name]} onValue={(value) => setOrg((d) => void ((d as unknown as Record<string, unknown>)[name] = value))} {...props} />;
  const area = (label: string, name: keyof Organization, props: { required?: boolean; maxLength?: number; placeholder?: string } = {}) => <OrgArea label={label} name={name} value={String(o[name] ?? "")} error={errors[name]} onValue={(value) => setOrg((d) => void ((d as unknown as Record<string, unknown>)[name] = value))} {...props} />;
  const select = (label: string, name: keyof Organization, options: string[], required = false) => <OrgSelect label={label} name={name} value={String(o[name] ?? "")} error={errors[name]} required={required} options={options} onValue={(value) => setOrg((d) => void ((d as unknown as Record<string, unknown>)[name] = value))} />;
  const catalogChips = (
    label: string,
    name: "workplaceLocations" | "hiringDepartments" | "hiringLocations" | "employmentTypes" | "expertiseAreas" | "benefits",
    catalog: "location" | "department" | "employmentType" | "interest" | "benefit",
    allowCustom = true,
  ) => (
    <OrgCatalogChips
      label={label}
      name={name}
      catalog={catalog}
      values={o[name]}
      error={errors[name]}
      allowCustom={allowCustom}
      onChange={(values) => guard() && setOrg((d) => void (d[name] = values))}
    />
  );
  const check = (label: string, name: "showPublicContact" | "showCareers" | "acceptInquiries" | "notifyApplications" | "notifyTeam", hint?: string) => <OrgCheck label={label} checked={o[name]} hint={hint} onChange={(value) => setOrg((d) => void (d[name] = value))} />;
  const vField = (label: string, name: keyof Verification, type = "text", maxLength = 150) => <OrgField label={label} name={name} type={type} maxLength={maxLength} value={String(v[name] ?? "")} error={errors[name]} onValue={(value) => updateOrganization((d) => void ((d.verification as unknown as Record<string, unknown>)[name] = value))} />;

  const openImageEditor = (kind: "logoUrl" | "coverImageUrl") => {
    if (!guard()) return;
    const purpose = kind === "logoUrl" ? "logo" : "cover";
    const label = kind === "logoUrl" ? "Logo" : "Cover image";
    modal.show(kind === "logoUrl" ? "Organization logo" : "Cover image", <PhotoEditor purpose={purpose} sources="computer" imageUrl={kind === "logoUrl" ? o.logoUrl : o.coverImageUrl} savedMessage={label + " updated."} removedMessage={label + " removed."} onSave={async file => {
      const current=uploadManager.claimEdit(`${o.id}:${kind}`);
      if (!guard()) throw new Error(ADMIN_ONLY);
      const images = await uploads.load([file], purpose === "logo" ? uploads.limits.logo : uploads.limits.cover, purpose);
      if (!images) throw new Error("The image could not be uploaded. Please try again.");
      if(!current())throw new Error("A newer image change is already in progress.");
      await applyImage(kind, images[0].url);
    }} onRemove={async () => {uploadManager.claimEdit(`${o.id}:${kind}`); if (!guard()) throw new Error(ADMIN_ONLY); await applyImage(kind, ""); }} />, "photo");
  };
  /**
   * Logo and cover apply at once, like a profile photo: only the image changes on the saved
   * organization, and other unsaved edits stay in the draft on the new version.
   */
  const applyImage = async (kind: "logoUrl" | "coverImageUrl", url: string) => {
    if (!saved) throw new Error("Reload the organization and try again.");
    await services.organization.saveOrganization({ ...saved.organization, [kind]: url }, saved.verification);
    const version = saved.organization.version;
    setOrg((d) => { d[kind] = url; if (version !== undefined) d.version = version + 1; });
    await cache.invalidateQueries({ queryKey: ["organization"] });
  };
  /**
   * Supporting documents are retained as soon as they are attached or removed, so a reload keeps
   * the evidence list. Other unsaved verification field edits stay in the local draft.
   */
  const applyVerificationDocuments = async (documents: Verification["documents"]) => {
    if (!saved) throw new Error("Reload the organization and try again.");
    await services.organization.saveOrganization(saved.organization, { ...saved.verification, documents });
    const version = saved.organization.version;
    updateOrganization((d) => {
      d.verification.documents = documents;
      if (version !== undefined) d.organization.version = version + 1;
    });
    await cache.invalidateQueries({ queryKey: ["organization"] });
  };
  const openGalleryEditor = (replace?: number) => {
    if (!guard()) return;
    if (replace === undefined && o.workplaceImages.length >= 4) {
      toast("Use up to four workplace images, totaling 1.5 MB or less.");
      return;
    }
    const imageUrl = replace !== undefined ? o.workplaceImages[replace]?.url ?? "" : "";
    modal.show(replace !== undefined ? "Workplace image" : "Add workplace image", <PhotoEditor purpose="gallery" sources="computer" imageUrl={imageUrl} savedMessage={replace !== undefined ? "Workplace image updated." : "Workplace image added."} removedMessage="Workplace image removed." onSave={async file => {
      if (!guard()) throw new Error(ADMIN_ONLY);
      const existing = o.workplaceImages.reduce((n, im, i) => n + (replace === i ? 0 : im.bytes || 0), 0);
      if ((replace === undefined && o.workplaceImages.length >= 4) || (apiConfig.dataSource !== "http" && existing + file.size > 1.5 * MB)) throw new Error("Use up to four workplace images, totaling 1.5 MB or less.");
      const images = await uploads.load([file], uploads.limits.gallery, "gallery");
      if (!images) throw new Error("The image could not be uploaded. Please try again.");
      setOrg((d) => (replace === undefined ? void d.workplaceImages.push(...images) : void (d.workplaceImages[replace] = images[0])));
    }} onRemove={async () => {
      if (!guard()) throw new Error(ADMIN_ONLY);
      if (replace === undefined) return;
      setOrg((d) => void d.workplaceImages.splice(replace, 1));
    }} />, "photo");
  };

  const save = async () => {
    if (remoteChange || !dirty) return;
    if (!canManage) return toast(ADMIN_ONLY);
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
    if (remoteChange) return;
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

  const addVerificationDocument = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !guard()) return;
    const error = validateMedia(file, "business_document");
    if (error) return toast(error, "error");
    if (v.documents.length >= 5) return toast("Use up to five documents.", "error");
    setDocumentBusy(true);
    try {
      const asset = apiConfig.dataSource === "http"
        ? await services.media.upload(file, "business_document", o.id, { manual: true })
        : { id: uid() };
      const next = [
        ...v.documents,
        { id: asset.id, name: file.name, size: file.size, type: file.type },
      ];
      await applyVerificationDocuments(next);
      if (file.type.startsWith("image/")) {
        const preview = URL.createObjectURL(file);
        setDocumentPreviews((current) => ({ ...current, [asset.id]: preview }));
      }
      if (errors.documents) {
        const cleared = { ...errors };
        delete cleared.documents;
        setErrors(cleared);
      }
      toast("Supporting document saved.");
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setDocumentBusy(false);
    }
  };

  const removeVerificationDocument = async (index: number) => {
    if (!guard()) return;
    const doc = v.documents[index];
    if (!doc) return;
    setDocumentBusy(true);
    try {
      const next = v.documents.filter((_, i) => i !== index);
      await applyVerificationDocuments(next);
      setDocumentPreviews((current) => {
        const url = current[doc.id];
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
        if (!(doc.id in current)) return current;
        const remaining = { ...current };
        delete remaining[doc.id];
        return remaining;
      });
      toast("Supporting document removed.");
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setDocumentBusy(false);
    }
  };

  const documentExt = (name: string) => (name.split(".").pop() ?? "").toUpperCase().slice(0, 4);
  const documentPreviewSrc = (doc: { id: string; type: string }) => {
    if (documentPreviews[doc.id]) return documentPreviews[doc.id];
    if (!doc.type.startsWith("image/") || !apiConfig.baseUrl) return "";
    return `${apiConfig.baseUrl.replace(/\/$/, "")}/media/${doc.id}/download`;
  };

  const sections: Record<OrganizationSection, () => ReactNode> = {
    overview: () => (
      <>
        <div className="org-form-grid">
          {field("Organization name", "name", { required: true, maxLength: 100 })}
          {field("Public profile slug", "slug", { required: true, maxLength: 80, pattern: "[a-z0-9]+(-[a-z0-9]+)*" })}
          <OrgCatalogField label="Industry" name="industry" catalog="industry" value={o.industry} error={errors.industry} onValue={(value) => setOrg((d) => void (d.industry = value))} />
          {select("Organization type", "organizationType", ["Privately held", "Public company", "Nonprofit", "Government", "Partnership", "Self-employed", "Other"])}
          {select("Company size", "companySize", ["", "1–10 employees", "11–50 employees", "51–200 employees", "201–500 employees", "501–1,000 employees", "1,001–5,000 employees", "5,001+ employees"])}
          {field("Founding year", "foundingYear", { type: "number", min: 1800, max: new Date().getFullYear() })}
          <OrgCatalogField label="Headquarters country" name="headquartersCountry" catalog="country" value={o.headquartersCountry} error={errors.headquartersCountry} allowCustom={false} onValue={(value) => setOrg((d) => void (d.headquartersCountry = value))} />
          {field("Headquarters city", "headquartersCity", { maxLength: 100 })}
          {field("Website URL", "websiteUrl", { type: "url", maxLength: 250 })}
        </div>
        {field("Short company tagline", "tagline", { maxLength: 140 })}
        {area("Company description", "description", { maxLength: 2500 })}
      </>
    ),
    about: () => (
      <>
        {area("Company overview", "overview", { maxLength: 2000, placeholder: "Introduce the work you do and the people you serve." })}
        <div className="org-form-grid">
          {area("Mission", "mission", { maxLength: 600 })}
          {area("Vision", "vision", { maxLength: 600 })}
        </div>
        {area("Products and services", "productsAndServices", { maxLength: 1200, placeholder: "Describe your main products and services." })}
        {catalogChips("Areas of expertise", "expertiseAreas", "interest")}
        {area("Company culture", "cultureDescription", { maxLength: 1200 })}
        {area("What candidates can expect", "candidateExpectations", { maxLength: 1200 })}
      </>
    ),
    culture: () => (
      <>
        {area("Work environment", "workEnvironment", { maxLength: 1200 })}
        <OrgChoices label="Work modes" options={["On-site", "Hybrid", "Remote"]} chosen={o.workModes} onChange={(values) => setOrg((d) => void (d.workModes = values))} />
        {catalogChips("Workplace locations", "workplaceLocations", "location")}
        <div className="org-gallery-block">
          <div className="row between wrap">
            <h3>Workplace gallery</h3>
            <Button variant="sm" icon="plus" disabled={o.workplaceImages.length >= 4 || uploads.busy} onClick={() => openGalleryEditor()}>
              Add images
            </Button>
          </div>
          <p className="org-help">Up to 4 images, each cropped to 4:3. {devCopy("Public gallery; files stay in this browser.", "Shown in your public gallery.")}</p>
          {o.workplaceImages.length ? (
            <div className="org-gallery">
              {o.workplaceImages.map((im, i) => (
                <figure key={im.id}>
                  <MediaImage src={im.url} alt={im.alt} />
                  <figcaption>
                    <span>{im.alt}</span>
                    <div>
                      <IconButton icon="edit" label={"Replace workplace image " + (i + 1)} disabled={uploads.busy} onClick={() => openGalleryEditor(i)} />
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
        {catalogChips("Benefits and perks", "benefits", "benefit")}
        {area("Team activities and culture highlights", "cultureHighlights", { maxLength: 1200 })}
      </>
    ),
    hiring: () => (
      <>
        <div className="org-form-grid">
          {select("Hiring status", "hiringStatus", ["Actively hiring", "Open to future talent", "Not currently hiring"])}
          {field("Careers page URL", "careersUrl", { type: "url", maxLength: 250 })}
        </div>
        {catalogChips("Hiring departments", "hiringDepartments", "department")}
        {catalogChips("Hiring locations", "hiringLocations", "location")}
        {catalogChips("Preferred employment types", "employmentTypes", "employmentType", false)}
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
                <IconButton icon="eye" label="View" onClick={() => jobs.view(j.id, "organization")} />
                <Link href={"/recruiter/jobs/new?id=" + j.id} className="iconbtn" aria-label="Manage" title="Manage">
                  <Icon name="edit" />
                </Link>
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
          <strong>Only organization admins can change this.</strong>
          <p>Private registration and representative details are not shown to this role.</p>
          <VerificationBadge status={o.verificationStatus} />
        </div>
      ) : (
        <>
          <div
            className={
              "org-verification-status is-" +
              (o.verificationStatus === "Verified"
                ? "verified"
                : o.verificationStatus === "Pending review"
                  ? "pending"
                  : o.verificationStatus === "Action required"
                    ? "action"
                    : o.verificationStatus === "In progress"
                      ? "progress"
                      : "idle")
            }
          >
            <VerificationBadge status={o.verificationStatus} />
            <div className="org-verification-copy">
              <h3>{VERIFICATION_NEXT_STEP[o.verificationStatus]}</h3>
              {v.reviewNote ? <p>{v.reviewNote}</p> : null}
              {v.submittedAt ? (
                <p className="org-verification-meta">
                  Submitted {formatLocaleDate(v.submittedAt)}
                  {devCopy(" · Demo only", "")}
                </p>
              ) : null}
            </div>
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
          <div className="org-proof-files">
            <div className="org-proof-heading">
              <h3>
                Supporting document references <span className="org-private-label">Private</span>
              </h3>
              <p className="org-help">
                PDF, PNG or JPEG · up to 5 files. Attach at least one document to submit.
                {devCopy(" Only file names are recorded for this demo. File contents are not uploaded or stored.", "")}
              </p>
            </div>
            {v.documents.length > 0 ? (
              <ul className="resume-file-list org-proof-list" aria-label="Supporting documents">
                {v.documents.map((doc, i) => {
                  const ext = documentExt(doc.name);
                  const preview = documentPreviewSrc(doc);
                  return (
                    <li key={doc.id} className="resume-file-card">
                      {preview ? (
                        <span className="org-proof-thumb" aria-hidden="true">
                          <MediaImage src={preview} alt="" fallback={<span className={"resume-file-badge is-" + ext.toLowerCase()}>{ext || "FILE"}</span>} />
                        </span>
                      ) : (
                        <span className={"resume-file-badge is-" + ext.toLowerCase()} aria-hidden="true">
                          {ext || "FILE"}
                        </span>
                      )}
                      <span className="resume-file-meta">
                        <strong title={doc.name}>{doc.name}</strong>
                        <small>{Math.ceil(doc.size / 1024)} KB</small>
                      </span>
                      <button
                        type="button"
                        className="resume-file-action is-remove"
                        aria-label={"Remove " + doc.name}
                        disabled={documentBusy || pending}
                        onClick={() => void removeVerificationDocument(i)}
                      >
                        <Icon name="close" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <FileDrop
              id="org-verification-document"
              section="organization-verification"
              use="business-document"
              label=""
              srLabel="Select a supporting document"
              icon="file"
              prompt="Drag and drop a document here"
              promptHint="or use the button to browse"
              buttonLabel={documentBusy ? "Uploading…" : "Select a document"}
              accept="application/pdf,image/png,image/jpeg"
              disabled={v.documents.length >= 5 || documentBusy || pending}
              describedBy="org-verification-document-hint"
              onFiles={(files) => void addVerificationDocument(files)}
              hint={
                documentBusy
                  ? "Uploading document…"
                  : v.documents.length >= 5
                    ? "Maximum of five documents attached."
                    : undefined
              }
            />
            <span id="org-verification-document-hint" className="sr-only">
              PDF, PNG or JPEG. Attach at least one document to submit.
            </span>
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
          {field("Public phone", "publicPhone", { type: "tel", maxLength: 25 })}
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
        </div>
        <DevOnly>
          <p className="org-help">Notification preferences are saved locally. No emails or notifications are delivered.</p>
        </DevOnly>
      </>
    ),
  };

  const copyProfileLink = async () => {
    const url = window.location.origin + "/organizations/" + o.slug;
    try {
      await navigator.clipboard.writeText(url);
      toast(devCopy("Public profile link copied. Local edits stay in this browser.", "Public profile link copied."));
    } catch {
      modal.show("Your public profile link", <TextField label="Copy this link" name="copy" defaultValue={url} readOnly onClick={(e) => e.currentTarget.select()} />);
    }
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
      <EditorUpdateNotice changed={remoteChange} reload={discardOrganization} />
      <section className="card org-summary" id="org-summary">
        <div className={"org-summary-cover" + (o.coverImageUrl ? " has-image" : "")}>
          {o.coverImageUrl ? <MediaImage src={o.coverImageUrl} alt="" fallback={null} /> : null}
          {canManage ? (
            <button type="button" className="org-summary-cover-edit" disabled={uploads.busy} onClick={() => openImageEditor("coverImageUrl")}>
              <Icon name="camera" />
              {o.coverImageUrl ? "Edit cover" : "Add cover image"}
            </button>
          ) : null}
        </div>
        <div className="org-summary-body">
          <ProfileActionsMenu
            previewHref={ROOT + "/preview?section=" + key}
            onCopy={copyProfileLink}
            onImprove={completion.percent < 100 ? openCompletion : undefined}
          />
          <div className="org-summary-main">
            <div className="org-summary-logo-wrap">
              <button type="button" className="org-summary-logo" aria-label="Edit organization logo" disabled={!canManage || uploads.busy} onClick={() => openImageEditor("logoUrl")}>
                {o.logoUrl ? (
                  <MediaImage src={o.logoUrl} alt="" fallback={<Icon name="building" />} />
                ) : (
                  <Icon name="building" />
                )}
              </button>
              {canManage ? (
                <button type="button" className="org-summary-edit org-summary-logo-edit" aria-label="Edit organization logo" disabled={uploads.busy} onClick={() => openImageEditor("logoUrl")}>
                  <Icon name="edit" />
                </button>
              ) : null}
            </div>
            <div className="org-summary-copy">
              <div className="org-summary-title-row">
                <h2>{o.name || "Your organization"}</h2>
                <VerifiedCompanyMark status={o.verificationStatus} />
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
        {completion.percent < 100 ? (
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
        ) : null}
        </div>
      </section>
      <div className="org-editor-layout">
        <EditorSidebar section={key} go={go} navRef={navRef} />
        <section className="card org-editor-panel">
          <PanelHeading section={key} />
          {!canManage && (
            <p className="org-section-note">
              <Icon name="shield" />
              Only organization admins can change this. Organization settings and team access are read-only for your role.
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
          <div id="org-upload-status" className="org-upload-status" role="status" aria-label={uploads.busy ? "Uploading image" : undefined} aria-busy={uploads.busy || undefined}>
            {uploads.busy && <Spinner />}
          </div>
          <footer className="org-panel-footer">
            <span id="org-save-state">{dirty ? "Unsaved changes" : devCopy("All changes saved in this browser", "All changes saved")}</span>
            {canManage && (
              <>
                <Button
                  variant="text sm"
                  disabled={!dirty || pending || uploads.busy || documentBusy}
                  onClick={() => {
                    if (!dirty) return;
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
                <button className="btn primary sm" type="submit" form="organization-form" disabled={!dirty || remoteChange || pending || uploads.busy || documentBusy}>
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

