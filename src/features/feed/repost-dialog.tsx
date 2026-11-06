"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FeedEntry } from "@/services/feed/feed.service";
import type { Role } from "@/types/domain";
import { useServices } from "@/hooks/use-services";
import { errorMessage } from "@/services/api/client";
import { repostCommentarySchema } from "@/lib/validation/social";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Avatar, Button } from "@/components/ui/primitives";
import { FloatingTextArea } from "@/components/ui/field";

const FEED_QUERIES = { predicate: (query: { queryKey: readonly unknown[] }) => ["feed", "feed-entry", "activity"].includes(String(query.queryKey[0])) && query.queryKey[1] !== "identity" };

/**
 * "Repost with your thoughts": creates the viewer's independent repost of the original behind this
 * entry, carrying their commentary. Reposting a repost keeps that repost as parent; the original and
 * every other person's repost stay untouched.
 */
export function RepostDialog({ entry, role }: { entry: FeedEntry; role: Role }) {
  const services = useServices();
  const client = useQueryClient();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const who = entry.type === "job" ? entry.company?.name : entry.author?.name;
  const preview = (entry.title?.trim() || entry.body || "").replace(/\s+/g, " ").trim().slice(0, 140);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const parsed = repostCommentarySchema.safeParse(text);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setPending(true);
    try {
      await services.feed.createRepost(role, entry.id, parsed.data || null);
      void client.invalidateQueries(FEED_QUERIES);
      toast(parsed.data ? "Reposted with your thoughts." : "Reposted to your feed.");
      modal.close();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="repost-dialog" noValidate onSubmit={submit} aria-describedby={error ? "repost-dialog-error" : undefined}>
      <FloatingTextArea label="Add your thoughts (optional)" name="commentary" value={text} maxLength={1000} rows={4} autoFocus disabled={pending} onChange={(event) => { setText(event.target.value); if (error) setError(""); }} />
      {error && <p className="error" id="repost-dialog-error" role="alert">{error}</p>}
      <div className="repost-dialog-preview" aria-label="Post being reposted">
        {entry.author ? <Avatar person={entry.author} /> : null}
        <div className="repost-dialog-preview-text">
          <strong>{who}</strong>
          {entry.repost?.author ? <span className="muted"> · reposted by {entry.repost.author.name}</span> : null}
          <p>{preview || "Post"}</p>
        </div>
      </div>
      <div className="modal-footer">
        <Button type="button" onClick={() => modal.close()} disabled={pending}>Cancel</Button>
        <Button type="submit" variant="primary" loading={pending} disabled={pending}>{text.trim() ? "Repost with your thoughts" : "Repost"}</Button>
      </div>
    </form>
  );
}
