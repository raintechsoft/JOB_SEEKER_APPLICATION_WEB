"use client";

import { QueryFeedback } from "@/components/ui/query-view";

import Link from "next/link";
import { Fragment } from "react";
import { useSearchParams } from "next/navigation";
import type { Role } from "@/types/domain";
import { ACTIVITY_SECTIONS, type ActivityData, type ActivitySection } from "@/services/activity/activity.service";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { Icon, type IconName } from "@/components/ui/icon";
import { Avatar, Button, EmptyState, LinkButton, PageHeading } from "@/components/ui/primitives";
import { FeedCard } from "@/features/feed/feed-card";
import { useCompose } from "@/features/feed/feed-parts";

const ICONS: Record<ActivitySection, IconName> = { posts: "edit", comments: "message", videos: "monitor", images: "image", reactions: "like" };

function useActivityParams() {
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: ActivitySection = raw && Object.hasOwn(ACTIVITY_SECTIONS, raw) ? (raw as ActivitySection) : "posts";
  const limit = Math.max(12, Math.min(1e4, Number(params.get("limit")) || 12));
  return { tab, limit };
}

function Sidebar({ role, tab, counts }: { role: Role; tab: ActivitySection; counts: Record<ActivitySection, number> }) {
  const base = role === "recruiter" ? "/recruiter/activity" : "/app/updates";
  return (
    <aside className="card application-sidebar activity-sidebar">
      <h2>All activity</h2>
      <nav aria-label="Activity sections">
        {(Object.keys(ACTIVITY_SECTIONS) as ActivitySection[]).map((k) => (
          <Link key={k} href={base + "?tab=" + k} className={tab === k ? "active" : ""} aria-current={tab === k ? "page" : undefined}>
            <span className="application-section-label">
              <Icon name={ICONS[k]} />
              {role === "recruiter" ? ACTIVITY_SECTIONS[k] : <span>{ACTIVITY_SECTIONS[k]}</span>}
            </span>
            {counts[k] > 0 && <span className="application-section-count">{counts[k]}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

const counts = (d: ActivityData): Record<ActivitySection, number> => ({ posts: d.posts.length, comments: d.commentCount, videos: d.videos.length, images: d.images.length, reactions: d.reactions.length });

const EMPTY: Record<ActivitySection, [string, string]> = {
  posts: ["Your story starts here.", "Your work updates, text posts, media, and project posts will appear here."],
  comments: ["Join the conversation.", "Comments you leave on posts will appear here with the original post."],
  videos: ["Your videos, in one place.", "Video posts you publish will appear here."],
  images: ["Let your work be seen.", "Your image posts will appear here."],
  reactions: ["The posts that caught your attention.", "Posts you like in the feed will appear here."],
};

export function ProfessionalActivityScreen() {
  const { tab, limit } = useActivityParams();
  const run = useServiceAction();
  const compose = useCompose("professional");
  const { data, isError, refetch } = useServiceQuery(["activity", "professional"], (s) => s.activity.getProfessionalActivity());
  const { data: shell } = useServiceQuery(["shell", "professional"], (s) => s.workspace.getProfessionalShell());
  const me = shell?.person;
  const items = data ? (tab === "comments" ? data.comments : data[tab]) : [];
  const total = data ? (tab === "comments" ? data.commentCount : data[tab].length) : 0;

  const emptyAction =
    tab === "videos" ? (
      <Button variant="primary" icon="plus" onClick={() => compose("video")}>
        Share a video
      </Button>
    ) : tab === "images" ? (
      <Button variant="primary" icon="image" onClick={() => compose("media")}>
        Share an image
      </Button>
    ) : tab === "posts" ? (
      <Button variant="primary" icon="plus" onClick={() => compose()}>
        Create a post
      </Button>
    ) : (
      <LinkButton href="/app/dashboard" variant="primary" icon="home">
        Explore the feed
      </LinkButton>
    );

  return (
    <div className="activity-workspace">
      <PageHeading
        title="My Activity"
        subtitle=""
        actions={
          <Button variant="primary" icon="plus" onClick={() => compose()}>
            Create a post
          </Button>
        }
      />
      <div className="application-layout activity-layout">
        <Sidebar role="professional" tab={tab} counts={data ? counts(data) : { posts: 0, comments: 0, videos: 0, images: 0, reactions: 0 }} />
        <div className="activity-content">
          <div className="activity-content-heading">
            <h2>{ACTIVITY_SECTIONS[tab]}</h2>
            <div className="activity-section-meta">
              <span>
                {total} {tab}
              </span>
              <span>{tab === "reactions" ? "Your likes" : "Newest first"}</span>
            </div>
          </div>
          <section className="activity-stream feed-post-list" aria-label={"Your " + ACTIVITY_SECTIONS[tab].toLowerCase()}>
            <QueryFeedback data={data} error={isError} retry={refetch} layout="feed" />
            {data &&
              (items.length ? (
                items.slice(0, limit).map((item) => {
                  if (tab === "comments") {
                    const group = item as ActivityData["comments"][number];
                    return (
                      <div className="activity-comment-record" key={group.post.id}>
                        <div className="activity-event-label">
                          {me && <Avatar person={me} />}
                          <span>
                            <strong>{me?.name}</strong> commented on this post
                          </span>
                        </div>
                        <FeedCard entry={group.post} role="professional" activity surface="activity" focusComments={group.comments.map((c) => c.id)} />
                      </div>
                    );
                  }
                  const entry = item as ActivityData["posts"][number];
                  if (tab === "reactions")
                    return (
                      <div className="activity-reaction-record" key={entry.id}>
                        <div className="activity-event-label">
                          <Icon name="like" />
                          <span>You liked this post</span>
                          <Button variant="text sm" onClick={() => run((s) => s.feed.toggleLike("professional", entry.id))}>
                            Remove reaction
                          </Button>
                        </div>
                        <FeedCard entry={entry} role="professional" activity surface="activity" />
                      </div>
                    );
                  return (
                    <div className="activity-post-record" key={entry.id}>
                      <FeedCard entry={entry} role="professional" activity surface="activity" />
                    </div>
                  );
                })
              ) : (
                <div className="card activity-empty">
                  <EmptyState title={EMPTY[tab][0]} description={EMPTY[tab][1]} action={emptyAction} />
                </div>
              ))}
          </section>
          {items.length > limit && (
            <div className="activity-load">
              <LinkButton href={`/app/updates?tab=${tab}&limit=${limit + 12}`} icon="down">
                Load more
              </LinkButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RecruiterActivityScreen() {
  const { tab, limit } = useActivityParams();
  const compose = useCompose("recruiter");
  const { data, isError, refetch } = useServiceQuery(["activity", "recruiter"], (s) => s.activity.getRecruiterActivity());
  const list = data ? (tab === "comments" ? data.comments.map((g) => g.post) : data[tab]) : [];
  const commentIds = (postId: string) => data?.comments.find((g) => g.post.id === postId)?.comments.map((c) => c.id) ?? [];
  return (
    <div className="activity-workspace">
      <PageHeading
        title="My Activity"
        subtitle=""
        actions={
          <Button variant="primary" icon="plus" onClick={() => compose()}>
            Create a post
          </Button>
        }
      />
      <div className="application-layout activity-layout">
        <Sidebar role="recruiter" tab={tab} counts={data ? counts(data) : { posts: 0, comments: 0, videos: 0, images: 0, reactions: 0 }} />
        <div className="activity-content">
          <div className="activity-content-heading">
            <h2>{ACTIVITY_SECTIONS[tab]}</h2>
            <div className="activity-section-meta">
              <span>
                {list.length} {ACTIVITY_SECTIONS[tab].toLowerCase()}
              </span>
              <span>Newest first</span>
            </div>
          </div>
          <section className="activity-stream feed-post-list">
            <QueryFeedback data={data} error={isError} retry={refetch} layout="feed" />
            {data &&
              (list.length ? (
                list.slice(0, limit).map((entry) => (
                  <Fragment key={entry.id}>
                    {tab === "reactions" && (
                      <div className="activity-event-label">
                        <Icon name="like" /> You liked this post
                      </div>
                    )}
                    <FeedCard entry={entry} role="recruiter" activity={entry.viewer.own} surface="activity" focusComments={tab === "comments" ? commentIds(entry.id) : undefined} />
                  </Fragment>
                ))
              ) : (
                <div className="card activity-empty">
                  <EmptyState
                    title="Your activity will appear here."
                    description={tab === "posts" ? "Share a team update or post a job." : "Your " + ACTIVITY_SECTIONS[tab].toLowerCase() + " will be collected here as you participate."}
                    action={
                      tab === "posts" ? (
                        <Button variant="primary" icon="plus" onClick={() => compose()}>
                          Create a post
                        </Button>
                      ) : (
                        <LinkButton href="/recruiter/dashboard" variant="primary" icon="home">
                          Explore the feed
                        </LinkButton>
                      )
                    }
                  />
                </div>
              ))}
          </section>
          {list.length > limit && <LinkButton href={`/recruiter/activity?tab=${tab}&limit=${limit + 12}`}>Load more</LinkButton>}
        </div>
      </div>
    </div>
  );
}
