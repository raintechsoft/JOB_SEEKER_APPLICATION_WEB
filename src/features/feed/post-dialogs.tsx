"use client";

import { useState } from "react";
import type { Id, Role } from "@/types/domain";
import type { FeedEntry, FeedPage } from "@/services/feed/feed.service";
import { devCopy } from "@/lib/env/app-env";
import { useServiceAction, useServices } from "@/hooks/use-services";
import { useQueryClient } from "@tanstack/react-query";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Button } from "@/components/ui/primitives";
import { TextAreaField, TextField } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/feedback";
import { useFormAction } from "@/hooks/use-form-action";
import { postTextSchema } from "@/lib/validation/social";
import { useLinkPreview } from "@/features/posts/use-link-preview";
import { ComposerLinkPreview } from "@/features/posts/composer-link-preview";
import { findLinks } from "@/lib/validation/link-preview";

export function EditPost({ entry, role }: { entry: FeedEntry; role: Role }) {
  const services=useServices();
  const cache=useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction(setErrors);
  const recruiter = role === "recruiter";
  const [body, setBody] = useState(entry.body);
  const [dismissed, setDismissed] = useState<string[]>([]);
  // A link already in the post without a stored preview counts as previously dismissed.
  const [initiallyHidden] = useState(() => (entry.linkPreview ? [] : findLinks(entry.body).map((link) => link.key)));
  const link = useLinkPreview({ role, text: body, dismissed: [...initiallyHidden, ...dismissed], onDismiss: (key) => setDismissed((keys) => [...keys, key]), initial: entry.linkPreview });
  return (
    <form
      id={recruiter ? "recruiter-post-form" : "activity-post-form"}
      className="stack"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const parsed = postTextSchema.safeParse({ title: String(f.get("title") || ""), body: String(f.get("body") || "") });
        if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
        if (!(await execute((s) => s.feed.updatePost(role, entry.id, { ...parsed.data, version: entry.version, previewUrl: link.submitUrl }), {invalidate:["feed","feed-entry","activity"]}))) return;
        // Read the confirmed revision, then replace stale list/permalink snapshots together.
        try {
          const fresh=await services.feed.getEntry(role,entry.id);
          if(fresh){
            await cache.cancelQueries({predicate:q=>(q.queryKey[0]==="feed"||q.queryKey[0]==="feed-entry")&&q.queryKey[1]===role});
            cache.setQueriesData<FeedPage>({predicate:q=>q.queryKey[0]==="feed"&&q.queryKey[1]===role},current=>current?{...current,items:current.items.map(item=>item.id===fresh.id?fresh:item)}:current);
            cache.setQueryData(["feed-entry",role,entry.id],fresh);
          }
        }catch{ /* The edit is committed; keep the confirmed success if a refresh is temporarily unavailable. */ }
        modal.close();
        toast(recruiter ? devCopy("Changes saved in your demo workspace.", "Changes saved.") : "Changes saved.");
      }}
    >
      {errors._form && <p role="alert" className="error">{errors._form}</p>}
      <fieldset disabled={pending} className="contents">
      <TextField label={recruiter ? "Title" : "Post title"} name="title" defaultValue={entry.title} maxLength={150} error={errors.title} />
      <TextAreaField label={recruiter ? "Your post" : "Your story"} name="body" value={body} onChange={(e) => setBody(e.target.value)} onPaste={(e) => link.confirm(e.clipboardData.getData("text"))} onBlur={(e) => link.confirm(e.target.value)} maxLength={3000} error={errors.body} />
      <ComposerLinkPreview state={link.state} onRemove={link.dismiss} />
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" loading={pending}>
          Save changes
        </Button>
      </div>
      </fieldset>
    </form>
  );
}

/** Edit and delete for the viewer's own posts (My Activity and the recruiter feed). */
export function usePostDialogs() {
  const run = useServiceAction();
  return {
    edit: (role: Role, entry: FeedEntry) => modal.show("Edit your post", <EditPost entry={entry} role={role} />),
    remove: (role: Role, id: Id, version?: number) =>
      confirmAction(
        "Delete this post?",
        role === "recruiter" ? devCopy("Your post will be removed from this browser’s community feed.", "Your post will be removed from the community feed.") : devCopy("This removes your post and its comments from this browser.", "This removes your post and its comments."),
        async () => {
          const ok = await run(async (s) => { await s.feed.deletePost(role, id, version); return true; });
          if (!ok) return;
          modal.close();
          toast("Post deleted.");
        },
        "Delete post",
        { textClassName: role === "recruiter" ? "" : "small muted" },
      ),
  };
}
