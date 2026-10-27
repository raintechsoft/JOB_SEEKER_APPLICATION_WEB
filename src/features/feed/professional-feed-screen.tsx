"use client";

import { QueryFeedback } from "@/components/ui/query-view";

import { Fragment, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FeedFilter } from "@/services/feed/feed.service";
import { useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { Button, EmptyState } from "@/components/ui/primitives";
import { FeedCard } from "./feed-card";
import { FeedToolbar, NetworkPrompt, ProfileColumn } from "./feed-parts";
import { JobsPanel } from "./jobs-panel";
import { useNetworkSheet } from "./network-sheet";
import { useFeedParams } from "./use-feed-params";
import { PermalinkEntry } from "./permalink-entry";

const TABS: [FeedFilter, string, boolean][] = [
  ["all", "For you", true],
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
  const { data, isError, refetch } = useServiceQuery(["feed", "professional", feed.filter, feed.sort, feed.visible], (s) => s.feed.getFeed({ role: "professional", filter: feed.filter, sort: feed.sort, q: "", limit: feed.visible }));

  useEffect(() => {
    if (!highlight || !data) return;
    requestAnimationFrame(() => document.getElementById("feed-" + highlight)?.scrollIntoView({ block: "start" }));
  }, [highlight, data]);

  const setFilter = (filter: FeedFilter) => {
    setFeed({ filter, visible: 12 });
    router.replace(filter === "reposts" ? pathname + "?view=reposts" : pathname, { scroll: false });
  };

  return (
    <div className="professional-feed-layout">
      <ProfileColumn />
      <section className="feed-timeline" aria-label="Professional community feed">
        <FeedToolbar tabs={TABS} onFilter={setFilter} />
        <div id="feed-post-list" className="feed-post-list">
          {isError && <p role="alert">The feed could not be loaded. <Button onClick={()=>void refetch()}>Try again</Button></p>}
          {highlight && data && !data.items.some((entry)=>entry.id===highlight) && <PermalinkEntry key={highlight} id={highlight} role="professional" />}
          <QueryFeedback data={data} error={isError} retry={refetch} layout="feed" />
          {data && (
            <>
              {data.items.length ? (
                data.items.map((entry, i) => (
                  <Fragment key={entry.id}>
                    <FeedCard entry={entry} role="professional" position={i} highlighted={entry.id === highlight} />
                    {i === 2 && feed.filter === "all" && !feed.query && <NetworkPrompt people={data.suggestions} />}
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
              {data.total > data.items.length ? (
                <div className="feed-load-more">
                  <Button icon="down" onClick={() => setFeed({ visible: feed.visible + 12 })}>
                    See more posts
                  </Button>
                </div>
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
