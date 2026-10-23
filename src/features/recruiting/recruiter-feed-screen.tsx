"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { FeedFilter } from "@/services/feed/feed.service";
import { timeAgo } from "@/lib/utils/date";
import { devCopy } from "@/lib/env/app-env";
import { useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, EmptyState, LinkButton } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { FeedCard } from "@/features/feed/feed-card";
import { FeedToolbar, useCompose } from "@/features/feed/feed-parts";
import { useNetworkSheet } from "@/features/feed/network-sheet";
import { useFeedParams } from "@/features/feed/use-feed-params";
import { openReview } from "./review-dialog";
import { PermalinkEntry } from "@/features/feed/permalink-entry";

const TABS: [FeedFilter, string, boolean][] = [
  ["all", "For you", false],
  ["following", "Following", false],
  ["jobs", "Your jobs", false],
  ["saved", "Saved", false],
];

function ProfileRail() {
  const { data: shell } = useServiceQuery(["shell", "recruiter"], (s) => s.workspace.getRecruiterShell());
  const { data: hiring } = useServiceQuery(["hiring-summary"], (s) => s.recruiting.getHiringSummary());
  if (!shell || !hiring) return <aside className="feed-profile-column" tabIndex={0} aria-label="Recruiter profile and hiring" />;
  return (
    <aside className="feed-profile-column" tabIndex={0} aria-label="Recruiter profile and hiring">
      <section className="card feed-profile">
        <div className="feed-welcome">
          <h1>Welcome back, {shell.identity.name.split(" ")[0]}.</h1>
        </div>
        <div className="feed-profile-cover">
          <span>YOUR HIRING STORY.</span>
          <i />
          <i />
          <i />
        </div>
        <div className="feed-profile-details">
          <Link href="/recruiter/company" className="feed-avatar-link">
            <Avatar person={shell.identity} size="xl" />
            <span className="avatar-edit">
              <Icon name="edit" />
            </span>
          </Link>
          <h2>
            <Link href="/recruiter/company">{shell.identity.name}</Link>
          </h2>
          <p className="feed-profile-headline">{shell.title}</p>
          <p className="feed-location">
            <Icon name="building" />
            {shell.companyName}
          </p>
        </div>
      </section>
      <section className="card recruiter-summary">
        <h2>Your hiring, in focus</h2>
        <Link href="/recruiter/jobs">
          <span>Open job posts</span>
          <strong>{hiring.openJobs}</strong>
        </Link>
        <Link href="/recruiter/applications?view=responses">
          <span>Received applications</span>
          <strong>{hiring.received}</strong>
        </Link>
        <Link href="/recruiter/applications?stage=New">
          <span>New to review</span>
          <strong>{hiring.newCount}</strong>
        </Link>
      </section>
      <section className="card feed-connections">
        <Link href="/recruiter/discover">
          <span>
            <Icon name="search" />
            Discover talent
          </span>
          <Icon name="arrowUp" />
        </Link>
        <Link href="/recruiter/shortlists">
          <span>
            <Icon name="bookmark" />
            Your shortlists
          </span>
          <strong>{hiring.shortlistCount}</strong>
        </Link>
        <Link href="/recruiter/dashboard?view=saved">
          <span>
            <Icon name="bookmark" />
            Saved posts
          </span>
          <strong>{shell.savedCount}</strong>
        </Link>
      </section>
      <DevOnly>
        <div className="feed-local-note">
          <Icon name="shield" />
          <p>Recruiter demo · Fictional people and jobs. Posts, applications, and hiring notes stay in this browser.</p>
        </div>
      </DevOnly>
    </aside>
  );
}

function HiringRail() {
  const router = useRouter();
  const { data } = useServiceQuery(["hiring-summary"], (s) => s.recruiting.getHiringSummary());
  return (
    <aside className="recruiter-hiring-rail" aria-label="Your hiring overview">
      <section className="card recruiter-rail-card">
        <span className="eyebrow">YOUR NEXT TEAMMATE</span>
        <h2>Applications to review</h2>
        <p>Keep your next connection in sight.</p>
        {data?.newApplications.length ? (
          data.newApplications.map((a) => (
            <button type="button" className="recruiter-mini-app" key={a.id} onClick={() => openReview(a.id)}>
              <Avatar person={a.person} />
              <span>
                <strong>{a.person.name}</strong>
                <small>{a.jobTitle}</small>
                <small>{timeAgo(a.createdAt)}</small>
              </span>
              <Icon name="chevron" />
            </button>
          ))
        ) : (
          <p>You’re up to date. New applications will appear here.</p>
        )}
        <LinkButton href="/recruiter/applications?view=responses" variant="text sm" icon="arrow">
          View all applications
        </LinkButton>
      </section>
      <section className="card recruiter-rail-card">
        <div className="row between">
          <h2>Your job posts</h2>
          <span className="tag">{data?.openJobs ?? 0} open</span>
        </div>
        {data?.jobs.map((j) => (
          <div className="recruiter-rail-job" key={j.id}>
            <strong>{j.title}</strong>
            <p>
              {j.location} · {j.arrangement}
            </p>
            <Link href={"/recruiter/applications?job=" + j.id}>
              {j.applications} applications <Icon name="arrowUp" />
            </Link>
          </div>
        ))}
        <Button variant="primary sm" icon="plus" onClick={() => router.push("/recruiter/jobs/new")}>
          Post a job
        </Button>
      </section>
    </aside>
  );
}

