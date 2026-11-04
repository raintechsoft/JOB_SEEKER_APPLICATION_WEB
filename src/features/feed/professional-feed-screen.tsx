"use client";

import { QueryFeedback } from "@/components/ui/query-view";
import { ScreenError } from "@/components/ui/feedback";

import { Fragment, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FeedFilter } from "@/services/feed/feed.service";
import { useLiveFeed } from "@/hooks/use-live-feed";
import { useUiStore } from "@/stores/ui-store";
import { Button, EmptyState } from "@/components/ui/primitives";
import { FeedCard } from "./feed-card";
import { FeedInfiniteLoader, FeedToolbar, NetworkPrompt, NewPostsButton, ProfileColumn } from "./feed-parts";
import { JobsPanel } from "./jobs-panel";
import { useNetworkSheet } from "./network-sheet";
import { useFeedParams } from "./use-feed-params";
import { PermalinkEntry } from "./permalink-entry";

const TABS: [FeedFilter, string, boolean][] = [
  ["all", "Home", true],
  ["following", "Following", true],
  ["jobs", "Jobs", true],
  ["saved", "Saved", true],
  ["reposts", "Reposts", true],
];

export function ProfessionalFeedScreen() {
  const feed = useUiStore((s) => s.feed);
  const setFeed = useUiStore((s) => s.setFeed);
  const router = useRouter();
  const pathname = usePathname();
  const highlight = useSearchParams().get("post");
  const network = useNetworkSheet();
  useFeedParams("professional");
  const { data, isError, error, refetch, newPosts, showNewPosts, placeholderHeight, hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError } = useLiveFeed({ role: "professional", filter: feed.filter, sort: feed.sort, q: "", limit: 12 });

  const scrolled = useRef<string | null>(null);
  useEffect(() => {
    if (!highlight || !data || scrolled.current === highlight) return;
    scrolled.current = highlight;
    requestAnimationFrame(() => document.getElementById("feed-" + highlight)?.scrollIntoView({ block: "start" }));
  }, [highlight, data]);

  const setFilter = (filter: FeedFilter) => {
    setFeed({ filter, visible: 12 });
    // Only the feed's own parameters change; others (such as the activity month) are kept.
    const next = new URLSearchParams(window.location.search);
    for (const key of ["view", "post", "comment", "q"]) next.delete(key);
    if (filter === "reposts") next.set("view", "reposts");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="professional-feed-layout">
      <ProfileColumn />
      <section className="feed-timeline" aria-label="Professional community feed">
        <FeedToolbar tabs={TABS} onFilter={setFilter} />
        <NewPostsButton show={newPosts} onShow={showNewPosts} />
        <div id="feed-post-list" className="feed-post-list" data-live-feed aria-busy={isFetchingNextPage || undefined} style={{ minHeight: placeholderHeight }}>
          {isError && data && <p role="status" className="state-inline-note">Couldn’t refresh the feed. Showing the last loaded posts. <button type="button" className="link" onClick={() => void refetch()}>Try again</button></p>}
          {highlight && data && !data.items.some((entry)=>entry.id===highlight) && <PermalinkEntry key={highlight} id={highlight} role="professional" />}
          {isError && !data ? <ScreenError error={error} title="The feed couldn’t load" description="Check your connection and try again." onRetry={() => void refetch()} /> : <QueryFeedback data={data} error={isError} cause={error} retry={refetch} layout="feed" />}
          {data && (
            <>
              {data.items.length ? (
                data.items.map((entry, i) => (
                  <Fragment key={entry.id}>
                    <FeedCard entry={entry} role="professional" position={i} highlighted={entry.id === highlight} />
                    {i === 2 && feed.filter === "all" && !feed.query && <NetworkPrompt people={data.suggestions} role="professional" />}
                  </Fragment>
                ))
              ) : (
                <EmptyState
                  title={feed.filter === "reposts" ? "Your reposts will appear here." : feed.filter === "saved" ? "Keep the good ones close." : feed.filter === "following" ? "Your feed starts with your people." : "A little space for new possibilities."}
                  description={feed.filter === "reposts" ? "Repost your posts or other people’s public posts to share them in your feed." : feed.filter === "saved" ? "Save any post or job to find it here." : "Follow professionals and companies, or try a different search."}
                  action={
                    feed.filter === "reposts" ? <Button variant="primary" icon="home" onClick={() => { setFeed({ filter: "all", query: "", visible: 12 }); router.replace(pathname, { scroll: false }); }}>Explore feed</Button> : <Button variant="primary" icon="users" onClick={() => network.open("professional")}>
                      Find people to follow
                    </Button>
                  }
                />
              )}
              {hasNextPage ? (
                <FeedInfiniteLoader loading={isFetchingNextPage} error={isFetchNextPageError} onLoad={() => void fetchNextPage()} />
              ) : data.items.length ? (
                <div className="feed-end">You’re all caught up for now. A little more work, a little more possibility.</div>
              ) : null}
            </>
          )}
        </div>
      </section>
      <JobsPanel />
    </div>
  );
}
