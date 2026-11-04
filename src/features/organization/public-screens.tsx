"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Job } from "@/types/domain";
import { publicOrganization, publicRecruiter, type PublicOrganization, type PublicRecruiter } from "@/lib/domain/organization";
import { safeUrl } from "@/lib/utils/url";
import { useServiceQuery } from "@/hooks/use-services";
import { Icon } from "@/components/ui/icon";
import { Button, EmptyState, LinkButton } from "@/components/ui/primitives";
import { ScreenError } from "@/components/ui/feedback";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { VerificationBadge, VerifiedCompanyMark } from "@/components/organization/controls";
import { useJobActions } from "@/features/feed/job-dialogs";
import {
  organizationPublicTabDefs,
  recruiterPublicTabDefs,
  type PublicProfileTabId,
} from "@/features/talent/public-profile-sections";
import { PublicProfileTabs, type PublicProfileTab } from "@/features/talent/public-profile-tabs";
import { ProfileSectionCard } from "@/components/profile/profile-public-sections";
import { recruiterAvatar } from "./team-section";
import { WorkplaceGallery } from "./workplace-gallery";
import { useOrganizationEditor, useRecruiterDraft } from "./use-organization-editor";
import { organizationProfileHref } from "@/lib/routing/profiles";
import { PublicFollowButton } from "@/features/public-browsing/public-account-actions";
import { PublicProfileHeader, takePublicLinks } from "@/features/talent/public-profile-header";
import { PublicProfileLoadingSkeleton } from "@/features/talent/public-profile-skeleton";
import type { PublicProfileViewer } from "@/services/organization/organization.service";

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
/** Escape link that keeps people inside their current area: recruiter, professional or public. */
function useAreaHome() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/recruiter")) return { href: "/recruiter/dashboard", label: "Go to dashboard", jobs: undefined };
  if (pathname.startsWith("/app")) return { href: "/app/dashboard", label: "Go to feed", jobs: "/app/jobs" };
  return { href: "/", label: "Go to feed", jobs: "/jobs" };
}

function Unavailable({ icon, title, description }: { icon: "compass" | "lock"; title: string; description: string }) {
  const home = useAreaHome();
  return (
    <div className="org-workspace">
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        action={
          <LinkButton href={home.href} variant="primary">
            {home.label}
          </LinkButton>
        }
      />
    </div>
  );
}

function LoadError({ error, onRetry, title }: { error: unknown; onRetry: () => void; title: string }) {
  const home = useAreaHome();
  return <ScreenError error={error} onRetry={onRetry} title={title} description="Something interrupted the request. Please try again." homeHref={home.href} homeLabel={home.label} />;
}

/** Page frame (preview banner, hero and column layout) kept on screen while public profile data loads or fails. */
function PendingPublicPage({ kind, banner, label, error, onRetry, errorTitle }: { kind: "organization" | "recruiter"; banner?: ReactNode; label: string; error?: unknown; onRetry?: () => void; errorTitle: string }) {
  return (
    <div className={"org-public-page" + (kind === "recruiter" ? " org-recruiter-public" : "")}>
      {banner}
      {onRetry ? (
        <LoadError error={error} onRetry={onRetry} title={errorTitle} />
      ) : (
        <PublicProfileLoadingSkeleton label={label} />
      )}
    </div>
  );
}

function OrganizationPreviewBanner() {
  const section = useSearchParams().get("section") || "overview";
  return (
    <div className="org-preview-banner">
      <div>
        <Icon name="eye" />
        <span>
          <strong>Public profile preview</strong>{devCopy("Reflects your current local edits. ", "Reflects your current edits. ")}
        </span>
      </div>
      <LinkButton href={"/recruiter/company?section=" + encodeURIComponent(section)} variant="sm" icon="edit">
        Return to editor
      </LinkButton>
    </div>
  );
}

