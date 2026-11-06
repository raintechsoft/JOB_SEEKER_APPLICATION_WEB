"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/utils/date";
import type { Role, SharedEntryCard as SharedEntry } from "@/types/domain";

/** The viewer's own workspace opens the entry highlighted in its feed. */
export function sharedEntryHref(role: Role, id: string) {
  return `${role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard"}?post=${encodeURIComponent(id)}`;
}

export function sharedEntryKind(type: SharedEntry["type"]) {
  return type === "job" ? "Job" : type === "update" ? "Work update" : "Post";
}

const ASPECTS: Record<string, string> = { "1:1": "1 / 1", "4:5": "4 / 5", "3:4": "3 / 4", "1.91:1": "1.91 / 1" };

/** CSS aspect for the media frame: the post's fixed ratio, else the media's own ratio. */
export function sharedEntryMediaAspect(mediaAspect: string | null) {
  return (mediaAspect && ASPECTS[mediaAspect]) || "auto";
}

/**
 * A shared entry inside a message, laid out like the feed card itself: author header (avatar,
 * name, headline, posted date), title and body, then the first image or video. No actions, no
 * follow button; the whole card opens the entry in the viewer's workspace. The server resolves the
 * card for the viewer on every read, so a deleted or hidden entry shows a neutral placeholder.
 */
export function SharedEntryCard({ entry, role }: { entry: SharedEntry; role: Role }) {
  if (!entry.available) {
    return (
      <div className="shared-entry-card is-unavailable" role="note">
        <span className="shared-entry-thumb" aria-hidden>
          <Icon name="ban" />
        </span>
        <span className="shared-entry-text">
          <strong>Post unavailable</strong>
          <span className="shared-entry-excerpt">It was removed or is no longer visible to you.</span>
        </span>
      </div>
    );
  }
  const kind = sharedEntryKind(entry.type);
  const media = entry.media;
  return (
    <Link href={sharedEntryHref(role, entry.id)} className="shared-feed-post-link" aria-label={`Open ${kind.toLowerCase()}${entry.title ? `: ${entry.title}` : entry.authorName ? ` by ${entry.authorName}` : ""}`}>
      <article className="card feed-post shared-feed-post" data-kind={entry.type ?? "post"}>
        <header className="feed-post-header">
          <div className="row">
            <Avatar person={{ id: entry.id, name: entry.authorName || kind, picture: entry.authorPicture || undefined }} />
            <div className="grow">
              <h2>
                <span className="feed-org-name">{entry.authorName || kind}</span>
              </h2>
              {entry.authorHeadline ? (
                <p className="feed-post-byline" title={entry.authorHeadline}>
                  {entry.authorHeadline}
                </p>
              ) : null}
              {entry.publishedAt ? (
                <p className="feed-post-meta">
                  <time dateTime={entry.publishedAt} title={entry.publishedAt}>
                    {timeAgo(entry.publishedAt)}
                  </time>
                </p>
              ) : null}
            </div>
          </div>
        </header>
        {entry.title || entry.body ? (
          <div className="feed-post-body">
            {entry.title ? <h3>{entry.title}</h3> : null}
            {entry.body ? <p className="shared-feed-post-text">{entry.body}</p> : null}
          </div>
        ) : null}
        {media ? (
          <div className="shared-feed-post-media" style={{ aspectRatio: sharedEntryMediaAspect(entry.mediaAspect) }} data-media={media.type}>
            {/* Remote media: next/image cannot optimise arbitrary hosts. Downloads are same-origin-protected,
                so they load in CORS mode with the session, like feed media. */}
            {media.type === "video" ? (
              <video src={media.src} muted playsInline preload="metadata" crossOrigin="use-credentials" aria-label={media.alt || "Video"} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.src} alt={media.alt} crossOrigin="use-credentials" />
            )}
            {media.type === "video" ? (
              <span className="shared-feed-post-play" aria-hidden>
                <Icon name="arrow" />
              </span>
            ) : null}
          </div>
        ) : null}
        <footer className="shared-feed-post-footer">
          <span className="shared-entry-cta">
            View {kind.toLowerCase()}
            <Icon name="arrow" />
          </span>
        </footer>
      </article>
    </Link>
  );
}
