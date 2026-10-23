"use client";

import { Fragment, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FeedFilter } from "@/services/feed/feed.service";
import { devCopy } from "@/lib/env/app-env";
import { useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { Button, EmptyState } from "@/components/ui/primitives";
import { FeedCard } from "./feed-card";
import { FeedToolbar, NetworkPrompt, ProfessionalComposer, ProfileColumn } from "./feed-parts";
import { JobsPanel } from "./jobs-panel";
import { useNetworkSheet } from "./network-sheet";
import { useFeedParams } from "./use-feed-params";
import { PermalinkEntry } from "./permalink-entry";

const TABS: [FeedFilter, string, boolean][] = [
  ["all", "For you", true],
  ["following", "Following", true],
  ["jobs", "Jobs", true],
  ["saved", "Saved", true],
];

export function ProfessionalFeedScreen() {
  const feed = useUiStore((s) => s.feed);
  const setFeed = useUiStore((s) => s.setFeed);
  const router = useRouter();
  const pathname = usePathname();
  const highlight = useSearchParams().get("post");
  const network = useNetworkSheet();
  useFeedParams("professional");
  const { data: shell } = useServiceQuery(["shell", "professional"], (s) => s.workspace.getProfessionalShell());
  const { data, isError, refetch } = useServiceQuery(["feed", "professional", feed.filter, feed.sort, feed.query, feed.visible], (s) => s.feed.getFeed({ role: "professional", filter: feed.filter, sort: feed.sort, q: feed.query, limit: feed.visible }));

  useEffect(() => {
    if (!highlight || !data) return;
    requestAnimationFrame(() => document.getElementById("feed-" + highlight)?.scrollIntoView({ block: "start" }));
  }, [highlight, data]);

  const setFilter = (filter: FeedFilter) => {
    setFeed({ filter, visible: 12 });
    router.replace(pathname, { scroll: false });
  };

  const label = feed.filter === "jobs" ? "opportunities" : feed.filter === "saved" ? "saved posts" : "posts";
  return (
    <div className="professional-feed-layout">
      <ProfileColumn />
      <section className="feed-timeline" aria-label="Professional community feed">
        <div className="feed-heading">
          <div>
            <span className="eyebrow">GOOD WORK. GOOD PEOPLE.</span>
            <h2>Your next chapter is out there.</h2>
            <p>A little inspiration. A meaningful connection. A new opportunity.</p>
          </div>
          <span className="feed-live-label">
            <i />
            Your feed
          </span>
        </div>
        <ProfessionalComposer identity={shell?.person} />
        <FeedToolbar tabs={TABS} onFilter={setFilter} />
        <div id="feed-search-status">
          {feed.query && (
            <div className="feed-search-status">
              Results for “{feed.query}”{" "}
              <Button variant="text sm" icon="close" onClick={() => setFeed({ query: "" })}>
                Clear search
              </Button>
            </div>
          )}
        </div>
        <div id="feed-post-list" className="feed-post-list">
          {isError && <p role="alert">The feed could not be loaded. <Button onClick={()=>void refetch()}>Try again</Button></p>}
          {highlight && data && !data.items.some((entry)=>entry.id===highlight) && <PermalinkEntry key={highlight} id={highlight} role="professional" />}
          {data && (
            <>
              <div className="feed-results-label">
                <span>
                  {data.total} {label} {feed.query ? "matching “" + feed.query + "”" : ""}
                </span>
                <span>{devCopy("From your demo community", "From your community")}</span>
              </div>
              {data.items.length ? (
                data.items.map((entry, i) => (
                  <Fragment key={entry.id}>
                    <FeedCard entry={entry} role="professional" position={i} highlighted={entry.id === highlight} />
                    {i === 2 && feed.filter === "all" && !feed.query && <NetworkPrompt people={data.suggestions} />}
                  </Fragment>
                ))
              ) : (
                <EmptyState
                  title={feed.filter === "saved" ? "Keep the good ones close." : feed.filter === "following" ? "Your feed starts with your people." : "A little space for new possibilities."}
                  description={feed.filter === "saved" ? "Save any post or job to find it here." : "Follow professionals and companies, or try a different search."}
                  action={
                    <Button variant="primary" icon="users" onClick={() => network.open("professional")}>
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