function OrganizationPage({ o, jobs, preview, inWorkspace = false, viewer = { own: false, following: false } }: { o: PublicOrganization; jobs: Job[]; preview: boolean; inWorkspace?: boolean; viewer?: PublicProfileViewer }) {
  const jobActions = useJobActions();
  const home = useAreaHome();
  const section = useSearchParams().get("section") || "overview";
  const tabDefs = useMemo(() => organizationPublicTabDefs({ organization: o, jobCount: jobs.length }), [o, jobs.length]);
  const links = takePublicLinks([
    ...(o.websiteUrl ? [{ label: "Website", url: o.websiteUrl }] : []),
    ...(o.careersUrl ? [{ label: "Careers", url: o.careersUrl }] : []),
    ...(o.socialLinks.linkedin ? [{ label: "LinkedIn", url: o.socialLinks.linkedin }] : []),
  ]);
  const locationFacts = [o.industry, o.companySize, [o.headquartersCity, o.headquartersCountry].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ");
  const bio = o.tagline || o.description || "";

  const panels: Partial<Record<PublicProfileTabId, ReactNode>> = {
    overview: (
      <ProfileSectionCard title={`About ${o.name}`}>
        <div className="org-public-about">
          {o.description || o.overview ? (
            <div className="org-public-about-lead">
              <Paragraph value={o.description} />
              <Paragraph value={o.overview} />
            </div>
          ) : (
            <EmptyState compact icon="file" title="No description yet" description="This organization hasn’t added a public description yet." />
          )}
          {(o.mission || o.vision) && (
            <div className="org-public-mission">
              {o.mission ? (
                <article className="org-public-mission-card">
                  <h3>Our mission</h3>
                  <Paragraph value={o.mission} />
                </article>
              ) : null}
              {o.vision ? (
                <article className="org-public-mission-card">
                  <h3>Our vision</h3>
                  <Paragraph value={o.vision} />
                </article>
              ) : null}
            </div>
          )}
          {o.productsAndServices ? (
            <div className="org-public-about-block">
              <h3>What we do</h3>
              <Paragraph value={o.productsAndServices} />
            </div>
          ) : null}
          {o.expertiseAreas.length > 0 ? (
            <div className="org-public-about-block">
              <h3>Areas of expertise</h3>
              <Chips items={o.expertiseAreas} />
            </div>
          ) : null}
        </div>
      </ProfileSectionCard>
    ),
    culture: (
      <ProfileSectionCard title="Workplace & culture">
        <div className="org-public-about">
          {o.cultureDescription || o.workEnvironment ? (
            <div className="org-public-about-lead">
              <Paragraph value={o.cultureDescription} />
              <Paragraph value={o.workEnvironment} />
            </div>
          ) : null}
          {o.workModes.length > 0 || o.workplaceLocations.length > 0 ? (
            <div className="org-public-about-block">
              <h3>How we work</h3>
              {o.workModes.length > 0 ? (
                <div className="org-public-chip-group">
                  <span className="org-public-chip-label">Work modes</span>
                  <Chips items={o.workModes} />
                </div>
              ) : null}
              {o.workplaceLocations.length > 0 ? (
                <div className="org-public-chip-group">
                  <span className="org-public-chip-label">Locations</span>
                  <Chips items={o.workplaceLocations} />
                </div>
              ) : null}
            </div>
          ) : null}
          {o.workplaceImages.length > 0 ? (
            <div className="org-public-about-block">
              <h3>Workplace</h3>
              <WorkplaceGallery images={o.workplaceImages} />
            </div>
          ) : null}
          {o.benefits.length > 0 ? (
            <div className="org-public-about-block">
              <h3>Benefits & perks</h3>
              <Chips items={o.benefits} />
            </div>
          ) : null}
          {o.cultureHighlights ? (
            <div className="org-public-about-block">
              <h3>Culture highlights</h3>
              <Paragraph value={o.cultureHighlights} />
            </div>
          ) : null}
          {o.candidateExpectations ? (
            <div className="org-public-about-block">
              <h3>Joining our team</h3>
              <Paragraph value={o.candidateExpectations} />
            </div>
          ) : null}
        </div>
      </ProfileSectionCard>
    ),
    jobs: (
      <ProfileSectionCard
        title="Open opportunities"
        action={<span className="org-public-small">{jobs.length} active</span>}
      >
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
          <EmptyState
            compact
            icon="briefcase"
            title="No open positions right now"
            description={preview ? "Published jobs will appear here." : "New roles from this organization will appear here."}
            action={!preview && home.jobs ? <LinkButton href={home.jobs}>Browse other jobs</LinkButton> : undefined}
          />
        )}
      </ProfileSectionCard>
    ),
    details: (
      <div className="stack">
        <ProfileSectionCard title="Organization details">
          <dl className="org-public-details">
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
        </ProfileSectionCard>
        {(o.publicContactEmail || o.publicPhone || safeUrl(o.socialLinks.linkedin) || safeUrl(o.socialLinks.other) || safeUrl(o.careersUrl)) ? (
          <ProfileSectionCard title="Connect with us">
            <div className="org-public-connect stack">
              {o.publicContactEmail ? (
                <a href={"mailto:" + o.publicContactEmail}>
                  <Icon name="mail" />
                  {o.publicContactEmail}
                </a>
              ) : null}
              {o.publicPhone ? (
                <p>
                  <Icon name="phone" />
                  {o.publicPhone}
                </p>
              ) : null}
              <External label="LinkedIn" url={o.socialLinks.linkedin} />
              <External label="Social profile" url={o.socialLinks.other} />
              <External label="Careers page" url={o.careersUrl} />
            </div>
          </ProfileSectionCard>
        ) : null}
      </div>
    ),
  };

  const tabs: PublicProfileTab[] = tabDefs.map((def) => ({
    id: def.id,
    label: def.label,
    panel: panels[def.id] ?? null,
  }));

  return (
    <div className="org-public-page">
      {preview ? (
        <div className="org-preview-banner">
          <div>
            <Icon name="eye" />
            <span>
              <strong>Public profile preview</strong>
              {devCopy("Reflects your current local edits. ", "Reflects your current edits. ")}
              {o.profileVisibility === "Hidden" ? "Organization visibility is Hidden." : ""}
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
      <PublicProfileHeader
        variant="organization"
        person={{
          id: o.id,
          name: o.name,
          headline: o.tagline || o.industry || "",
          cover: o.coverImageUrl || "",
          followerCount: o.followerCount ?? 0,
          location: locationFacts,
        }}
        bio={bio === o.tagline ? o.description || "" : bio}
        links={links}
        logoUrl={o.logoUrl || ""}
        own={preview || viewer.own}
        following={viewer.following}
        editHref={preview || viewer.own ? "/recruiter/company?section=" + encodeURIComponent(section) : undefined}
        titleBadge={<VerifiedCompanyMark status={o.verificationStatus} />}
        coverFallback="GOOD WORK STARTS WITH GOOD PEOPLE."
      />
      <PublicProfileTabs tabs={tabs} profileKey={o.slug || o.id} />
      {!inWorkspace && (
        <DevOnly>
          <p className="org-demo-caption">Fictional company data. Verification badges represent explicit demo review states.</p>
        </DevOnly>
      )}
    </div>
  );
}

function RecruiterPage({ r, o, preview, editHref, inWorkspace = false, viewer = { own: false, following: false } }: { r: PublicRecruiter; o: PublicOrganization; preview: boolean; editHref: string; inWorkspace?: boolean; viewer?: PublicProfileViewer }) {
  const pathname = usePathname();
  const jobActions = useJobActions();
  const home = useAreaHome();
  const companyHref = o.profileVisibility === "Public" && o.slug
    ? inWorkspace
      ? organizationProfileHref(pathname.startsWith("/recruiter") ? "recruiter" : "professional", o.slug)
      : "/organizations/" + o.slug
    : undefined;
  const orgSlug = o.profileVisibility === "Public" && o.slug ? o.slug : "";
  const orgJobsQuery = useServiceQuery(
    ["organization", "public", orgSlug],
    (s) => s.organization.getPublicOrganization(orgSlug),
    { enabled: !!orgSlug, keepPreviousData: false },
  );
  const openJobs = orgJobsQuery.data?.openJobs ?? [];
  const tabDefs = useMemo(
    () => recruiterPublicTabDefs({ organization: o, jobCount: openJobs.length }),
    [o, openJobs.length],
  );
  const avatar = recruiterAvatar(r);
  const links = takePublicLinks([
    ...(r.professionalLinks.linkedin ? [{ label: "LinkedIn", url: r.professionalLinks.linkedin }] : []),
  ]);

  const panels: Partial<Record<PublicProfileTabId, ReactNode>> = {
    overview: (
      <div className="stack">
        <ProfileSectionCard title="About">
          {r.professionalBio ? <Paragraph value={r.professionalBio} /> : <EmptyState compact icon="user" title="No bio yet" description="This recruiter hasn’t added a public bio yet." />}
          <External label="LinkedIn" url={r.professionalLinks.linkedin} className="org-recruiter-link" />
        </ProfileSectionCard>
        {r.hiringDepartments.length > 0 ? (
          <ProfileSectionCard title="Hiring focus">
            <Chips items={r.hiringDepartments} />
          </ProfileSectionCard>
        ) : null}
        {r.hiringLocations.length > 0 ? (
          <ProfileSectionCard title="Hiring locations">
            <Chips items={r.hiringLocations} />
          </ProfileSectionCard>
        ) : null}
      </div>
    ),
    company: (
      <div className="stack">
        <ProfileSectionCard
          title={o.name || "Company"}
          action={
            companyHref ? (
              <LinkButton href={companyHref} variant="text sm" icon="arrow">
                View company page
              </LinkButton>
            ) : null
          }
        >
          {o.tagline ? <p className="muted">{o.tagline}</p> : null}
          <Paragraph value={o.description} />
          <Paragraph value={o.overview} />
          <div className="org-public-facts">
            {[o.industry, o.companySize, o.organizationType, o.foundingYear ? `Founded ${o.foundingYear}` : "", [o.headquartersCity, o.headquartersCountry].filter(Boolean).join(", "), o.hiringStatus]
              .filter(Boolean)
              .map((fact) => (
                <span key={fact}>{fact}</span>
              ))}
          </div>
          {(o.mission || o.vision) && (
            <div className="org-public-mission">
              {o.mission ? (
                <article className="org-public-mission-card">
                  <h3>Our mission</h3>
                  <Paragraph value={o.mission} />
                </article>
              ) : null}
              {o.vision ? (
                <article className="org-public-mission-card">
                  <h3>Our vision</h3>
                  <Paragraph value={o.vision} />
                </article>
              ) : null}
            </div>
          )}
        </ProfileSectionCard>
      </div>
    ),
    jobs: (
      <ProfileSectionCard
        title="Open opportunities"
        action={<span className="org-public-small">{openJobs.length} active</span>}
      >
        {openJobs.map((j) => (
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
        ))}
        {!preview && home.jobs ? (
          <div style={{ marginTop: 12 }}>
            <LinkButton href={home.jobs} variant="text" icon="arrow">
              Browse other jobs
            </LinkButton>
          </div>
        ) : null}
      </ProfileSectionCard>
    ),
  };

  const tabs: PublicProfileTab[] = tabDefs.map((def) => ({
    id: def.id,
    label: def.label,
    panel: panels[def.id] ?? null,
  }));

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
      <PublicProfileHeader
        person={{
          id: r.id,
          name: r.fullName,
          headline: r.jobTitle,
          picture: avatar.picture,
          color: avatar.color,
          cover: o.coverImageUrl || "",
          followerCount: r.followerCount ?? 0,
        }}
        bio={r.professionalBio}
        links={links}
        own={preview || viewer.own}
        following={viewer.following}
        editHref={editHref || "/recruiter/profile"}
        coverFallback="GOOD WORK STARTS WITH GOOD PEOPLE."
        headlineInFacts
        association={
          <p className="org-recruiter-company">
            {companyHref ? (
              <Link href={companyHref} className="org-recruiter-company-link">
                {o.name}
              </Link>
            ) : (
              <span className="org-recruiter-company-link">{o.name}</span>
            )}
            <VerifiedCompanyMark status={o.verificationStatus} />
          </p>
        }
      />
      <PublicProfileTabs tabs={tabs} profileKey={r.id} />
      {!inWorkspace && (
        <DevOnly>
          <p className="org-demo-caption">Public identity excludes account email, internal role, and permissions.</p>
        </DevOnly>
      )}
    </div>
  );
}

