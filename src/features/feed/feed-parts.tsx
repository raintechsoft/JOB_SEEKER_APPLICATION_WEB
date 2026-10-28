"use client";

import { QueryFeedback } from "@/components/ui/query-view";
import { Skeleton } from "@/components/ui/skeleton";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PersonSummary } from "@/types/api";
import type { Role } from "@/types/domain";
import type { FeedFilter } from "@/services/feed/feed.service";
import { apiConfig } from "@/services/api/config";
import { useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, LinkButton } from "@/components/ui/primitives";
import { MediaImage } from "@/components/ui/media-image";
import { SuggestionCardGrid } from "@/components/suggestions/suggestion-card";
import { TalentCard } from "@/components/talent/talent-card";
import { DevOnly } from "@/components/ui/dev-only";
import { FloatingSelect } from "@/components/ui/field";
import { ActivityHeatmap } from "./activity-heatmap";
import { workspaceDialogs } from "@/features/workspace/dialogs";
import { useNetworkSheet } from "./network-sheet";

/** Work Pulse is temporarily hidden from the home feed; set true to restore the monthly activity card. */
export const SHOW_WORK_PULSE = false;

/** Left column of the professional feed: identity, profile strength, Work Pulse and shortcuts. */
export function ProfileColumn() {
  const [showProfile, setShowProfile] = useState(false);
  const network = useNetworkSheet();
  const { data, isError, refetch } = useServiceQuery(["feed", "summary"], (s) => s.workspace.getProfessionalSummary());
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
        <div className={"feed-profile-cover" + (p.cover ? " has-image" : "")}>
          {p.cover ? (
            <MediaImage src={p.cover} alt="" fallback={null} />
          ) : (
            <>
              <span>MADE OF WHAT YOU DO.</span>
              <i />
              <i />
              <i />
            </>
          )}
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
        {showProfile ? "Hide profile insights" : SHOW_WORK_PULSE ? "Your profile insights & Work Pulse" : "Your profile insights"}
        <Icon name={showProfile ? "up" : "down"} />
      </button>
      {p.complete < 100 && (
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
      )}
      {SHOW_WORK_PULSE && (
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
          <ActivityHeatmap role="professional" />
          <small>Recorded activity, never a productivity score.</small>
        </section>
      )}
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
      {/* The shared people card: cover, name, designation, Follow and a corner menu. Suggestions are never already followed. */}
      <SuggestionCardGrid>
        {people.map((p) => (
          <TalentCard key={p.id} role="professional" person={{ id: p.id, slug: p.slug ?? "", name: p.name, headline: p.headline ?? "", picture: p.picture, cover: p.cover, color: p.color ?? "", location: "", years: 0, available: false, saved: false, following: false }} />
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
            { value: "recommended", label: "For you" },
            { value: "recent", label: "Recent" },
            { value: "popular", label: "Most liked" },
          ]}
        />
      </label>
    </div>
  );
}
