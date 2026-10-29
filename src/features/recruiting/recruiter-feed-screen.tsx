"use client";

import { Skeleton } from "@/components/ui/skeleton";

import { QueryFeedback } from "@/components/ui/query-view";

import Link from "next/link";
import { apiConfig } from "@/services/api/config";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { FeedFilter } from "@/services/feed/feed.service";
import { timeAgo } from "@/lib/utils/date";
import { useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { MediaImage } from "@/components/ui/media-image";
import { Avatar, Button, EmptyState, LinkButton } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { FeedCard } from "@/features/feed/feed-card";
import { FeedToolbar } from "@/features/feed/feed-parts";
import { useNetworkSheet } from "@/features/feed/network-sheet";
import { useFeedParams } from "@/features/feed/use-feed-params";
import { openReview } from "./review-dialog";
import { PermalinkEntry } from "@/features/feed/permalink-entry";

const TABS: [FeedFilter, string, boolean][] = [
  ["all", "For you", false],
  ["following", "Following", false],
  ["jobs", "Your jobs", false],
  ["saved", "Saved", false],
  ["reposts", "Reposts", false],
];

function ProfileRail() {
  const { data: shell, isError: shellError, refetch: retryShell } = useServiceQuery(["shell", "recruiter"], (s) => s.workspace.getRecruiterShell());
  const { data: orgCtx, isError: orgError, refetch: retryOrg } = useServiceQuery(["organization"], (s) => s.organization.getContext());
  const { data: hiring, isError: hiringError } = useServiceQuery(["hiring-summary"], (s) => s.recruiting.getHiringSummary());
  const saved = useServiceQuery(["feed-saved-count", "recruiter"], s => s.feed.getFeed({ role: "recruiter", filter: "saved", sort: "recent", q: "", limit: 1 }), { enabled: apiConfig.dataSource === "http" });
  if (!shell) return <aside className="feed-profile-column" aria-label="Organization profile and hiring"><QueryFeedback data={shell} error={shellError} retry={retryShell} label="Loading organization profile" /></aside>;
  const o = orgCtx?.workspace.organization;
  const orgName = o?.name || shell.companyName || "Your organization";
  const industry = o?.industry?.trim();
  const location = [o?.headquartersCity, o?.headquartersCountry].filter(Boolean).join(", ");
  return (
    <aside className="feed-profile-column" tabIndex={0} aria-label="Organization profile and hiring">
      <section className="card feed-profile">
        <div className="feed-welcome">
          <h1>Welcome back, {shell.identity.name.split(" ")[0]}.</h1>
        </div>
        {orgError && !o ? (
          <p className="feed-org-load-error" role="alert">
            Organization details could not be loaded. <button type="button" onClick={() => void retryOrg()}>Try again</button>
          </p>
        ) : (
          <>
            <Link href="/recruiter/company" className={"feed-profile-cover" + (o?.coverImageUrl ? " has-image" : "")} aria-label={"View " + orgName + " organization profile"}>
              {o?.coverImageUrl ? <MediaImage src={o.coverImageUrl} alt="" /> : (
                <>
                  <span>YOUR HIRING STORY.</span>
                  <i />
                  <i />
                  <i />
                </>
              )}
            </Link>
            <div className="feed-profile-details">
              <Link href="/recruiter/company" className="feed-avatar-link" aria-label={"View " + orgName + " organization profile"}>
                <span className="feed-org-logo">
                  {o?.logoUrl ? <MediaImage src={o.logoUrl} alt="" /> : <Icon name="building" />}
                </span>
                <span className="avatar-edit">
                  <Icon name="edit" />
                </span>
              </Link>
              <h2>
                <Link href="/recruiter/company">{orgName}</Link>
              </h2>
              <p className="feed-profile-headline" title={industry || undefined}>{industry || "Add industry"}</p>
              <p className="feed-location" title={location || undefined}>
                <Icon name="location" />
                <span>{location || "Add headquarters"}</span>
              </p>
            </div>
          </>
        )}
      </section>
      <section className="card recruiter-summary">
        <h2>Your hiring, in focus</h2>
        <Link href="/recruiter/jobs">
          <span>Open job posts</span>
          <strong>{hiring?.openJobs ?? (hiringError ? "—" : <Skeleton style={{ width: 28 }} />)}</strong>
        </Link>
        <Link href="/recruiter/applications?view=responses">
          <span>Received applications</span>
          <strong>{hiring?.received ?? (hiringError ? "—" : <Skeleton style={{ width: 28 }} />)}</strong>
        </Link>
        <Link href="/recruiter/applications?stage=New">
          <span>New to review</span>
          <strong>{hiring?.newCount ?? (hiringError ? "—" : <Skeleton style={{ width: 28 }} />)}</strong>
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
          <strong>{hiring?.shortlistCount ?? (hiringError ? "—" : <Skeleton style={{ width: 28 }} />)}</strong>
        </Link>
        <Link href="/recruiter/dashboard?view=saved">
          <span>
            <Icon name="bookmark" />
            Saved posts
          </span>
          <strong>{(apiConfig.dataSource === "http" ? saved.data?.total : shell.savedCount) ?? (saved.isError ? "—" : <Skeleton style={{ width: 28 }} />)}</strong>
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

/** The rail is a glance, not a list: longer lists continue on their own pages. */
const RAIL_LIMIT = 3;

function HiringRail() {
  const router = useRouter();
  const { data, isError, refetch } = useServiceQuery(["hiring-summary"], (s) => s.recruiting.getHiringSummary());
  return (
    <aside className="recruiter-hiring-rail" aria-label="Your hiring overview">
      <section className="card recruiter-rail-card">
        <span className="eyebrow">YOUR NEXT TEAMMATE</span>
        <h2>Applications to review</h2>
        <p>Keep your next connection in sight.</p>
        {!data ? <QueryFeedback data={data} error={isError} retry={refetch} label="Loading applications" /> : data.newApplications.length ? (
          data.newApplications.slice(0, RAIL_LIMIT).map((a) => (
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
          <span className="tag">{data?.openJobs ?? "…"} open</span>
        </div>
        <QueryFeedback data={data} error={isError} retry={refetch} label="Loading job posts" />
        {data?.jobs.length === 0 && <p>Your job posts will appear here.</p>}
        {data?.jobs.slice(0, RAIL_LIMIT).map((j) => (
          <div className="recruiter-rail-job" key={j.id}>
            <strong>{j.title}</strong>
            <p>
              {j.location} · {j.arrangement}
            </p>
            <Link href={"/recruiter/applications?job=" + j.id}>
              {j.applications} {j.applications === 1 ? "application" : "applications"} <Icon name="arrowUp" />
            </Link>
          </div>
        ))}
        {(data?.jobs.length ?? 0) > RAIL_LIMIT && (
          <LinkButton href="/recruiter/jobs" variant="text sm" icon="arrow">
            View all job posts
          </LinkButton>
        )}
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
  const network = useNetworkSheet();
  useFeedParams("recruiter");
  const { data, isError, refetch } = useServiceQuery(["feed", "recruiter", feed.filter, feed.sort, feed.visible], (s) => s.feed.getFeed({ role: "recruiter", filter: feed.filter, sort: feed.sort, q: "", limit: feed.visible }));
  useEffect(() => {
    if (highlight && data) requestAnimationFrame(() => document.getElementById("feed-" + highlight)?.scrollIntoView({ block: "start" }));
  }, [highlight, data]);
  return (
    <div className="professional-feed-layout recruiter-feed-layout">
      <ProfileRail />
      <section className="feed-timeline" aria-label="Recruiter community feed">
        <FeedToolbar
          tabs={TABS}
          onFilter={(filter) => {
            setFeed({ filter, visible: 12 });
            router.replace(filter === "reposts" ? pathname + "?view=reposts" : pathname, { scroll: false });
          }}
        />
        <QueryFeedback data={data} error={isError} retry={refetch} layout="feed" />
        {data && (
          <>
            <div className="feed-post-list">
              {highlight && !data.items.some((entry)=>entry.id===highlight) && <PermalinkEntry key={highlight} id={highlight} role="recruiter" />}
              {data.items.length ? (
                data.items.map((entry, i) => <FeedCard key={entry.id} entry={entry} role="recruiter" activity={entry.viewer.own} position={i} highlighted={entry.id === highlight} />)
              ) : (
                <div className="card">
                  <EmptyState
                    title={feed.filter === "reposts" ? "Your reposts will appear here." : "Nothing here yet."}
                    description={feed.filter === "reposts" ? "Repost your posts or other people’s public posts to share them in your feed." : "Try another filter or follow people to build your feed."}
                    action={
                      feed.filter === "reposts" ? <Button variant="primary" icon="home" onClick={() => { setFeed({ filter: "all", query: "", visible: 12 }); router.replace(pathname, { scroll: false }); }}>Explore feed</Button> : <Button variant="primary" icon="users" onClick={() => network.open("recruiter")}>
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
