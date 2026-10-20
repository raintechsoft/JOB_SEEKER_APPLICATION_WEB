"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/types/domain";
import type { FeedEntry } from "@/services/feed/feed.service";
import { timeAgo } from "@/lib/utils/date";
import { firstName } from "@/lib/utils/text";
import { devCopy } from "@/lib/env/app-env";
import { track } from "@/lib/analytics";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { useDismissableDetails } from "@/hooks/use-dismissable";
import { useImpression } from "@/hooks/use-impression";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { FeedActionIcon, Icon } from "@/components/ui/icon";
import { Avatar, Badge, Button, LinkButton, Tags } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { FloatingInput, TextField } from "@/components/ui/field";
import { CompanyAvatar, JobArtwork, JobMediaExtras } from "@/components/jobs/job-visuals";
import { FeedArtwork } from "@/components/feed/feed-artwork";
import { useProjectDialogs, useUpdateDialogs } from "@/features/work/dialogs";
import { useJobActions } from "./job-dialogs";
import { usePostDialogs } from "./post-dialogs";

const JOB_HEADLINES: Record<string, [string, string]> = {
  northstar: ["Design", "what’s next."],
  meridian: ["Build a better", "everyday."],
};

function authorHref(role: Role, entry: FeedEntry) {
  const a = entry.author;
  if (!a) return undefined;
  if (a.id === "r0") return role === "recruiter" ? "/recruiter/company" : "/app/dashboard?post=" + entry.id;
  return role === "recruiter" ? "/recruiter/talent/" + a.id : "/professionals/" + a.slug;
}

function Comments({ entry, role }: { entry: FeedEntry; role: Role }) {
  const run = useServiceAction();
  const { data: identity } = useServiceQuery(["feed", "identity", role], async (s) => (role === "recruiter" ? (await s.workspace.getRecruiterShell()).identity : (await s.workspace.getProfessionalShell()).person));
  return (
    <section className="feed-comments" aria-label="Comments">
      <div className="feed-comment-list">
        {entry.comments.map((c) => (
          <div className="row" style={{ alignItems: "flex-start" }} key={c.id}>
            <Avatar person={c.author} />
            <div className="feed-comment-bubble">
              <strong>{c.author.name}</strong>
              <span>{timeAgo(c.createdAt) + devCopy(" · Demo comment", "")}</span>
              <p>{c.text}</p>
            </div>
          </div>
        ))}
      </div>
      <form
        className="feed-comment-form"
        data-post={entry.id}
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const text = String(new FormData(form).get("comment") || "").trim();
          if (!text) return;
          await run((s) => s.feed.addComment(role, entry.id, text));
          form.reset();
          track("post_commented", { postId: entry.id });
          toast(devCopy("Comment saved locally.", "Comment posted."));
        }}
      >
        {identity ? <Avatar person={identity} /> : <span className="avatar" />}
        <label className="sr-only" htmlFor={"comment-" + entry.id}>
          Write a comment
        </label>
        <FloatingInput label="Write a comment" compact id={"comment-" + entry.id} name="comment" required maxLength={1000} placeholder="Add a thoughtful comment..." />
        <button type="submit" className="iconbtn" aria-label="Post comment">
          <Icon name="send" />
        </button>
      </form>
      <DevOnly>
        <small>Comments are saved locally in this demo.</small>
      </DevOnly>
    </section>
  );
}

