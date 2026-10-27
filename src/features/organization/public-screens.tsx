"use client";

import { MediaImage } from "@/components/ui/media-image";

import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Job } from "@/types/domain";
import { publicOrganization, publicRecruiter, type PublicOrganization, type PublicRecruiter } from "@/lib/domain/organization";
import { safeUrl } from "@/lib/utils/url";
import { useServiceQuery } from "@/hooks/use-services";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, EmptyState, LinkButton } from "@/components/ui/primitives";
import { ScreenError, ScreenFallback } from "@/components/ui/feedback";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { VerificationBadge } from "@/components/organization/controls";
import { useJobActions } from "@/features/feed/job-dialogs";
import { recruiterAvatar } from "./team-section";
import { useOrganizationEditor, useRecruiterDraft } from "./use-organization-editor";
import { organizationProfileHref } from "@/lib/routing/profiles";

const Paragraph = ({ value }: { value?: string }) => (value ? <p>{value}</p> : null);
const Chips = ({ items }: { items: string[] }) =>
  items.length ? (
    <div className="org-public-chips">
      {items.map((i) => (
        <span key={i}>{i}</span>
      ))}
    </div>
  ) : null;
function External({ label, url, className }: { label: string; url: string; className?: string }) {
  const href = safeUrl(url);
  return href ? (
    <a className={className} href={href} target="_blank" rel="noopener">
      {label}
      <Icon name="external" />
    </a>
  ) : null;
}
const Section = ({ title, children, show = true }: { title: string; children: ReactNode; show?: boolean }) =>
  show ? (
    <section className="card org-public-section">
      <h2>{title}</h2>
      {children}
    </section>
  ) : null;

function Unavailable({ title, description }: { title: string; description: string }) {
  return (
    <div className="org-workspace">
      <EmptyState
        title={title}
        description={description}
        action={
          <LinkButton href="/app/dashboard" variant="primary">
            Go to feed
          </LinkButton>
        }
      />
    </div>
  );
}