export function PublicOrganizationScreen({ slug, inWorkspace = false }: { slug: string; inWorkspace?: boolean }) {
  const { data, isPending, isError, error, refetch } = useServiceQuery(["organization", "public", slug], (s) => s.organization.getPublicOrganization(slug),{ keepPreviousData: false });
  if (isError) return <PendingPublicPage kind="organization" label="Loading organization" error={error} onRetry={() => void refetch()} errorTitle="This organization couldn’t load" />;
  if (isPending) return <PendingPublicPage kind="organization" label="Loading organization" errorTitle="This organization couldn’t load" />;
  if (!data) return <Unavailable icon="compass" title="Organization profile unavailable" description="This profile is hidden or the address has changed." />;
  return <OrganizationPage o={data.organization} jobs={data.openJobs} preview={false} inWorkspace={inWorkspace} viewer={data.viewer} />;
}

export function OrganizationPreviewScreen() {
  const { query, ctx, draft } = useOrganizationEditor();
  if (query.isError) return <PendingPublicPage kind="organization" banner={<OrganizationPreviewBanner />} label="Loading preview" error={query.error} onRetry={() => void query.refetch()} errorTitle="The preview couldn’t load" />;
  if (!ctx || !draft) return <PendingPublicPage kind="organization" banner={<OrganizationPreviewBanner />} label="Loading preview" errorTitle="The preview couldn’t load" />;
  return <OrganizationPage o={publicOrganization(draft.organization)} jobs={ctx.openJobs} preview />;
}