function ActivityMenu({ entry, role, children }: { entry: FeedEntry; role: Role; children?: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(ref, { closeOnAction: true });
  const router = useRouter();
  const posts = usePostDialogs();
  const updates = useUpdateDialogs();
  const job = entry.type === "job";
  const edit = () => {
    if (role === "recruiter") return job ? router.push("/recruiter/jobs/new?id=" + encodeURIComponent(entry.id)) : posts.edit(role, entry);
    return entry.type === "update" ? updates.edit(entry.id) : posts.edit(role, entry);
  };
  const remove = () => {
    if (role === "recruiter") return job ? router.push("/recruiter/applications") : posts.remove(role, entry.id);
    return entry.type === "update" ? updates.remove(entry.id) : posts.remove(role, entry.id);
  };
  return (
    <details className="activity-post-menu" ref={ref}>
      <summary aria-label={"Post actions for " + entry.title}>
        <Icon name="more" />
      </summary>
      <div className="activity-post-menu-items">
        {entry.visibility === "Private" && <p>Private · Only you</p>}
        <Button variant="text sm" icon="edit" onClick={edit}>
          Edit post
        </Button>
        <Button variant="text sm" icon="trash" onClick={remove}>
          {job ? "Manage job" : "Delete post"}
        </Button>
        {children}
      </div>
    </details>
  );
}

export interface FeedCardProps {
  entry: FeedEntry;
  role: Role;
  /** Show the owner's post menu (My Activity, recruiter feed). */
  activity?: boolean;
  /** Analytics surface for impressions. */
  surface?: string;
  position?: number;
  highlighted?: boolean;
  /** Live previews (post editor) do not report impressions. */
  noTracking?: boolean;
}

/** One feed item: post, work update or job (prototype `feedCard`). */
export function FeedCard({ entry, role, activity = false, surface = "feed", position = 0, highlighted = false, noTracking = false }: FeedCardProps) {
  const run = useServiceAction();
  const projects = useProjectDialogs();
  const jobs = useJobActions();
  const { openComments, expanded } = useUiStore((s) => s.feed);
  const toggleFeedList = useUiStore((s) => s.toggleFeedList);
  const [sharing, setSharing] = useState(false);
  const ref = useImpression<HTMLElement>(() => !noTracking && track("feed_item_impression", { itemId: entry.id, itemType: entry.type, surface, position }));
  const job = entry.type === "job";
  const p = job ? entry.company! : entry.author!;
  const href = authorHref(role, entry);
  const open = openComments.includes(entry.id);
  const isExpanded = expanded.includes(entry.id);
  const long = entry.body?.length > 420 && !isExpanded;
  const text = long ? entry.body.slice(0, 420) : entry.body;
  const likes = entry.likes + Number(entry.viewer.liked);
  const linked = entry.project?.visibility === "Public" ? entry.project : undefined;

  useEffect(() => {
    if (!sharing) return;
    const t = setTimeout(() => setSharing(false), 2000);
    return () => clearTimeout(t);
  }, [sharing]);

  const like = async () => {
    const liked = await run((s) => s.feed.toggleLike(role, entry.id));
    if (liked !== undefined) track("post_liked", { postId: entry.id, liked });
  };
  const save = () => jobs.toggleSave(role, entry.id, job ? "job" : "post");
  const follow = async () => {
    const following = await run((s) => (job ? s.feed.toggleFollowCompany(role, p.id) : s.feed.toggleFollow(role, p.id)));
    if (following === undefined) return;
    track(job ? "company_followed" : "person_followed", job ? { companyId: p.id, following } : { personId: p.id, following });
    toast("Following updated.");
  };
  const toggleComments = () => {
    toggleFeedList("openComments", entry.id);
    if (!open) requestAnimationFrame(() => document.getElementById("comment-" + entry.id)?.focus({ preventScroll: true }));
  };
  const share = async () => {
    setSharing(true);
    const url = window.location.origin + (role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard") + "?post=" + encodeURIComponent(entry.id);
    try {
      await navigator.clipboard.writeText(url);
      toast(devCopy("Post link copied. Local-only content stays in this browser.", "Post link copied."));
    } catch {
      modal.show(devCopy("Share this demo post", "Share this post"), <TextField label="Post link" name="link" defaultValue={url} readOnly onClick={(e) => e.currentTarget.select()} />);
    }
  };

  const contextLine = job ? "An opportunity to do meaningful work" : entry.viewer.own ? "Your professional story" : firstName(p.name) + " is part of your network";
  const headline = JOB_HEADLINES[entry.job?.art ?? ""] ?? ["Make room", "for bold ideas."];

  return (
    <article ref={ref} className={"card feed-post" + (job ? " feed-job-post" : "") + (highlighted ? " is-highlighted" : "")} id={"feed-" + entry.id} data-post-id={entry.id}>
      <div className="feed-post-context">
        <Icon name={job ? "briefcase" : entry.type === "update" ? "pulse" : "users"} />
        <span>{contextLine}</span>
        <button type="button" onClick={save} aria-label={(entry.viewer.saved ? "Unsave" : "Save") + " post"} aria-pressed={entry.viewer.saved} className={"feed-bookmark" + (entry.viewer.saved ? " is-saved" : "")}>
          <FeedActionIcon name="save" />
        </button>
      </div>
      <header className="feed-post-header">
        <div className="row">
          {job ? (
            <CompanyAvatar company={entry.company!} />
          ) : (
            <Link href={href!}>
              <Avatar person={p} />
            </Link>
          )}
          <div className="grow">
            <h2>
              {job ? p.name : <Link href={href!}>{p.name}</Link>}
              {job && <span className="feed-company-label">Company</span>}
            </h2>
            <p>{job ? entry.company?.industry || "Creative & technology" : entry.author?.headline}</p>
            <time dateTime={entry.createdAt} title={entry.createdAt}>
              {timeAgo(entry.createdAt)}
            </time>
          </div>
        </div>
        {entry.viewer.own ? (
          activity ? <ActivityMenu entry={entry} role={role} /> : null
        ) : (
          <button type="button" className={"feed-follow" + (entry.viewer.following ? " following" : "")} onClick={follow} aria-label={(entry.viewer.following ? "Unfollow " : "Follow ") + p.name}>
            <Icon name={entry.viewer.following ? "check" : "plus"} />
            {entry.viewer.following ? "Following" : "Follow"}
          </button>
        )}
      </header>
      <div className="feed-post-body">
        {!job && <h3>{entry.title}</h3>}
        <p>
          {text}
          {long && (
            <>
              …{" "}
              <button type="button" className="feed-read-more" onClick={() => toggleFeedList("expanded", entry.id)}>
                see more
              </button>
            </>
          )}
        </p>
        {entry.skills.length > 0 && (
          <div className="feed-post-tags">
            <Tags items={entry.skills} />
          </div>
        )}
      </div>
      {job ? (
        <>
          {entry.job!.thumbnail ? (
            <JobArtwork job={{ title: entry.title, companyName: p.name, location: entry.job!.location, arrangement: entry.job!.arrangement, thumbnail: entry.job!.thumbnail }} />
          ) : (
            <div className={"feed-job-visual " + entry.job!.art}>
              <div>
                <span>{p.name.toUpperCase()} · WE’RE HIRING</span>
                <h3>
                  {headline[0]}
                  <br />
                  {headline[1]}
                </h3>
                <p>Your next chapter could start here.</p>
              </div>
              <div className="job-art-shape" aria-hidden="true">
                <Icon name={entry.job!.art === "northstar" ? "spark" : entry.job!.art === "meridian" ? "layout" : "star"} />
              </div>
            </div>
          )}
          <JobMediaExtras job={{ title: entry.title, companyName: p.name, jobMedia: entry.job!.jobMedia }} />
          <div className="feed-job-summary">
            <div className="row between wrap">
              <div>
                <h3>{entry.title}</h3>
                <p>
                  <Icon name="location" />
                  {entry.job!.location}
                  <b>·</b>
                  {entry.job!.arrangement}
                </p>
              </div>
              <Badge tone="purple">{entry.job!.employment}</Badge>
            </div>
            <div className="row between wrap feed-job-bottom">
              <div>
                <strong>{entry.job!.salary}</strong>
                <span>{entry.job!.hideSalary ? "Compensation details" : devCopy("Illustrative salary range", "Salary range")}</span>
              </div>
              {role === "recruiter" && entry.job!.ownedByViewer ? (
                <LinkButton href={"/recruiter/applications?job=" + entry.id} variant="primary" icon="users">
                  View applications
                </LinkButton>
              ) : (
                <Button variant={entry.job!.applied ? "" : "primary"} icon="arrowUp" onClick={() => jobs.view(entry.id, surface)}>
                  {role === "recruiter" ? "View job post" : entry.job!.applied ? "Application saved" : "View opportunity"}
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <FeedArtwork entry={entry} onViewProject={(id) => projects.view(id)} />
      )}
      {linked && !job && (
        <button type="button" className="feed-linked-project" onClick={() => projects.view(linked.id)}>
          <span>
            <Icon name="folder" />
            Explore the project behind this post
          </span>
          <strong>
            {linked.title} <Icon name="arrowUp" />
          </strong>
        </button>
      )}
      <div className="feed-social-counts">
        <button type="button" onClick={like} aria-label={(entry.viewer.liked ? "Unlike" : "Like") + " post"}>
          <span className="reaction-dot">
            <FeedActionIcon name="like" />
          </span>
          {likes}
          {entry.viewer.liked ? " · You liked this" : ""}
        </button>
        <button type="button" onClick={toggleComments}>
          {entry.comments.length} {entry.comments.length === 1 ? "comment" : "comments"}
        </button>
      </div>
      <div className="feed-post-actions">
        <button type="button" className={entry.viewer.liked ? "is-liked" : ""} onClick={like} aria-pressed={entry.viewer.liked}>
          <FeedActionIcon name="like" />
          Like
        </button>
        <button type="button" onClick={toggleComments} aria-expanded={open}>
          <FeedActionIcon name="comment" />
          Comment
        </button>
        <button type="button" className={sharing ? "is-sharing" : ""} onClick={share}>
          <FeedActionIcon name="share" />
          Share
        </button>
        <button type="button" className={entry.viewer.saved ? "is-saved" : ""} onClick={save} aria-pressed={entry.viewer.saved}>
          <FeedActionIcon name="save" />
          {entry.viewer.saved ? "Saved" : "Save"}
        </button>
      </div>
      {open && <Comments entry={entry} role={role} />}
    </article>
  );
}