function OrganizationPage({ o, jobs, preview, inWorkspace = false }: { o: PublicOrganization; jobs: Job[]; preview: boolean; inWorkspace?: boolean }) {
  const jobActions = useJobActions();
  const section = useSearchParams().get("section") || "overview";
  const culture = !!(o.cultureDescription || o.workEnvironment || o.workModes.length || o.workplaceLocations.length || o.workplaceImages.length || o.benefits.length || o.cultureHighlights || o.candidateExpectations);
  const connect = !!(o.publicContactEmail || o.publicPhone || safeUrl(o.socialLinks.linkedin) || safeUrl(o.socialLinks.other) || safeUrl(o.careersUrl));
  return (
    <div className="org-public-page">
      {preview ? (
        <div className="org-preview-banner">
          <div>
            <Icon name="eye" />
            <span>
              <strong>Public profile preview</strong>{devCopy("Reflects your current local edits. ", "Reflects your current edits. ")}{o.profileVisibility === "Hidden" ? "Organization visibility is Hidden." : ""}
            </span>
          </div>
          <LinkButton href={"/recruiter/company?section=" + encodeURIComponent(section)} variant="sm" icon="edit">
            Return to editor
          </LinkButton>
        </div>
      ) : !inWorkspace ? (
        <DevOnly>
          <p className="org-demo-caption">Demonstration organization · Browser-local prototype</p>
        </DevOnly>
      ) : null}
      <header className="card org-public-hero">
        <div className="org-public-cover">
          {o.coverImageUrl ? (
            <MediaImage src={o.coverImageUrl} alt={o.name + " cover"} />
          ) : (
            <span>GOOD WORK STARTS WITH GOOD PEOPLE.</span>
          )}
        </div>
        <div className="org-public-identity">
          <span className="org-public-logo">
            {o.logoUrl ? (
              <MediaImage src={o.logoUrl} alt={o.name + " logo"} />
            ) : (
              <span aria-hidden="true">{o.name.trim().slice(0, 1).toUpperCase() || "C"}</span>
            )}
          </span>
          <div>
            <div className="row wrap">
              <h1>{o.name}</h1>
              {o.verificationStatus === "Verified" && <VerificationBadge status={o.verificationStatus} />}
            </div>
            <p>{o.tagline}</p>
            <div className="org-public-facts">
              {[o.industry, o.companySize, [o.headquartersCity, o.headquartersCountry].filter(Boolean).join(", ")].filter(Boolean).map((fact) => (
                <span key={fact}>{fact}</span>
              ))}
            </div>
            <div className="org-public-links">
              <External label="Company website" url={o.websiteUrl} />
              <External label="Careers" url={o.careersUrl} />
            </div>
          </div>
        </div>
      </header>
      <div className="org-public-layout">
        <div>
          <section className="card org-public-section">
            <h2>About {o.name}</h2>
            {o.description || o.overview ? (
              <>
                <Paragraph value={o.description} />
                <Paragraph value={o.overview} />
              </>
            ) : (
              <p className="muted">This organization has not added a public description yet.</p>
            )}
            {(o.mission || o.vision) && (
              <div className="org-public-mission">
                <div>
                  <h3>Our mission</h3>
                  <Paragraph value={o.mission} />
                </div>
                <div>
                  <h3>Our vision</h3>
                  <Paragraph value={o.vision} />
                </div>
              </div>
            )}
            {o.productsAndServices && (
              <>
                <h3>What we do</h3>
                <Paragraph value={o.productsAndServices} />
              </>
            )}
            <Chips items={o.expertiseAreas} />
          </section>
          <Section title="Workplace & culture" show={culture}>
            <Paragraph value={o.cultureDescription} />
            <Paragraph value={o.workEnvironment} />
            <Chips items={o.workModes} />
            <Chips items={o.workplaceLocations} />
            {o.workplaceImages.length > 0 && (
              <div className="org-public-gallery">
                {o.workplaceImages.map((i) => (
                  <MediaImage key={i.id} src={i.url} alt={i.alt} />
                ))}
              </div>
            )}
            {o.benefits.length > 0 && (
              <>
                <h3>Benefits & perks</h3>
                <Chips items={o.benefits} />
              </>
            )}
            <Paragraph value={o.cultureHighlights} />
            {o.candidateExpectations && (
              <>
                <h3>Joining our team</h3>
                <Paragraph value={o.candidateExpectations} />
              </>
            )}
          </Section>
          <section className="card org-public-section">
            <div className="row between wrap">
              <h2>Open opportunities</h2>
              <span className="org-public-small">{jobs.length} active</span>
            </div>
            {jobs.length ? (
              jobs.map((j) => (
                <article className="org-public-job" key={j.id}>
                  <div>
                    <h3>{j.title}</h3>
                    <p>
                      {j.location} · {j.employment} · {j.arrangement}
                    </p>
                  </div>
                  <Button variant="sm" icon="arrow" onClick={() => jobActions.view(j.id, "organization")}>
                    View job
                  </Button>
                </article>
              ))
            ) : (
              <p>No active positions at the moment.</p>
            )}
          </section>
        </div>
        <aside>
          <Section title="Organization details" show={!!(o.industry || o.companySize || o.organizationType || o.foundingYear || o.headquartersCity || o.headquartersCountry || o.hiringStatus)}>
            <dl>
              {o.industry ? <><dt>Industry</dt><dd>{o.industry}</dd></> : null}
              {o.companySize ? <><dt>Company size</dt><dd>{o.companySize}</dd></> : null}
              {o.organizationType ? <><dt>Organization type</dt><dd>{o.organizationType}</dd></> : null}
              {o.foundingYear ? <><dt>Founded</dt><dd>{o.foundingYear}</dd></> : null}
              {[o.headquartersCity, o.headquartersCountry].filter(Boolean).length ? (
                <>
                  <dt>Headquarters</dt>
                  <dd>{[o.headquartersCity, o.headquartersCountry].filter(Boolean).join(", ")}</dd>
                </>
              ) : null}
              {o.hiringStatus ? <><dt>Hiring status</dt><dd>{o.hiringStatus}</dd></> : null}
            </dl>
          </Section>
          <Section title="Connect with us" show={connect}>
            {o.publicContactEmail && (
              <a href={"mailto:" + o.publicContactEmail}>
                <Icon name="mail" />
                {o.publicContactEmail}
              </a>
            )}
            {o.publicPhone && (
              <p>
                <Icon name="phone" />
                {o.publicPhone}
              </p>
            )}
            <External label="LinkedIn" url={o.socialLinks.linkedin} />
            <External label="Social profile" url={o.socialLinks.other} />
            <External label="Careers page" url={o.careersUrl} />
          </Section>
        </aside>
      </div>
      {!inWorkspace && (
        <DevOnly>
          <p className="org-demo-caption">Fictional company data. Verification badges represent explicit demo review states.</p>
        </DevOnly>
      )}
    </div>
  );
}