export function PublicRecruiterScreen({ id, inWorkspace = false }: { id: string; inWorkspace?: boolean }) {
  const { data, isPending, isError, error, refetch } = useServiceQuery(["recruiter", "public", id], (s) => s.organization.getPublicRecruiter(id),{ keepPreviousData: false });
  if (isError) return <PendingPublicPage kind="recruiter" label="Loading recruiter profile" error={error} onRetry={() => void refetch()} errorTitle="This recruiter profile couldn’t load" />;
  if (isPending) return <PendingPublicPage kind="recruiter" label="Loading recruiter profile" errorTitle="This recruiter profile couldn’t load" />;
  if (!data) return <Unavailable icon="lock" title="Recruiter profile unavailable" description="This profile is not currently public." />;
  return <RecruiterPage r={data.recruiter} o={data.organization} preview={false} editHref="" inWorkspace={inWorkspace} viewer={data.viewer} />;
}

export function RecruiterPreviewScreen() {
  const idParam = useSearchParams().get("id");
  const { query, ctx } = useOrganizationEditor();
  const id = idParam || ctx?.currentRecruiter.id;
  const member = ctx?.workspace.recruiters.find((r) => r.id === id);
  const { draft } = useRecruiterDraft(member);
  const banner = (
    <div className="org-preview-banner">
      <span>
        <Icon name="eye" />
        Recruiter profile preview
      </span>
      {ctx && id ? (
        <LinkButton href={id === ctx.currentRecruiter.id ? "/recruiter/profile" : "/recruiter/team/" + id} variant="sm" icon="edit">
          Return to edit
        </LinkButton>
      ) : null}
    </div>
  );
  if (query.isError) return <PendingPublicPage kind="recruiter" banner={banner} label="Loading preview" error={query.error} onRetry={() => void query.refetch()} errorTitle="The preview couldn’t load" />;
  if (!ctx) return <PendingPublicPage kind="recruiter" banner={banner} label="Loading preview" errorTitle="The preview couldn’t load" />;
  if (!member) return <Unavailable icon="compass" title="Recruiter profile unavailable" description="This team member couldn’t be found in your organization." />;
  if (!draft) return <PendingPublicPage kind="recruiter" banner={banner} label="Loading preview" errorTitle="The preview couldn’t load" />;
  return <RecruiterPage r={publicRecruiter(draft)} o={publicOrganization(ctx.workspace.organization)} preview editHref={id === ctx.currentRecruiter.id ? "/recruiter/profile" : "/recruiter/team/" + id} />;
}
