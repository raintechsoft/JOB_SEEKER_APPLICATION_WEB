"use client";

import { QueryFeedback } from "@/components/ui/query-view";
import { Skeleton } from "@/components/ui/skeleton";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PersonSummary } from "@/types/api";
import type { Role } from "@/types/domain";
import type { FeedFilter } from "@/services/feed/feed.service";
import { track } from "@/lib/analytics";
import { formatFollowers } from "@/lib/utils/text";
import { apiConfig } from "@/services/api/config";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { toast } from "@/stores/toast-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, LinkButton } from "@/components/ui/primitives";
import { SuggestionCard, SuggestionCardGrid } from "@/components/suggestions/suggestion-card";
import { DevOnly } from "@/components/ui/dev-only";
import { FloatingSelect } from "@/components/ui/field";
import { Heatmap } from "@/components/work/pulse";
import { workspaceDialogs } from "@/features/workspace/dialogs";
import { useNetworkSheet } from "./network-sheet";

/** Left column of the professional feed: identity, profile strength, Work Pulse and shortcuts. */
export function ProfileColumn() {
  const [showProfile, setShowProfile] = useState(false);
  const network = useNetworkSheet();
  const { data, isError, refetch } = useServiceQuery(["feed", "summary"], (s) => s.workspace.getProfessionalSummary());
  const { data: pulse, isError: pulseError, refetch: retryPulse } = useServiceQuery(["pulse", "feed", 91], (s) => s.work.getPulse(apiConfig.dataSource === "http" ? "me" : "p0", 91));
  const networkQuery = useServiceQuery(["feed-network", "professional"], s => s.feed.getNetwork("professional"), { enabled: apiConfig.dataSource === "http" });
  const savedQuery = useServiceQuery(["feed-saved-count", "professional"], s => s.feed.getFeed({ role: "professional", filter: "saved", sort: "recent", q: "", limit: 1 }), { enabled: apiConfig.dataSource === "http" });
  if (!data) return <aside className="feed-profile-column" aria-label="Your profile and activity"><QueryFeedback data={data} error={isError} retry={refetch} label="Loading profile" /></aside>;
  const followingCount = apiConfig.dataSource === "http" ? networkQuery.data ? networkQuery.data.following.length + networkQuery.data.companies.length : undefined : data.followingCount;
  const savedCount = apiConfig.dataSource === "http" ? savedQuery.data?.total : data.savedCount;
  const p = data.person;
  return (
    <aside className={"feed-profile-column" + (showProfile ? " show-profile" : "")} aria-label="Your profile and activity" tabIndex={0}>
      <section className="card feed-profile">
        <div className="feed-welcome">
          <h1>Welcome back, {p.name.split(" ")[0]}.</h1>
        </div>
        <div className="feed-profile-cover">
          <span>MADE OF WHAT YOU DO.</span>
          <i />
          <i />
          <i />
        </div>
        <div className="feed-profile-details">
          <Link href="/app/profile" className="feed-avatar-link">
            <Avatar person={p} size="xl" />
            <span className="avatar-edit">
              <Icon name="edit" />
            </span>
          </Link>
          <h2>
            <Link href="/app/profile">{p.name}</Link>
          </h2>
          <p className="feed-profile-headline" title={p.headline}>{p.headline}</p>
          <p className="feed-location" title={p.location}>
            <Icon name="location" />
            <span>{p.location}</span>
          </p>
        </div>
      </section>
      <button type="button" className="feed-mobile-profile-toggle" aria-expanded={showProfile} onClick={() => setShowProfile((v) => !v)}>
        {showProfile ? "Hide profile insights" : "Your profile insights & Work Pulse"}
        <Icon name={showProfile ? "up" : "down"} />
      </button>
      <section className="card feed-strength">
        <div className="row between">
          <h2>A stronger profile. More possibilities.</h2>
          <span>{p.complete}%</span>
        </div>
        <div className="progress" role="progressbar" aria-label="Profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.complete}>
          <i style={{ width: p.complete + "%" }} />
        </div>
        <LinkButton href="/app/profile" variant="primary sm fix-profile-button" icon="edit">
          Fix profile
        </LinkButton>
      </section>
      <section className="card feed-pulse">
        <div className="row between">
          <h2>
            <Icon name="pulse" />
            Work Pulse
          </h2>
          <Link href="/app/work-pulse">
            View all <Icon name="arrowUp" />
          </Link>
        </div>
        <p>Small steps, a bigger story.</p>
        <span className="feed-pulse-range">Last 3 months</span>
        <QueryFeedback data={pulse} error={pulseError} retry={retryPulse} layout="chart" label="Loading Work Pulse" />
        {pulse && <Heatmap pulse={pulse} ownerId={apiConfig.dataSource==="http"?"me":"p0"} />}
        <div className="feed-pulse-total">
          <strong>{pulse?.activeDays ?? data.pulseDays ?? (pulseError ? "—" : <Skeleton style={{ width: 30, height: 20 }} />)}</strong>
          <span>days of recorded progress</span>
        </div>
        <small>Recorded activity, never a productivity score.</small>
      </section>
      <section className="card feed-connections">
        <button type="button" onClick={() => network.open("professional")}>
          <span>
            <Icon name="users" />
            Your following
          </span>
          <strong>
            {followingCount ?? (networkQuery.isError ? "—" : <Skeleton style={{ width: 28 }} />)} <Icon name="chevron" />
          </strong>
        </button>
        <Link href="/app/portfolio">
          <span>
            <Icon name="layout" />
            Your portfolio
          </span>
          <Icon name="arrowUp" />
        </Link>
        <Link href="/app/dashboard?view=saved">
          <span>
            <Icon name="bookmark" />
            Saved posts & jobs
          </span>
          <strong>{savedCount ?? (savedQuery.isError ? "—" : <Skeleton style={{ width: 28 }} />)}</strong>
        </Link>
      </section>
      <DevOnly>
        <div className="feed-local-note">
          <Icon name="shield" />
          <p>
            Demo feed · Fictional people and jobs.
            <br />
            Your posts and interactions stay in this browser.
          </p>
        </div>
      </DevOnly>
      <nav className="feed-footer">
        <Link href="/how-it-works">About Skillora</Link>
        <DevOnly>
          <button type="button" onClick={workspaceDialogs.privacy}>
            Privacy & demo data
          </button>
        </DevOnly>
        <Link href="/app/settings">Settings</Link>
      </nav>
    </aside>
  );
}

