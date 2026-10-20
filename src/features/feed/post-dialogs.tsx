"use client";

import type { Id, Role } from "@/types/domain";
import type { FeedEntry } from "@/services/feed/feed.service";
import { useServiceAction } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Button } from "@/components/ui/primitives";
import { TextAreaField, TextField } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/feedback";

function EditPost({ entry, role }: { entry: FeedEntry; role: Role }) {
  const run = useServiceAction();
  const recruiter = role === "recruiter";
  return (
    <form
      id={recruiter ? "recruiter-post-form" : "activity-post-form"}
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const ok = await run((s) => s.feed.updatePost(role, entry.id, { title: String(f.get("title") || "").trim(), body: String(f.get("body") || "").trim() }));
        if (ok === undefined) return;
        modal.close();
        toast(recruiter ? "Changes saved in your demo workspace." : "Changes saved.");
      }}
    >
      <TextField label={recruiter ? "Title" : "Post title"} name="title" defaultValue={entry.title} required maxLength={150} />
      <TextAreaField label={recruiter ? "Your post" : "Your story"} name="body" defaultValue={entry.body} required maxLength={3000} />
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save changes
        </Button>
      </div>
    </form>
  );
}

/** Edit and delete for the viewer's own posts (My Activity and the recruiter feed). */
export function usePostDialogs() {
  const run = useServiceAction();
  return {
    edit: (role: Role, entry: FeedEntry) => modal.show("Edit your post", <EditPost entry={entry} role={role} />),
    remove: (role: Role, id: Id) =>
      confirmAction(
        "Delete this post?",
        role === "recruiter" ? "Your post will be removed from this browser’s community feed." : "This removes your post and its comments from this browser.",
        async () => {
          await run((s) => s.feed.deletePost(role, id));
          modal.close();
          toast("Post deleted.");
        },
        "Delete post",
        { textClassName: role === "recruiter" ? "" : "small muted" },
      ),
  };
}
