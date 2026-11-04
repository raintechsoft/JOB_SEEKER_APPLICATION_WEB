"use client";

import { ScreenError } from "@/components/ui/feedback";
import { PublicProfileLoadingSkeleton } from "@/features/talent/public-profile-skeleton";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useProjectDialogs } from "@/features/work/dialogs";
import { toast } from "@/stores/toast-store";
import type { CandidateView } from "@/services/talent/talent.service";
import type { PublicCredentials as Credentials } from "@/services/talent/public-profile";
import { firstName } from "@/lib/utils/text";
import { devCopy } from "@/lib/env/app-env";
import { DevOnly } from "@/components/ui/dev-only";
import { useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { Button, EmptyState, LinkButton } from "@/components/ui/primitives";
import { QueryView } from "@/components/ui/query-view";
import { PublicCredentials } from "@/components/portfolio/public-credentials";
import {
  ProfileProjectList,
  ProfileSectionCard,
  ProfileSkillList,
  ProfileTimelineEntries,
} from "@/components/profile/profile-public-sections";
import { PulseCard, UpdateItem } from "@/components/work/pulse";
import { workPulseUiEnabled } from "@/features/work/work-pulse-ui-policy";
import { CareerJourney } from "@/features/journey/career-journey";
import {
  certificationRecords,
  otherCredentialGroups,
  publicSkills,
  seekerPublicTabDefs,
  type PublicProfileTabId,
} from "@/features/talent/public-profile-sections";
import { PublicProfileTabs, type PublicProfileTab } from "@/features/talent/public-profile-tabs";
import { portfolioUiEnabled } from "@/features/portfolio/portfolio-ui-policy";
import { COMPARE_CANDIDATES_ENABLED } from "@/lib/feature-flags";
import type { PublicSkillRecord } from "@/services/talent/public-profile";
import { SuggestionCardGrid } from "@/components/suggestions/suggestion-card";
import { TalentCard } from "@/components/talent/talent-card";
import { PublicProfileHeader, takePublicLinks } from "./public-profile-header";
import { useCompareToggle, useShortlistDialogs } from "./dialogs";

const SIMILAR_CANDIDATES_LIMIT = 10;

function skillRecordsFor(p: CandidateView["person"]): PublicSkillRecord[] {
  if (p.skillRecords?.length) return p.skillRecords;
  return publicSkills(p.skills).map((name, index) => ({ id: `skill-${index}`, name }));
}

function credentialsWithoutCertifications(credentials: Credentials): Credentials {
  return {
    ...credentials,
    groups: otherCredentialGroups(credentials),
  };
}

function certificationsOnly(credentials: Credentials): Credentials {
  const records = certificationRecords(credentials);
  return {
    groups: records.length ? [{ label: "Certifications", records }] : [],
    breaks: [],
    contact: {},
  };
}

function professionalPublicLinks(p: CandidateView["person"]) {
  const links = [
    ...(p.website ? [{ label: "Website", url: p.website }] : []),
    ...(p.credentials.groups.find((g) => g.label === "Professional links")?.records ?? [])
      .filter((r) => !!r.url)
      .map((r) => ({ label: r.linkLabel || r.title || "Link", url: r.url! })),
  ];
  return takePublicLinks(links);
}

function Candidate({ view, publicView, inWorkspace = false }: { view: CandidateView; publicView: boolean; inWorkspace?: boolean }) {
  const { person: p, projects, updates } = view;
  const shortlists = useShortlistDialogs();
  const compared = useUiStore((s) => s.compared);
  const toggleCompare = useCompareToggle();
  const viewer = view.viewer ?? { own: false, following: false };
  const showPortfolio = portfolioUiEnabled() && !!view.portfolioSlug.trim();
  const skillRecords = skillRecordsFor(p);
  const employmentRecords = p.employmentRecords ?? [];
  const educationRecords = p.educationRecords ?? [];
  const tabDefs = useMemo(
    () =>
      seekerPublicTabDefs({
        experience: p.experience,
        education: p.education,
        skills: p.skills,
        skillRecords,
        employmentRecords,
        educationRecords,
        projects,
        portfolioSlug: view.portfolioSlug,
        portfolioUiEnabled: portfolioUiEnabled(),
        credentials: p.credentials,
        updates,
      }),
    [
      educationRecords,
      employmentRecords,
      p.credentials,
      p.education,
      p.experience,
      p.skills,
      projects,
      skillRecords,
      updates,
      view.portfolioSlug,
    ],
  );

  const panels: Partial<Record<PublicProfileTabId, ReactNode>> = {
    overview: (
      <div className="stack">
        <ProfileSectionCard title="Overview">
          {p.summary ? <p className="profile-body-copy">{p.summary}</p> : <p className="profile-empty">No summary yet.</p>}
        </ProfileSectionCard>
        {workPulseUiEnabled() ? <PulseCard ownerId={p.id} hideWhenEmpty /> : null}
        <CareerJourney slug={p.slug} />
        {showPortfolio ? (
          <section className="card side-card">
            <h3>A little more of the story.</h3>
            <p style={{ margin: "12px 0 18px" }}>Explore {firstName(p.name)}’s work in a space of their own.</p>
            <LinkButton href={"/portfolio/" + view.portfolioSlug} variant="primary" icon="arrowUp">
              View portfolio
            </LinkButton>
          </section>
        ) : null}
      </div>
    ),
    experience: (
      <ProfileSectionCard title="Employment">
        {employmentRecords.length ? (
          <ProfileTimelineEntries collection="employment" records={employmentRecords} projects={projects} />
        ) : (
          <p className="profile-body-copy" style={{ whiteSpace: "pre-line" }}>
            {p.experience}
          </p>
        )}
      </ProfileSectionCard>
    ),
    education: (
      <ProfileSectionCard title="Education">
        {educationRecords.length ? (
          <ProfileTimelineEntries collection="education" records={educationRecords} projects={projects} />
        ) : (
          <p className="profile-body-copy" style={{ whiteSpace: "pre-line" }}>
            {p.education}
          </p>
        )}
      </ProfileSectionCard>
    ),
    skills: (
      <ProfileSectionCard title="Key skills">
        <ProfileSkillList skills={skillRecords} />
      </ProfileSectionCard>
    ),
    projects: (
      <ProfileSectionCard title="Projects">
        {projects.length ? (
          <ProfileProjectList projects={projects} />
        ) : showPortfolio ? (
          <section className="card side-card" style={{ boxShadow: "none", border: 0, padding: 0 }}>
            <h3>A little more of the story.</h3>
            <p style={{ margin: "12px 0 18px" }}>Explore {firstName(p.name)}’s work in a space of their own.</p>
            <LinkButton href={"/portfolio/" + view.portfolioSlug} variant="primary" icon="arrowUp">
              View portfolio
            </LinkButton>
          </section>
        ) : (
          <p className="profile-empty">Show what you do through the projects you’ve helped build.</p>
        )}
      </ProfileSectionCard>
    ),
    certifications: (
      <ProfileSectionCard title="Certifications">
        <PublicCredentials credentials={certificationsOnly(p.credentials)} includeContact={false} />
      </ProfileSectionCard>
    ),
    credentials: (
      <ProfileSectionCard title="Credentials">
        <PublicCredentials credentials={credentialsWithoutCertifications(p.credentials)} />
      </ProfileSectionCard>
    ),
    ...(workPulseUiEnabled()
      ? {
          activity: (
            <ProfileSectionCard title="Activity">
              {updates.map((u) => (
                <UpdateItem key={u.id} update={u} />
              ))}
            </ProfileSectionCard>
          ),
        }
      : {}),
  };

  const tabs: PublicProfileTab[] = tabDefs.map((def) => ({
    id: def.id,
    label: def.label,
    panel: panels[def.id] ?? null,
  }));

  return (
    <>
      {!publicView && <Suspense fallback={null}><ProjectSearchTarget view={view} /></Suspense>}
      {!inWorkspace && (
        <div className="row between print-hide" style={{ marginBottom: 18 }}>
          <Link href={publicView ? "/search?scope=people" : "/recruiter/discover"} className="small muted">
            ← Back to people
          </Link>
          <DevOnly>
            <span className="tag">Fictional demo professional</span>
          </DevOnly>
        </div>
      )}
      <PublicProfileHeader
        person={{
          id: p.id,
          name: p.name,
          headline: p.headline,
          picture: p.picture,
          color: p.color,
          cover: p.cover,
          followerCount: p.followerCount ?? 0,
          location: p.location,
          years: p.years,
        }}
        bio={p.summary}
        links={professionalPublicLinks(p)}
        own={viewer.own}
        following={viewer.following}
        editHref="/app/profile"
        extras={
          !publicView && !inWorkspace && !viewer.own ? (
            <Button icon="bookmark" onClick={() => shortlists.choose(p.id)}>
              {view.saved ? "Saved to shortlist" : "Save to shortlist"}
            </Button>
          ) : null
        }
      />
      <PublicProfileTabs tabs={tabs} profileKey={p.slug || p.id} />
      {!publicView && (
        <aside className="stack" style={{ marginTop: 8 }}>
          <SimilarCandidates id={p.id} />
          {COMPARE_CANDIDATES_ENABLED ? (
            <section className="card side-card">
              <h3>Compare with context</h3>
              <p style={{ margin: "12px 0 18px" }}>Look at skills, projects, experience, and recorded activity side by side.</p>
              <Button icon="compare" onClick={() => toggleCompare(p.id)}>
                {compared.includes(p.id) ? "Remove from comparison" : "Add to comparison"}
              </Button>
              <LinkButton href="/recruiter/compare" variant="text" icon="arrow">
                View comparison
              </LinkButton>
            </section>
          ) : null}
        </aside>
      )}
    </>
  );
}

/** Recruiters: people close to this candidate (E6) — meaning when embeddings are on, shared skills otherwise. */
function SimilarCandidates({ id }: { id: string }) {
  const { data } = useServiceQuery(["similar-people", id], (s) => s.recommendations.similarPeople(id, SIMILAR_CANDIDATES_LIMIT));
  if (!data?.length) return null;
  return (
    <section className="similar-candidates" aria-labelledby={`similar-people-${id}`} style={{ marginTop: 8 }}>
      <h3 id={`similar-people-${id}`} style={{ marginBottom: 14 }}>Similar candidates</h3>
      <SuggestionCardGrid>
        {data.map((person) => (
          <TalentCard key={person.id} person={person} />
        ))}
      </SuggestionCardGrid>
    </section>
  );
}

function ProjectSearchTarget({ view }: { view: CandidateView }) {
  const params = useSearchParams(), requested = params.get("project");
  const opened = useRef<string | null>(null); const { view: open } = useProjectDialogs();
  useEffect(() => {
    if (!requested || opened.current === requested || !view.projects.some(project => project.id === requested)) return;
    opened.current = requested;
    void open(requested).catch(() => toast("This project is no longer available.", "error"));
  }, [requested, view.projects, open]);
  return null;
}

/** Where to send people from a missing or private profile without leaving their current area. */
function useTalentEscape() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/recruiter")) return { href: "/recruiter/talent", label: "Back to talent search" };
  if (pathname.startsWith("/app")) return { href: "/app/dashboard", label: "Back to feed" };
  return { href: "/search?scope=people", label: "Search people" };
}