export function RecruiterFeedScreen() {
  const feed = useUiStore((s) => s.feed);
  const setFeed = useUiStore((s) => s.setFeed);
  const router = useRouter();
  const pathname = usePathname();
  const highlight = useSearchParams().get("post");
  const compose = useCompose("recruiter");
  const network = useNetworkSheet();
  useFeedParams("recruiter");
  const { data: shell } = useServiceQuery(["shell", "recruiter"], (s) => s.workspace.getRecruiterShell());
  const { data, isError, refetch } = useServiceQuery(["feed", "recruiter", feed.filter, feed.sort, feed.query, feed.visible], (s) => s.feed.getFeed({ role: "recruiter", filter: feed.filter, sort: feed.sort, q: feed.query, limit: feed.visible }));
  useEffect(() => {
    if (highlight && data) requestAnimationFrame(() => document.getElementById("feed-" + highlight)?.scrollIntoView({ block: "start" }));
  }, [highlight, data]);
  return (
    <div className="professional-feed-layout recruiter-feed-layout">
      <ProfileRail />
      <section className="feed-timeline" aria-label="Recruiter community feed">
        <div className="feed-heading">
          {isError && <p role="alert">The feed could not be loaded. <Button onClick={()=>void refetch()}>Try again</Button></p>}
          <div>
            <span className="eyebrow">GOOD WORK. GOOD PEOPLE.</span>
            <h2>Your next great hire starts here.</h2>
            <p>Discover the work, people, and ideas behind your next team.</p>
          </div>
        </div>
        <section className="card feed-composer">
          <div className="row">
            {shell ? <Avatar person={shell.identity} /> : <span className="avatar" />}
            <button type="button" className="feed-start-post" onClick={() => compose()}>
              Share a team update or a new opportunity...
            </button>
          </div>
          <div className="feed-compose-actions">
            <button type="button" onClick={() => compose("media")}>
              <Icon name="image" />
              Photo / media
            </button>
            <button type="button" onClick={() => compose("video")}>
              <Icon name="monitor" />
              Video
            </button>
            <button type="button" onClick={() => router.push("/recruiter/jobs/new")}>
              <Icon name="briefcase" />
              Post a job
            </button>
          </div>
        </section>
        <FeedToolbar
          tabs={TABS}
          onFilter={(filter) => {
            setFeed({ filter, visible: 12 });
            router.replace(pathname, { scroll: false });
          }}
        />
        {feed.query && (
          <div className="feed-search-status">
            Results for “{feed.query}”{" "}
            <Button variant="text sm" icon="close" onClick={() => setFeed({ query: "" })}>
              Clear
            </Button>
          </div>
        )}
        {data && (
          <>
            <div className="feed-results-label">
              <span>{data.total} posts</span>
              <span>{devCopy("Your demo community", "Your community")}</span>
            </div>
            <div className="feed-post-list">
              {highlight && !data.items.some((entry)=>entry.id===highlight) && <PermalinkEntry key={highlight} id={highlight} role="recruiter" />}
              {data.items.length ? (
                data.items.map((entry, i) => <FeedCard key={entry.id} entry={entry} role="recruiter" activity={entry.viewer.own} position={i} highlighted={entry.id === highlight} />)
              ) : (
                <div className="card">
                  <EmptyState
                    title="Nothing here yet."
                    description="Try another filter or follow people to build your feed."
                    action={
                      <Button variant="primary" icon="users" onClick={() => network.open("recruiter")}>
                        Manage following
                      </Button>
                    }
                  />
                </div>
              )}
              {data.total > data.items.length && (
                <Button icon="down" onClick={() => setFeed({ visible: feed.visible + 12 })}>
                  See more posts
                </Button>
              )}
            </div>
          </>
        )}
      </section>
      <HiringRail />
    </div>
  );
}
