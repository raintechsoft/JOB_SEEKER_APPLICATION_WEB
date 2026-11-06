"use client";
import { useRetainedList } from "@/components/suggestions/use-retained-list";
import { useSocialQuery } from "@/hooks/use-social-query";

import { QueryFeedback } from "@/components/ui/query-view";
import { Skeleton } from "@/components/ui/skeleton";
import { ScreenError } from "@/components/ui/feedback";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PersonSummary } from "@/types/api";
import type { Role } from "@/types/domain";
import type { FeedFilter } from "@/services/feed/feed.service";
import { apiConfig } from "@/services/api/config";
import { useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { useDismissableDetails } from "@/hooks/use-dismissable";
import { Icon, type IconName } from "@/components/ui/icon";
import { Avatar, Button, LinkButton } from "@/components/ui/primitives";
import { MediaImage } from "@/components/ui/media-image";
import { SuggestionCardGrid } from "@/components/suggestions/suggestion-card";
import { TalentCard } from "@/components/talent/talent-card";
import { DevOnly } from "@/components/ui/dev-only";
import { FloatingSelect } from "@/components/ui/field";
import {useAuthAction} from "@/features/auth/use-auth-action";
import { ActivityHeatmap } from "./activity-heatmap";
import { workspaceDialogs } from "@/features/workspace/dialogs";
import { useNetworkSheet } from "./network-sheet";
import { portfolioUiEnabled } from "@/features/portfolio/portfolio-ui-policy";

import { workPulseUiEnabled } from "@/features/work/work-pulse-ui-policy";

/** Work Pulse card on the home feed; follows the temporary Work Pulse UI policy. */
export const SHOW_WORK_PULSE = workPulseUiEnabled();

/** Left column of the professional feed: identity, profile strength, Work Pulse and shortcuts. */
export function ProfileColumn() {
  const [showProfile, setShowProfile] = useState(false);
  const network = useNetworkSheet();
  const { data, isError, error, refetch } = useServiceQuery(["feed", "summary"], (s) => s.workspace.getProfessionalSummary());
  const networkQuery = useSocialQuery(["network", "professional"], (s, scope) => s.feed.getNetwork("professional", scope), { enabled: apiConfig.dataSource === "http" });
  const savedQuery = useSocialQuery(["feed-saved-count", "professional"], (s, scope) => s.feed.getFeed({ role: "professional", filter: "saved", sort: "recent", q: "", limit: 1 }, scope), { enabled: apiConfig.dataSource === "http" });
  if (!data) return <aside className="feed-profile-column" aria-label="Your profile and activity">{isError ? <ScreenError compact error={error} title="Your profile couldn’t load" description="Your profile summary is temporarily unavailable." onRetry={() => void refetch()} /> : <QueryFeedback data={data} error={isError} cause={error} retry={refetch} label="Loading profile" />}</aside>;
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
          {p.location?.trim() ? (
            <p className="feed-location" title={p.location}>
              <Icon name="location" />
              <span>{p.location}</span>
            </p>
          ) : null}
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
        {portfolioUiEnabled() ? (
          <Link href="/app/portfolio">
            <span>
              <Icon name="layout" />
              Your portfolio
            </span>
            <Icon name="arrowUp" />
          </Link>
        ) : null}
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

/** Floating chip that appears when live updates are waiting above the current feed head. */
export function NewPostsButton({ show, onShow }: { show: boolean; onShow: () => void | Promise<unknown> }) {
  if (!show) return null;
  return (
    <div className="feed-new-posts" role="status">
      <Button
        type="button"
        onClick={() => {
          const scrollToLatest = (behavior: ScrollBehavior = "auto") => {
            const header = document.querySelector<HTMLElement>(".professional-header");
            const list =
              document.getElementById("feed-post-list") ??
              document.querySelector<HTMLElement>(".feed-timeline [data-live-feed]") ??
              document.querySelector<HTMLElement>(".feed-timeline");
            const first = list?.querySelector<HTMLElement>("article, [id^='feed-']");
            const target = first ?? list;
            if (!target) {
              window.scrollTo({ top: 0, behavior });
              return;
            }
            const offset = (header?.offsetHeight ?? 0) + 16;
            const top = window.scrollY + target.getBoundingClientRect().top - offset;
            window.scrollTo({ top: Math.max(0, top), behavior });
          };
          // Scroll immediately; load the fresh head in parallel so the network wait is not felt as lag.
          scrollToLatest("auto");
          void Promise.resolve(onShow()).then(() => {
            requestAnimationFrame(() => scrollToLatest("auto"));
          });
        }}
      >
        New posts
        <Icon name="up" />
      </Button>
    </div>
  );
}

/** Loads the next feed page when the list footer enters the viewport. */
export function FeedInfiniteLoader({ loading, error, onLoad }: { loading: boolean; error?: boolean; onLoad: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const requested = useRef(false);
  const load = useRef(onLoad);
  load.current = onLoad;
  useEffect(() => {
    requested.current = false;
  }, [loading, error]);
  useEffect(() => {
    const el = ref.current;
    if (!el || loading || error) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || requested.current) return;
        requested.current = true;
        load.current();
      },
      { rootMargin: "480px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, error]);
  if (error) {
    return (
      <div className="feed-load-more">
        <Button icon="down" onClick={onLoad}>
          See more posts
        </Button>
      </div>
    );
  }
  return (
    <div className="feed-load-more" ref={ref} aria-busy={loading || undefined} style={{ minHeight: 8 }}>
      {loading ? "Loading more posts…" : <span className="sr-only">More posts will load as you continue.</span>}
    </div>
  );
}

export function useCompose(role: Role) {
  const router = useRouter();
  const gate=useAuthAction();
  return (mode = "post") => {void gate.run("create_post",()=>router.push((role === "recruiter" ? "/recruiter" : "/app") + "/posts/new?mode=" + encodeURIComponent(mode)),{workspace:role});};
}

export function NetworkPrompt({ people, role = "professional" }: { people: PersonSummary[]; role?: Role }) {
  // Followed suggestions drop out of the next feed page; keep them on screen until the feed is reloaded.
  const shown = useRetainedList(people, role);
  if (!shown.length) return null;
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
        {shown.map((p) => (
          <TalentCard key={p.id} role={role} person={{ id: p.id, slug: p.slug ?? "", name: p.name, headline: p.headline ?? "", picture: p.picture, cover: p.cover, color: p.color ?? "", location: "", years: 0, available: false, saved: false, following: false }} />
        ))}
      </SuggestionCardGrid>
      <Link href={role === "recruiter" ? "/recruiter/discover" : "/app/discover"} className="feed-network-all">
        Explore people & companies <Icon name="arrow" />
      </Link>
    </section>
  );
}

function feedFilterIcon(id: FeedFilter): IconName {
  if (id === "jobs") return "briefcase";
  if (id === "saved") return "bookmark";
  if (id === "following") return "users";
  if (id === "reposts") return "repost";
  return "spark";
}

function FeedFilterMenu({ tabs, filter, onFilter }: { tabs: [FeedFilter, string, boolean][]; filter: FeedFilter; onFilter: (f: FeedFilter) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(ref, { closeOnAction: true });
  return (
    <details className={"feed-filter-menu" + (filter !== "all" ? " has-filter" : "")} ref={ref}>
      <summary className="iconbtn" aria-label="Feed filters">
        <Icon name="more" />
      </summary>
      <div className="feed-filter-list" role="group" aria-label="Feed filters">
        {tabs.map(([id, label]) => (
          <Button key={id} variant="text sm" icon={feedFilterIcon(id)} aria-pressed={filter === id} className={filter === id ? "active" : undefined} onClick={() => onFilter(id)}>
            {label}
          </Button>
        ))}
      </div>
    </details>
  );
}

export function FeedToolbar({ tabs, onFilter }: { tabs: [FeedFilter, string, boolean][]; onFilter: (f: FeedFilter) => void }) {
  const { filter, sort } = useUiStore((s) => s.feed);
  const setFeed = useUiStore((s) => s.setFeed);
  return (
    <div className="feed-toolbar">
      <div className="feed-filter-tabs" role="tablist" aria-label="Feed filters">
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
            { value: "recommended", label: "For you" },
            { value: "popular", label: "Most liked" },
          ]}
        />
      </label>
      <FeedFilterMenu tabs={tabs} filter={filter} onFilter={onFilter} />
    </div>
  );
}