export function NotFoundState({ what = "profile" }: { what?: "profile" | "portfolio" }) {
  const escape = useTalentEscape();
  return (
    <EmptyState
      icon="compass"
      title={`We can’t find this ${what}`}
      description="It may have been removed, or the link may be wrong."
      action={
        <LinkButton href={escape.href} variant="primary">
          {escape.label}
        </LinkButton>
      }
    />
  );
}

export function PrivateState({ what = "profile", description }: { what?: "profile" | "portfolio"; description: string }) {
  const escape = useTalentEscape();
  return <EmptyState icon="lock" title={`This ${what} is private`} description={description} action={<LinkButton href={escape.href} variant="primary">{escape.label}</LinkButton>} />;
}

/** Profile frame shown while the candidate loads or fails to load. */
function CandidatePendingFrame({ publicView, inWorkspace = false, error, cause, retry }: { publicView: boolean; inWorkspace?: boolean; error: boolean; cause: unknown; retry: () => unknown }) {
  const escape = useTalentEscape();
  return (
    <>
      {!inWorkspace && (
        <div className="row between print-hide" style={{ marginBottom: 18 }}>
          <Link href={publicView ? "/search?scope=people" : "/recruiter/discover"} className="small muted">
            ← Back to people
          </Link>
        </div>
      )}
      {error ? (
        <ScreenError error={cause} onRetry={() => void retry()} title="This profile couldn’t load" homeHref={escape.href} homeLabel={escape.label} />
      ) : (
        <PublicProfileLoadingSkeleton />
      )}
    </>
  );
}