function RecruiterPage({ r, o, preview, editHref, inWorkspace = false }: { r: PublicRecruiter; o: PublicOrganization; preview: boolean; editHref: string; inWorkspace?: boolean }) {
  const pathname = usePathname();
  const companyHref = o.profileVisibility === "Public" && o.slug
    ? inWorkspace
      ? organizationProfileHref(pathname.startsWith("/recruiter") ? "recruiter" : "professional", o.slug)
      : "/organizations/" + o.slug
    : undefined;
  return (
    <div className="org-public-page org-recruiter-public">
      {preview ? (
        <div className="org-preview-banner">
          <span>
            <Icon name="eye" />
            Recruiter profile preview · {r.profileVisibility === "Hidden" ? "Hidden from public views" : "Public identity only"}
          </span>
          <LinkButton href={editHref} variant="sm" icon="edit">
            Return to edit
          </LinkButton>
        </div>
      ) : !inWorkspace ? (
        <DevOnly>
          <p className="org-demo-caption">Demonstration recruiter profile</p>
        </DevOnly>
      ) : null}
      <header className="card org-public-hero">
        <div className="org-public-cover">
          {o.coverImageUrl ? (
            <MediaImage src={o.coverImageUrl} alt={o.name + " cover"} />
          ) : (
            <span>GOOD WORK STARTS WITH GOOD PEOPLE.</span>
          )}
        </div>
        <div className="org-public-identity">
          <span className="org-public-logo org-recruiter-logo">
            <Avatar person={recruiterAvatar(r)} size="xl" />
          </span>
          <div>
            <h1>{r.fullName}</h1>
            <p>{r.jobTitle}</p>
            <div className="org-public-association">
              {o.logoUrl ? (
                <MediaImage src={o.logoUrl} alt="" />
              ) : (
                <span aria-hidden="true">{o.name.trim().slice(0, 1).toUpperCase() || "C"}</span>
              )}
              {companyHref ? (
                <LinkButton href={companyHref} variant="text sm">
                  {o.name}
                </LinkButton>
              ) : (
                o.name
              )}
            </div>
          </div>
        </div>
      </header>
      <section className="card org-public-section">
        <h2>About</h2>
        {r.professionalBio ? <Paragraph value={r.professionalBio} /> : <p className="muted">This recruiter has not added a public bio yet.</p>}
        {r.hiringDepartments.length > 0 && (
          <>
            <h2>Hiring focus</h2>
            <Chips items={r.hiringDepartments} />
          </>
        )}
        {r.hiringLocations.length > 0 && (
          <>
            <h2>Hiring locations</h2>
            <Chips items={r.hiringLocations} />
          </>
        )}
        <External label="LinkedIn" url={r.professionalLinks.linkedin} className="org-recruiter-link" />
      </section>
      {!inWorkspace && <p className="org-demo-caption">Public identity excludes account email, internal role, and permissions.</p>}
    </div>
  );
}

export function PublicOrganizationScreen({ slug, inWorkspace = false }: { slug: string; inWorkspace?: boolean }) {
  const { data, isPending, isError, refetch } = useServiceQuery(["organization", "public", slug], (s) => s.organization.getPublicOrganization(slug),{ keepPreviousData: false });
  if (isError) return <ScreenError onRetry={() => void refetch()} />;
  if (isPending) return <ScreenFallback layout="profile" />;
  if (!data) return <Unavailable title="Organization profile unavailable." description="This profile is hidden or the address has changed." />;
  return <OrganizationPage o={data.organization} jobs={data.openJobs} preview={false} inWorkspace={inWorkspace} />;
}

export function OrganizationPreviewScreen() {
  const { query, ctx, draft } = useOrganizationEditor();
  if (query.isError) return <ScreenError onRetry={() => query.refetch()} />;
  if (!ctx || !draft) return <ScreenFallback layout="profile" />;
  return <OrganizationPage o={publicOrganization(draft.organization)} jobs={ctx.openJobs} preview />;
}

export function PublicRecruiterScreen({ id, inWorkspace = false }: { id: string; inWorkspace?: boolean }) {
  const { data, isPending, isError, refetch } = useServiceQuery(["recruiter", "public", id], (s) => s.organization.getPublicRecruiter(id),{ keepPreviousData: false });
  if (isError) return <ScreenError onRetry={() => void refetch()} />;
  if (isPending) return <ScreenFallback layout="profile" />;
  if (!data) return <Unavailable title="Recruiter profile unavailable." description="This profile is not currently public." />;
  return <RecruiterPage r={data.recruiter} o={data.organization} preview={false} editHref="" inWorkspace={inWorkspace} />;
}

export function RecruiterPreviewScreen() {
  const idParam = useSearchParams().get("id");
  const { query, ctx } = useOrganizationEditor();
  const id = idParam || ctx?.currentRecruiter.id;
  const member = ctx?.workspace.recruiters.find((r) => r.id === id);
  const { draft } = useRecruiterDraft(member);
  if (query.isError) return <ScreenError onRetry={() => query.refetch()} />;
  if (!ctx) return <ScreenFallback layout="profile" />;
  if (!member) return <Unavailable title="Recruiter profile unavailable." description="This profile is not currently public." />;
  if (!draft) return <ScreenFallback layout="profile" />;
  return <RecruiterPage r={publicRecruiter(draft)} o={publicOrganization(ctx.workspace.organization)} preview editHref={id === ctx.currentRecruiter.id ? "/recruiter/profile" : "/recruiter/team/" + id} />;
}
