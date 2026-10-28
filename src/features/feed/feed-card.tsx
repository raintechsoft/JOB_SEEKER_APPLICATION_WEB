"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Id, Role } from "@/types/domain";
import type { PersonSummary } from "@/types/api";
import type { FeedComment, FeedEntry } from "@/services/feed/feed.service";
import { timeAgo } from "@/lib/utils/date";
import { organizationProfileHref, recruiterProfileHref } from "@/lib/routing/profiles";
import { firstName, formatFollowers } from "@/lib/utils/text";
import { devCopy } from "@/lib/env/app-env";
import { track } from "@/lib/analytics";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { useDismissableDetails } from "@/hooks/use-dismissable";
import { useImpression } from "@/hooks/use-impression";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { FeedActionIcon, Icon } from "@/components/ui/icon";
import { Avatar, Badge, Button, IconButton, LinkButton, Tags } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { FloatingInput, FloatingTextArea } from "@/components/ui/field";
import { useShareSheet } from "./share-sheet";
import { CompanyAvatar, JobArtwork, JobMediaExtras } from "@/components/jobs/job-visuals";
import { FeedArtwork } from "@/components/feed/feed-artwork";
import { useProjectDialogs, useUpdateDialogs } from "@/features/work/dialogs";
import { useJobActions } from "./job-dialogs";
import { usePostDialogs } from "./post-dialogs";
import { commentSchema } from "@/lib/validation/social";
import { useFormAction } from "@/hooks/use-form-action";
import { apiConfig } from "@/services/api/config";
import { useFeedInteraction } from "./use-feed-interaction";
import { INITIAL_VISIBLE_REPLIES, nextReplyReveal } from "./reply-reveal";
import { CommentMenu } from "./comment-menu";
import { LinkifiedText, LinkPreviewCard } from "@/components/feed/link-preview-card";
import { linkSafeCut } from "@/lib/validation/link-preview";

const JOB_HEADLINES: Record<string, [string, string]> = {
  northstar: ["Design", "what’s next."],
  meridian: ["Build a better", "everyday."],
};

function authorHref(role: Role, entry: FeedEntry) {
  const a = entry.author;
  if (!a) return undefined;
  if (entry.viewer.own) return role === "recruiter" ? "/recruiter/profile" : "/app/profile";
  if (a.recruiter) return recruiterProfileHref(role, a.id);
  if (a.id === "r0") return role === "recruiter" ? "/recruiter/company" : "/app/dashboard?post=" + entry.id;
  return role === "recruiter" ? "/recruiter/talent/" + a.id : a.slug ? "/app/professionals/" + encodeURIComponent(a.slug) : undefined;
}

function personHref(role: Role, person: PersonSummary) {
  if (person.recruiter) return recruiterProfileHref(role, person.id);
  if (person.id === "r0") return recruiterProfileHref(role, person.id, role === "recruiter");
  return role === "recruiter" ? "/recruiter/talent/" + person.id : person.slug ? "/app/professionals/" + encodeURIComponent(person.slug) : undefined;
}

function CommentComposer({ entryId, role, identity, parentId, fieldId, placeholder, onPosted }: { entryId: Id; role: Role; identity?: PersonSummary; parentId?: Id; fieldId: string; placeholder: string; onPosted?: () => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction(setErrors);
  return (
    <>
      <form
        className="feed-comment-form"
        data-post={entryId}
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const text = String(new FormData(form).get("comment") || "").trim();
          const parsed = commentSchema.safeParse(text);
          if (!parsed.success) { setErrors({ comment: parsed.error.issues[0].message }); return; }
          if (!(await execute((s) => s.feed.addComment(role, entryId, parsed.data, parentId), { invalidate: ["feed", "feed-entry", "feed-comments", "activity"] }))) return;
          form.reset();
          setErrors({});
          track("post_commented", { postId: entryId });
          toast(parentId ? "Reply posted." : devCopy("Comment saved locally.", "Comment posted."));
          onPosted?.();
        }}
      >
        {identity ? <Avatar person={identity} /> : <span className="avatar" />}
        <label className="sr-only" htmlFor={fieldId}>
          {placeholder}
        </label>
        <FloatingInput label={placeholder} compact id={fieldId} name="comment" required maxLength={1000} placeholder={placeholder} aria-invalid={!!errors.comment} aria-describedby={errors.comment ? fieldId + "-error" : undefined} disabled={pending} />
        <IconButton type="submit" icon="send" label={parentId ? "Post reply" : "Post comment"} loading={pending} />
      </form>
      {errors.comment && <p className="error" role="alert" id={fieldId + "-error"}>{errors.comment}</p>}
      {errors._form && <p className="error" role="alert">{errors._form}</p>}
    </>
  );
}

