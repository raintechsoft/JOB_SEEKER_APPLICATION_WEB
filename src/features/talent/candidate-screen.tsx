"use client";

import { ScreenFallback } from "@/components/ui/feedback";

import Link from "next/link";
import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useProjectDialogs } from "@/features/work/dialogs";
import { toast } from "@/stores/toast-store";
import type { CandidateView } from "@/services/talent/talent.service";
import { firstName } from "@/lib/utils/text";
import { devCopy } from "@/lib/env/app-env";
import { DevOnly } from "@/components/ui/dev-only";
import { useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Badge, Button, EmptyState, LinkButton, Tags } from "@/components/ui/primitives";
import { QueryView } from "@/components/ui/query-view";
import { PublicCredentials, hasPublicCredentials } from "@/components/portfolio/public-credentials";
import { ProjectCard } from "@/components/work/project-card";
import { PulseCard, UpdateItem } from "@/components/work/pulse";
import { CareerJourney } from "@/features/journey/career-journey";
import { useCompareToggle, useContactCandidate, useShortlistDialogs } from "./dialogs";

function Candidate({ view, publicView }: { view: CandidateView; publicView: boolean }) {
  const { person: p, projects, updates } = view;
  const shortlists = useShortlistDialogs();
  const contact = useContactCandidate();
  const compared = useUiStore((s) => s.compared);
  const toggleCompare = useCompareToggle();
  return (
    <>
      {!publicView && <Suspense fallback={null}><ProjectSearchTarget view={view} /></Suspense>}
      <div className="row between print-hide" style={{ marginBottom: 18 }}>
        <Link href={publicView ? "/talent" : "/recruiter/discover"} className="small muted">
          ← Back to talent
        </Link>
        <DevOnly>
          <span className="tag">Fictional demo professional</span>
        </DevOnly>
      </div>
      <div className="profile-cover" />
      <header className="profile-header">
        <div className="row between">
          <Avatar person={p} size="xl" />
          <div className="row wrap" style={{ paddingTop: 18 }}>
            <Button icon="bookmark" onClick={() => shortlists.choose(p.id)}>
              {view.saved ? "Saved to shortlist" : "Save to shortlist"}
            </Button>
            <Button variant="primary" icon="message" onClick={() => contact(p.id)}>
              Start a conversation
            </Button>
          </div>
        </div>
        <h1>{p.name}</h1>
        <p>{p.headline}</p>
        <div className="row wrap">
          <span className="small muted">
            <Icon name="location" /> {p.location}
          </span>
          <span className="small muted">
            {p.years} years experience · {p.arrangement}
          </span>
          <Badge>{p.available ? "Open to opportunities" : "Open to connections"}</Badge>
        </div>
      </header>
      <div className="profile-content">
        <div className="stack">
          <section className="card profile-section">
            <h2>The person behind the work</h2>
            <p>{p.summary}</p>
            <hr className="divider" />
            <h2>Skills & expertise</h2>
            <Tags items={p.skills} />
          </section>
          <section>
            <div className="card-head">
              <h2>Selected projects</h2>
              <span className="small muted">{projects.length} public projects</span>
            </div>
            <div className="grid cols2">
              {projects.map((pr) => (
                <ProjectCard key={pr.id} project={pr} />
              ))}
            </div>
          </section>
          <PulseCard ownerId={p.id} />
          <CareerJourney slug={p.slug}/>
          <section className="card profile-section">
            <h2>Notes from the process</h2>
            {updates.length ? updates.map((u) => <UpdateItem key={u.id} update={u} />) : <p>No public updates yet.</p>}
          </section>
        </div>
        <aside className="stack">
          <section className="card profile-section">
            <h2>Professional background</h2>
            <p>{p.experience}</p>
            <hr className="divider" />
            <h2>Education</h2>
            <p style={{ whiteSpace: "pre-line" }}>{p.education}</p>
            {hasPublicCredentials(p.credentials) && (
              <>
                <hr className="divider" />
                <PublicCredentials credentials={p.credentials} />
              </>
            )}
            <hr className="divider" />
            <h2>Career interests</h2>
            <p>{p.interests}</p>
          </section>
          <section className="card side-card">
            <h3>A little more of the story.</h3>
            <p style={{ margin: "12px 0 18px" }}>Explore {firstName(p.name)}’s work in a space of their own.</p>
            <LinkButton href={"/portfolio/" + view.portfolioSlug} variant="primary" icon="arrowUp">
              View portfolio
            </LinkButton>
          </section>
          {!publicView && (
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
          )}
        </aside>
      </div>
    </>
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

export function NotFoundState() {
  return (
    <EmptyState
      title="This chapter hasn’t been written."
      description="That page could not be found."
      action={
        <LinkButton href="/" variant="primary">
          Back to Skillora
        </LinkButton>
      }
    />
  );
}

/** Candidate profile for recruiters (`/recruiter/talent/[id]`). */
export function RecruiterCandidateScreen({ id }: { id: string }) {
  const query = useServiceQuery(["candidate", id], (s) => s.talent.getCandidate(id),{ keepPreviousData: false });
  return <QueryView query={query} fallback={<ScreenFallback layout="profile" />}>{(view) => (view ? <Candidate view={view} publicView={false} /> : <NotFoundState />)}</QueryView>;
}

/** Public professional profile (`/professionals/[slug]`). */
export function PublicCandidateScreen({ slug }: { slug: string }) {
  const query = useServiceQuery(["candidate", "slug", slug], (s) => s.talent.getCandidateBySlug(slug),{ keepPreviousData: false });
  return (
    <QueryView query={query} fallback={<ScreenFallback layout="profile" />}>
      {(view) =>
        !view ? (
          <main id="main" className="container section">
            <NotFoundState />
          </main>
        ) : !view.person.public ? (
          <main id="main" className="container section">
            <EmptyState title="This profile is private." description={devCopy("Explore other professionals in the demo directory.", "Explore other professionals in the directory.")} action={<LinkButton href="/talent">Explore talent</LinkButton>} />
          </main>
        ) : (
          <main id="main" className="container" style={{ paddingTop: 25, paddingBottom: 60 }}>
            <Candidate view={view} publicView />
          </main>
        )
      }
    </QueryView>
  );
}
