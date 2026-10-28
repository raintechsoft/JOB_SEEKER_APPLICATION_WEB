"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedComment, FeedEntry } from "@/services/feed/feed.service";
import type { Role } from "@/types/domain";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { SelectField, TextAreaField } from "@/components/ui/field";
import { useDismissableDetails } from "@/hooks/use-dismissable";
import { useFormAction } from "@/hooks/use-form-action";
import { reportSchema } from "@/lib/validation/communication";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";

const invalidates = ["feed", "feed-entry", "feed-comments", "activity", "network", "people-search", "workspace-search", "blocked-accounts", "messaging", "inbox", "messages"];

function CommentReportForm({ role, comment }: { role: Role; comment: FeedComment }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction(setErrors);
  return <form className="stack" noValidate onSubmit={async event => {
    event.preventDefault();
    setErrors({});
    const fields = new FormData(event.currentTarget);
    const value = reportSchema.safeParse({ reason: String(fields.get("reason") || ""), details: String(fields.get("details") || "") });
    if (!value.success) { setErrors(Object.fromEntries(value.error.issues.map(issue => [String(issue.path[0]), issue.message]))); return; }
    if (!await execute(s => s.feed.reportComment(role, comment.id, value.data.reason, value.data.details))) return;
    modal.close(); toast("Comment reported for review.");
  }}>
    <p>Report {comment.author.name}’s comment. Your report is private.</p>
    {errors._form && <p className="error" role="alert">{errors._form}</p>}
    <SelectField required label="Reason" name="reason" options={["Spam or unwanted messages", "Harassment", "Misleading job or identity", "Other"]} defaultValue="Spam or unwanted messages" error={errors.reason} disabled={pending} />
    <TextAreaField label="Additional details" name="details" maxLength={1500} error={errors.details} disabled={pending} />
    <div className="modal-footer"><Button onClick={() => modal.close()} disabled={pending}>Cancel</Button><Button type="submit" variant="primary" loading={pending}>Submit report</Button></div>
  </form>;
}

export function CommentMenu({ role, entry, comment, onEdit }: { role: Role; entry: FeedEntry; comment: FeedComment; onEdit?: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(ref, { closeOnAction: true });
  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const place = () => {
      if (!menu.open) return;
      const panel = menu.querySelector<HTMLElement>(".activity-post-menu-items");
      if (!panel) return;
      const anchor = menu.getBoundingClientRect();
      const headerBottom = document.querySelector(".professional-header")?.getBoundingClientRect().bottom ?? 0;
      const above = Math.max(0, anchor.top - headerBottom - 12), below = window.innerHeight - anchor.bottom - 12;
      const up = below < Math.min(panel.scrollHeight, 360) && above > below;
      menu.dataset.side = up ? "up" : "down";
      panel.style.maxHeight = `${Math.max(100, Math.min(360, up ? above : below))}px`;
    };
    menu.addEventListener("toggle", place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { menu.removeEventListener("toggle", place); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, []);
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute: perform, pending } = useFormAction(setErrors);
  const execute: typeof perform = (action, options) => { setErrors({}); return perform(action, options); };
  const name = comment.author.name;
  const own = !!comment.own;
  return <>
    <details className="activity-post-menu feed-comment-menu" ref={ref}>
      <summary aria-label={`Comment actions for ${name}`}><Icon name="more" /></summary>
      <div className="activity-post-menu-items">
        {(comment.canMessage ?? !own) && <Button variant="text sm" icon="send" disabled={pending} onClick={async () => {
          let id: string | null = null;
          if (!await execute(async s => { id = await s.messaging.start(role, comment.author.id); if (!id) throw new Error("Messaging is unavailable for this account."); }, { invalidate: ["messaging", "inbox"] })) return;
          router.push((role === "recruiter" ? "/recruiter/messages" : "/app/messages") + "?conversation=" + encodeURIComponent(id!));
        }}>Message {name}</Button>}
        <Button variant="text sm" icon="link" onClick={async () => {
          const url = new URL(role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard", window.location.origin);
          url.searchParams.set("post", entry.id); url.searchParams.set("comment", comment.id); url.hash = "comment-" + comment.id;
          try { await navigator.clipboard.writeText(url.toString()); toast("Comment link copied."); }
          catch { toast("The link could not be copied. Please allow clipboard access.", "error"); }
        }}>Copy link to comment</Button>
        {(comment.canPin ?? (entry.viewer.own && !comment.parentId)) && <Button variant="text sm" icon="pin" disabled={pending} onClick={async () => {
          if (await execute(s => s.feed.pinComment(role, entry.id, comment.id, !comment.pinned), { invalidate: invalidates })) toast(comment.pinned ? "Comment unpinned." : "Comment pinned.");
        }}>{comment.pinned ? "Unpin comment" : "Pin comment"}</Button>}
        {!own && comment.following && <Button variant="text sm" icon="userMinus" disabled={pending} onClick={async () => {
          if (await execute(async s => { await s.feed.toggleFollow(role, comment.author.id, false); }, { invalidate: invalidates })) toast("Unfollowed " + name + ".");
        }}>Unfollow {name}</Button>}
        {own && onEdit && <Button variant="text sm" icon="edit" disabled={pending} onClick={onEdit}>Edit</Button>}
        {(comment.canDelete ?? (own || entry.viewer.own)) && <Button variant="text sm" icon="trash" disabled={pending} onClick={async () => {
          if (await execute(s => s.feed.deleteComment(role, entry.id, comment.id, comment.version), { invalidate: invalidates })) toast("Comment deleted.");
        }}>Delete</Button>}
        {(comment.canBlock ?? !own) && <Button variant="text sm" icon="ban" disabled={pending} onClick={async () => {
          if (await execute(s => s.feed.blockCommentAuthor(role, entry.id, comment.id), { invalidate: invalidates })) toast("Blocked " + name + ". You can unblock this account from your account menu.");
        }}>Block {name}</Button>}
        {(comment.canReport ?? !own) && <Button variant="text sm" icon="flag" disabled={pending} onClick={() => modal.show("Report comment", <CommentReportForm role={role} comment={comment} />)}>Report comment</Button>}
      </div>
    </details>
    {errors._form && <p className="error" role="alert">{errors._form}</p>}
  </>;
}