function CommentEditor({ entry, comment, onCancel }: { entry: FeedEntry; comment: FeedComment; onCancel: () => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction(setErrors);
  return (
    <form
      className="feed-comment-edit"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = commentSchema.safeParse(String(new FormData(e.currentTarget).get("text") || "").trim());
        if (!parsed.success) { setErrors({ text: parsed.error.issues[0].message }); return; }
        if (!(await execute((s) => s.feed.editComment(entry.id, comment.id, parsed.data, comment.version), { invalidate: ["feed", "feed-entry", "feed-comments", "activity"] }))) return;
        toast("Changes saved.");
        onCancel();
      }}
    >
      <FloatingTextArea label="Edit comment" name="text" defaultValue={comment.text} required maxLength={1000} disabled={pending} autoFocus rows={3} />
      {errors.text && <p className="error" role="alert">{errors.text}</p>}
      {errors._form && <p className="error" role="alert">{errors._form}</p>}
      <div className="feed-comment-edit-actions">
        <Button type="button" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="submit" variant="primary" loading={pending} disabled={pending}>Save</Button>
      </div>
    </form>
  );
}

function CommentThread({ comment, replies, entry, role, identity, focusIds }: { comment: FeedComment; replies: FeedComment[]; entry: FeedEntry; role: Role; identity?: PersonSummary; focusIds: string[] }) {
  const [replying, setReplying] = useState(false);
  const editingId = useUiStore((s) => s.feed.editingComment);
  const setFeed = useUiStore((s) => s.setFeed);
  const editing = editingId === comment.id;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_REPLIES);
  const href = personHref(role, comment.author);
  const headline = comment.author.headline?.trim();
  const isAuthor = comment.author.id === entry.ownerId || comment.author.id === entry.author?.id;
  const threadId = comment.parentId ?? comment.id;
  const avatar = href ? <Link href={href}><Avatar person={comment.author} /></Link> : <Avatar person={comment.author} />;
  const focusIndex = Math.max(-1, ...replies.map((reply, i) => (focusIds.includes(reply.id) ? i : -1)));
  const shown = Math.min(Math.max(visibleCount, focusIndex + 1), replies.length);
  const hidden = replies.length - shown;
  const repliesId = "comment-replies-" + comment.id;
  const highlighted = focusIds.includes(comment.id);
  return (
    <article id={"comment-" + comment.id} className={"feed-comment" + (comment.parentId ? " is-reply" : "") + (highlighted ? " is-highlighted" : "")} aria-current={highlighted ? "true" : undefined}>
      {avatar}
      <div className="feed-comment-main">
        <div className="feed-comment-head">
          <div className="feed-comment-identity">
            <strong>
              {href ? <Link href={href}>{comment.author.name}</Link> : comment.author.name}
              {isAuthor && <span className="feed-comment-author-badge">Author</span>}
            </strong>
            {headline ? <p className="feed-comment-byline" title={headline}>{headline}</p> : null}
          </div>
          <div className="feed-comment-meta"><time dateTime={comment.createdAt}>{timeAgo(comment.createdAt) + devCopy(" · Demo comment", "")}</time><CommentMenu role={role} entry={entry} comment={comment} onEdit={comment.own ? () => { setFeed({ editingComment: comment.id }); setReplying(false); } : undefined} /></div>
        </div>
        {comment.pinned && <span className="feed-comment-pinned"><Icon name="pin" /> Pinned by author</span>}
        {editing ? <CommentEditor entry={entry} comment={comment} onCancel={() => setFeed({ editingComment: null })} /> : <p className="feed-comment-text">{comment.text}</p>}
        {!editing && (
        <div className="feed-comment-actions">
          <button type="button" onClick={() => setReplying((open) => !open)} aria-expanded={replying}>
            <Icon name="message" />
            Reply
          </button>
        </div>
        )}
        {replying && !editing && (
          <CommentComposer
            entryId={entry.id}
            role={role}
            identity={identity}
            parentId={threadId}
            fieldId={"reply-" + comment.id}
            placeholder={"Reply to " + comment.author.name}
            onPosted={() => {
              setReplying(false);
              setVisibleCount((count) => Math.max(count, replies.length + 1));
            }}
          />
        )}
        {replies.length > 0 && (
          <>
            <div className="feed-comment-replies" id={repliesId}>
              {replies.slice(0, shown).map((reply) => (
                <CommentThread key={reply.id} comment={reply} replies={[]} entry={entry} role={role} identity={identity} focusIds={focusIds} />
              ))}
            </div>
            {hidden > 0 && (
              <button
                type="button"
                className="feed-comment-more"
                aria-expanded="false"
                aria-controls={repliesId}
                onClick={() => setVisibleCount((count) => count + nextReplyReveal(hidden))}
              >
                <Icon name="down" />
                {hidden === 1 ? "View 1 more reply" : "View " + hidden + " more replies"}
              </button>
            )}
            {hidden === 0 && replies.length > 6 && (
              <button type="button" className="feed-comment-more" aria-expanded="true" aria-controls={repliesId} onClick={() => setVisibleCount(INITIAL_VISIBLE_REPLIES)}>
                <Icon name="up" />
                Show less
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export function Comments({ entry, role, focusIds = [] }: { entry: FeedEntry; role: Role; focusIds?: string[] }) {
  const permalink = useSearchParams()?.get("comment") ?? undefined;
  const ids = focusIds.length ? focusIds : permalink ? [permalink] : [];
  const focus = ids[0];
  const [commentLimit, setCommentLimit] = useState(50);
  const page = useServiceQuery(["feed-comments", role, entry.id, commentLimit, focus], (s) => s.feed.getComments!(role, entry.id, commentLimit, focus), { enabled: apiConfig.dataSource === "http", keepPreviousData: false });
  const comments = useMemo(() => page.isError ? [] : page.data?.items ?? entry.comments, [page.isError, page.data, entry.comments]);
  const scrolledFocus = useRef<string | null>(null);
  const { data: identity } = useServiceQuery(["feed", "identity", role], async (s) => (role === "recruiter" ? (await s.workspace.getRecruiterShell()).identity : (await s.workspace.getProfessionalShell()).person));
  const roots = comments.filter((comment) => !comment.parentId || !comments.some((item) => item.id === comment.parentId));
  const repliesFor = (id: string) => comments.filter((comment) => comment.parentId === id);
  useEffect(() => {
    if (!focus || scrolledFocus.current === focus) return;
    const frame = requestAnimationFrame(() => { const target = document.getElementById("comment-" + focus); if (target) { target.scrollIntoView({ block: "center" }); scrolledFocus.current = focus; } });
    return () => cancelAnimationFrame(frame);
  }, [focus, comments]);
  return (
    <section className="feed-comments" aria-label="Comments">
      <div className="feed-comment-list">
        {roots.map((comment) => (
          <CommentThread key={comment.id} comment={comment} replies={repliesFor(comment.id)} entry={entry} role={role} identity={identity} focusIds={ids} />
        ))}
      </div>
      {page.isError && <p role="alert">Comments could not be loaded. <Button onClick={() => void page.refetch()}>Try again</Button></p>}
      {page.data?.nextCursor && commentLimit < 1000 && <Button disabled={page.isFetching} onClick={() => setCommentLimit((n) => n + 50)}>Load more comments</Button>}
      <CommentComposer entryId={entry.id} role={role} identity={identity} fieldId={"comment-" + entry.id} placeholder="Write a comment" />
      <DevOnly>
        <small>Comments are saved locally in this demo.</small>
      </DevOnly>
    </section>
  );
}

function ActivityMenu({ entry, role }: { entry: FeedEntry; role: Role }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(ref, { closeOnAction: true });
  const router = useRouter();
  const posts = usePostDialogs();
  const updates = useUpdateDialogs();
  const jobs = useJobActions();
  const job = entry.type === "job";
  const own = entry.viewer.own;
  const save = () => jobs.toggleSave(role, entry.id, job ? "job" : "post");
  const edit = () => {
    if (role === "recruiter") return job ? router.push("/recruiter/jobs/new?id=" + encodeURIComponent(entry.id)) : posts.edit(role, entry);
    return entry.type === "update" ? updates.edit(entry.id) : posts.edit(role, entry);
  };
  const remove = () => {
    if (role === "recruiter") return job ? router.push("/recruiter/applications") : posts.remove(role, entry.id, entry.version);
    return entry.type === "update" ? updates.remove(entry.id) : posts.remove(role, entry.id, entry.version);
  };
  return (
    <details className="activity-post-menu" ref={ref}>
      <summary aria-label={"Post actions for " + entry.title}>
        <Icon name="more" />
      </summary>
      <div className="activity-post-menu-items">
        {entry.visibility === "Private" && <p>Private · Only you</p>}
        <Button variant="text sm" icon="bookmark" onClick={save} aria-pressed={entry.viewer.saved}>
          {entry.viewer.saved ? "Unsave" : "Save"}
        </Button>
        {own && (
          <>
            <Button variant="text sm" icon="edit" onClick={edit}>
              Edit post
            </Button>
            <Button variant="text sm" icon="trash" onClick={remove}>
              {job ? "Manage job" : "Delete post"}
            </Button>
          </>
        )}
      </div>
    </details>
  );
}

export interface FeedCardProps {
  entry: FeedEntry;
  role: Role;
  /** Owner edit/delete still appear in the card menu when `entry.viewer.own`. */
  activity?: boolean;
  /** Analytics surface for impressions. */
  surface?: string;
  position?: number;
  highlighted?: boolean;
  /** Open the comment thread and highlight these comments (activity, permalinks). */
  focusComments?: Id[];
  /** Live previews (post editor) do not report impressions. */
  noTracking?: boolean;
  localPreview?: boolean;
}

/** One feed item: post, work update or job (prototype `feedCard`). */
export function FeedCard({ entry, role, surface = "feed", position = 0, highlighted = false, focusComments, noTracking = false, localPreview = false }: FeedCardProps) {
  const permalinkComment = useSearchParams()?.get("comment");
  const highlightIds = useMemo(() => focusComments?.length ? focusComments : permalinkComment && highlighted ? [permalinkComment] : [], [focusComments, permalinkComment, highlighted]);
  const autoOpened = useRef(false);
  useLayoutEffect(() => {
    if (!highlightIds.length || autoOpened.current) return;
    autoOpened.current = true;
    if (!useUiStore.getState().feed.openComments.includes(entry.id)) useUiStore.getState().toggleFeedList("openComments", entry.id);
  }, [highlightIds, entry.id]);
  const run = useServiceAction();
  const projects = useProjectDialogs();
  const jobs = useJobActions();
  const { openComments, expanded } = useUiStore((s) => s.feed);
  const toggleFeedList = useUiStore((s) => s.toggleFeedList);
  const shareSheet = useShareSheet();
  const like = useFeedInteraction(entry, role, "liked");
  const repost = useFeedInteraction(entry, role, "reposted");
  const ref = useImpression<HTMLElement>(() => {if(noTracking)return;if(entry.analyticsContext)track("recommendation_exposed",entry.analyticsContext);else track("feed_item_impression", { itemId: entry.id, itemType: entry.type, surface, position });},entry.analyticsContext?.requestId);
  const job = entry.type === "job";
  const p = job ? entry.company! : entry.author!;
  const href = job ? organizationProfileHref(role, entry.company?.confidential ? undefined : entry.company?.slug) : authorHref(role, entry);
  const open = openComments.includes(entry.id);
  const isExpanded = expanded.includes(entry.id);
  const long = entry.body?.length > 420 && !isExpanded;
  // A truncated body never splits a URL into a broken link.
  const text = long ? entry.body.slice(0, linkSafeCut(entry.body, 420)) : entry.body;
  const likes = entry.likes + Number(like.enabled);
  const commentCount = entry.commentCount;
  const canRepost = entry.viewer.canRepost ?? (!job && (entry.viewer.own || entry.visibility !== "Private"));
  const repostUnavailable = !canRepost && !repost.enabled;
  const repostUnavailableReason = job ? "Job listings cannot be reposted." : "This post is not available for reposting.";
  const repostReasonId = `repost-reason-${role}-${entry.id}`;
  const linked = entry.project?.visibility === "Public" ? entry.project : undefined;

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
  const share = () => shareSheet.open(role, entry.id);
  const { data: identity } = useServiceQuery(["feed", "identity", role], async (s) => (role === "recruiter" ? (await s.workspace.getRecruiterShell()).identity : (await s.workspace.getProfessionalShell()).person));
  const reposter = repost.enabled ? identity ?? entry.repost?.author : entry.repost?.author;
  const contextLine = job ? "An opportunity to do meaningful work" : entry.viewer.own ? "Your professional story" : firstName(p.name) + " is part of your network";
  const headline = JOB_HEADLINES[entry.job?.art ?? ""] ?? ["Make room", "for bold ideas."];
  const followers = job ? (entry.company?.confidential ? undefined : entry.company?.followerCount) : entry.author?.followerCount;
  const followerText = followers == null ? "" : formatFollowers(followers);
  const reposterLink = reposter ? (repost.enabled ? (role === "recruiter" ? "/recruiter/profile" : "/app/profile") : personHref(role, reposter)) : undefined;

  return (
    <article ref={ref} className={"card feed-post" + (job ? " feed-job-post" : "") + (highlighted ? " is-highlighted" : "")} id={"feed-" + entry.id} data-post-id={entry.id}>
      {entry.recommendationReason&&<p className="small muted" style={{padding:"12px 20px 0"}}>{entry.recommendationReason}</p>}
      <div className="feed-post-context">
        {reposter ? (
          <>
            {reposterLink ? <Link href={reposterLink} aria-label={"View " + reposter.name + " profile"}><Avatar person={reposter} /></Link> : <Avatar person={reposter} />}
            <span>{reposterLink ? <Link href={reposterLink}><strong>{reposter.name}</strong></Link> : <strong>{reposter.name}</strong>} reposted this</span>
          </>
        ) : (
          <>
            <Icon name={job ? "briefcase" : entry.type === "update" ? "pulse" : "users"} />
            <span>{contextLine}</span>
          </>
        )}
      </div>
      <header className="feed-post-header">
        <div className="row">
          {job ? (
            href ? (
              <Link href={href} aria-label={"View " + p.name + " profile"}>
                <CompanyAvatar company={entry.company!} />
              </Link>
            ) : (
              <CompanyAvatar company={entry.company!} />
            )
          ) : href ? (
            <Link href={href} aria-label={"View " + p.name + " profile"}>
              <Avatar person={p} />
            </Link>
          ) : (
            <Avatar person={p} />
          )}
          <div className="grow">
            <h2>
              {href ? <Link href={href}>{p.name}</Link> : p.name}
              {job && <span className="feed-company-label">Company</span>}
            </h2>
            <p className="feed-post-byline" title={job ? entry.company?.industry || "Creative & technology" : entry.author?.headline}>
              {job ? entry.company?.industry || "Creative & technology" : entry.author?.headline}
            </p>
            <p className="feed-post-meta">
              {followerText ? <>{followerText}<span aria-hidden> · </span></> : null}
              <time dateTime={entry.createdAt} title={entry.createdAt}>
                {timeAgo(entry.createdAt)}
              </time>
            </p>
          </div>
        </div>
        <div className="feed-post-header-tools">
          {!entry.viewer.own && !(job && entry.company?.confidential) && (
            <Button unstyled type="button" className={"feed-follow" + (entry.viewer.following ? " following" : "")} onClick={follow} aria-label={(entry.viewer.following ? "Unfollow " : "Follow ") + p.name}>
              <Icon name={entry.viewer.following ? "check" : "plus"} />
              {entry.viewer.following ? "Following" : "Follow"}
            </Button>
          )}
          {!noTracking && <ActivityMenu entry={entry} role={role} />}
        </div>
      </header>
      <div className="feed-post-body">
        {!job && entry.title.trim() ? <h3>{entry.title}</h3> : null}
        {text ? (
          <p>
            {job ? text : <LinkifiedText text={text} />}
            {long && (
              <>
                …{" "}
                <button type="button" className="feed-read-more" onClick={() => toggleFeedList("expanded", entry.id)}>
                  see more
                </button>
              </>
            )}
          </p>
        ) : null}
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
                <span className="feed-job-pay-note">{entry.job!.hideSalary ? "Compensation details" : devCopy("Illustrative salary range", "Salary range")}</span>
              </div>
              {role === "recruiter" && entry.job!.ownedByViewer ? (
                <LinkButton href={"/recruiter/applications?job=" + entry.id} variant="primary" icon="users">
                  View applications
                </LinkButton>
              ) : (
                <Button variant={entry.job!.applied ? "" : "primary"} icon="arrowUp" onClick={() => {if(!noTracking&&entry.analyticsContext)track("recommendation_clicked",entry.analyticsContext);jobs.view(entry.id, surface);}}>
                  {role === "recruiter" ? "View job post" : entry.job!.applied ? "Application saved" : "View opportunity"}
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {entry.linkPreview && <LinkPreviewCard preview={entry.linkPreview} />}
          <FeedArtwork entry={entry} onViewProject={(id) => projects.view(id)} localPreview={localPreview} />
        </>
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
        <button type="button" onClick={like.toggle} aria-disabled={like.pending} aria-label={(like.enabled ? "Unlike" : "Like") + " post"}>
          <span className="reaction-dot">
            <FeedActionIcon name="like" />
          </span>
          {likes}
          {like.enabled ? " · You liked this" : ""}
        </button>
        <button type="button" onClick={toggleComments}>
          {commentCount} {commentCount === 1 ? "comment" : "comments"}
        </button>
      </div>
      <div className="feed-post-actions">
        <button type="button" className={like.enabled ? "is-liked" : ""} onClick={like.toggle} aria-disabled={like.pending} aria-pressed={like.enabled}>
          <FeedActionIcon name="like" />
          Like
        </button>
        <button type="button" onClick={toggleComments} aria-expanded={open}>
          <FeedActionIcon name="comment" />
          Comment{commentCount > 0 ? ` ${commentCount}` : ""}
        </button>
        <button type="button" onClick={share}>
          <FeedActionIcon name="share" />
          Share
        </button>
        <button type="button" className={repost.enabled ? "is-reposted" : ""} onClick={repost.toggle} disabled={repostUnavailable} aria-pressed={repost.enabled} aria-disabled={repostUnavailable || repost.pending} aria-describedby={repostUnavailable ? repostReasonId : undefined} title={repostUnavailable ? repostUnavailableReason : repost.enabled ? "Undo repost" : "Repost to your feed"}>
          <FeedActionIcon name="repost" />
          {repost.enabled ? "Reposted" : "Repost"}
        </button>
        {repostUnavailable && <span id={repostReasonId} className="sr-only">{repostUnavailableReason}</span>}
      </div>
      {open && <Comments entry={entry} role={role} focusIds={highlightIds} />}
    </article>
  );
}