/** Candidate profile for recruiters (`/recruiter/talent/[id]`). */
export function RecruiterCandidateScreen({ id }: { id: string }) {
  const query = useServiceQuery(["candidate", id], (s) => s.talent.getCandidate(id),{ keepPreviousData: false });
  if (query.data === undefined) return <CandidatePendingFrame publicView={false} error={query.isError} cause={query.error} retry={() => query.refetch()} />;
  return <QueryView query={query} fallback={null}>{(view) => (view ? <Candidate view={view} publicView={false} /> : <NotFoundState />)}</QueryView>;
}

/**
 * Public professional profile (`/professionals/[slug]`), or the in-app workspace view (`/app/professionals/[slug]`).
 * `embedded` renders inside a shell that already provides <main> (the public browsing section).
 */
export function PublicCandidateScreen({ slug, inWorkspace = false, embedded = false }: { slug: string; inWorkspace?: boolean; embedded?: boolean }) {
  const query = useServiceQuery(["candidate", "slug", slug], (s) => s.talent.getCandidateBySlug(slug),{ keepPreviousData: false });
  if (query.data === undefined) {
    const pending = <CandidatePendingFrame publicView inWorkspace={inWorkspace} error={query.isError} cause={query.error} retry={() => query.refetch()} />;
    return inWorkspace ? pending : embedded ? <div className="public-profile-page">{pending}</div> : <main id="main" className="container" style={{ paddingTop: 25, paddingBottom: 60 }}>{pending}</main>;
  }
  return (
    <QueryView query={query} fallback={null}>
      {(view) => {
        const profile = !view ? (
          <NotFoundState />
        ) : !view.person.public ? (
          <PrivateState description={devCopy("Explore other professionals in the demo directory.", inWorkspace ? "This person keeps their profile private." : "This person keeps their profile private. Explore other professionals in the directory.")} />
        ) : (
          <Candidate view={view} publicView inWorkspace={inWorkspace} />
        );
        if (embedded) return <div className="public-profile-page">{profile}</div>;
        return inWorkspace ? profile : (
          <main id="main" className={!view || !view.person.public ? "container section" : "container"} style={!view || !view.person.public ? undefined : { paddingTop: 25, paddingBottom: 60 }}>
            {profile}
          </main>
        );
      }}
    </QueryView>
  );
}