export function useCompose(role: Role) {
  const router = useRouter();
  return (mode = "post") => router.push((role === "recruiter" ? "/recruiter" : "/app") + "/posts/new?mode=" + encodeURIComponent(mode));
}

export function NetworkPrompt({ people }: { people: PersonSummary[] }) {
  const run = useServiceAction();
  const network = useNetworkSheet();
  if (!people.length) return null;
  return (
    <section className="card feed-network-card">
      <div className="row between">
        <div>
          <h2>Good work is better with good people.</h2>
          <p>Add a fresh perspective to your feed.</p>
        </div>
        <Icon name="users" />
      </div>
      <SuggestionCardGrid>
        {people.map((p) => (
          <SuggestionCard
            key={p.id}
            href={"/app/professionals/" + encodeURIComponent(p.slug ?? "")}
            label={"View " + p.name + " profile"}
            name={p.name}
            headline={p.headline}
            person={p}
            meta={p.followerCount != null ? formatFollowers(p.followerCount) : undefined}
            onFollow={async () => {
              const following = await run((s) => s.feed.toggleFollow("professional", p.id));
              if (following === undefined) return;
              track("person_followed", { personId: p.id, following });
              toast("Following updated.");
            }}
          />
        ))}
      </SuggestionCardGrid>
      <button type="button" className="feed-network-all" onClick={() => network.open("professional")}>
        Explore people & companies <Icon name="arrow" />
      </button>
    </section>
  );
}

export function FeedToolbar({ tabs, onFilter }: { tabs: [FeedFilter, string, boolean][]; onFilter: (f: FeedFilter) => void }) {
  const { filter, sort } = useUiStore((s) => s.feed);
  const setFeed = useUiStore((s) => s.setFeed);
  return (
    <div className="feed-toolbar">
      <div role="tablist" aria-label="Feed filters">
        {tabs.map(([id, label, withIcon]) => (
          <button type="button" key={id} role="tab" aria-selected={filter === id} onClick={() => onFilter(id)} className={filter === id ? "active" : ""}>
            {withIcon && id === "jobs" && <Icon name="briefcase" />}
            {withIcon && id === "saved" && <Icon name="bookmark" />}
            {label}
          </button>
        ))}
      </div>
      <label className="feed-sort-label">
        <FloatingSelect
          label="Sort by"
          id="feed-sort"
          aria-label="Sort feed"
          value={sort}
          onChange={(e) => setFeed({ sort: e.target.value as "recent" | "popular" | "recommended" })}
          options={[
            { value: "recent", label: "Recent" },
            { value: "popular", label: "Most liked" },
            ...(apiConfig.dataSource==="http"?[{value:"recommended",label:"For you: follows & skills"}]:[]),
          ]}
        />
      </label>
    </div>
  );
}
