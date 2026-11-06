"use client";
import { useSocialQuery } from "@/hooks/use-social-query";
import {useAuthAction} from "@/features/auth/use-auth-action";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServices } from "@/hooks/use-services";
import { errorMessage } from "@/services/api/client";
import type { Id, Role } from "@/types/domain";
import type { NetworkPerson } from "@/services/feed/feed.service";
import { parseShareFollowers } from "@/lib/validation/social";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, EmptyState } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/state-views";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { filterFollowers } from "./share-followers";
import { ShareDestinations } from "./share-destinations";

export function ShareFollowersPanel({ role, postId }: { role: Role; postId: Id }) {
  return <div className="post-share-panel"><div className="post-share-followers-region"><ShareFollowersForm role={role} postId={postId} /></div><ShareDestinations role={role} postId={postId} /></div>;
}

function ShareFollowersForm({ role, postId }: { role: Role; postId: Id }) {
  const services = useServices();
  const cache = useQueryClient();
  const { data, isError, error: loadError, refetch } = useSocialQuery(["network", role], (s, scope) => s.feed.getNetwork(role, scope));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const followers = useMemo(() => data?.followers ?? [], [data]);
  const visible = useMemo(() => filterFollowers(followers, query), [followers, query]);

  const toggle = (id: string) => {
    setSelected((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
    if (error) setError("");
  };

  if (isError) {
    return <ErrorState compact error={loadError} title="Your followers couldn’t load" description="You can still copy the post link below." onRetry={() => void refetch()} />;
  }
  if (!data) return <ContentSkeleton label="Loading your followers" />;

  return (
    <form
      className="share-followers"
      noValidate
      aria-describedby={error ? "share-followers-error" : undefined}
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const parsed = parseShareFollowers(selected, followers.map((person) => person.id));
        if (!parsed.success) {
          setError(parsed.error);
          requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".share-follower-row input")?.focus());
          return;
        }
        setPending(true);
        try {
          // The server re-checks that every recipient still follows this identity and delivers the
          // post link as a direct message; nothing is sent for invalid local input.
          const result = await services.feed.shareWithFollowers(role, postId, parsed.data);
          void cache.invalidateQueries({ predicate: (q) => ["messaging", "messaging-unread"].includes(String(q.queryKey[0])) });
          if (result.shared.length === 0) {
            setError("This post couldn’t be shared with the selected followers.");
            return;
          }
          const count = result.shared.length;
          toast(result.failed.length ? `Post shared with ${count} of ${parsed.data.length} followers.` : `Post shared with ${count} follower${count === 1 ? "" : "s"}.`);
          modal.close();
        } catch (shareError) {
          setError(errorMessage(shareError));
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="share-followers-search">
        <Icon name="search" />
        <span className="sr-only">Search followers</span>
        <input
          id="share-followers-search"
          type="search"
          placeholder="Search"
          value={query}
          maxLength={200}
          autoComplete="off"
          disabled={pending}
          onChange={(event) => setQuery(event.target.value.slice(0, 200))}
        />
      </label>
      {error && (
        <p className="error share-followers-error" id="share-followers-error" role="alert">
          {error}
        </p>
      )}
      {followers.length === 0 ? (
        <EmptyState compact icon="users" title="No followers yet" description="People who follow you will appear here so you can share a post with them." />
      ) : (
        <ul className="share-followers-list">
          {visible.map((person) => (
            <FollowerRow key={person.id} person={person} checked={selected.includes(person.id)} disabled={pending} onToggle={() => toggle(person.id)} />
          ))}
        </ul>
      )}
      {followers.length > 0 && visible.length === 0 && <EmptyState compact icon="search" title="No followers match your search" description="Try another name or clear the search." action={<Button variant="sm" icon="close" onClick={() => setQuery("")}>Clear search</Button>} />}
      {followers.length > 0 && (
        <footer className="share-followers-footer">
          <Button type="submit" variant="primary" loading={pending} disabled={pending}>
            Share{selected.length ? ` (${selected.length})` : ""}
          </Button>
        </footer>
      )}
    </form>
  );
}

function FollowerRow({ person, checked, disabled, onToggle }: { person: NetworkPerson; checked: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <li>
      <label className="share-follower-row">
        <Avatar person={person} />
        <span className="network-person">
          <strong>{person.name}</strong>
          {person.headline ? <p title={person.headline}>{person.headline}</p> : null}
        </span>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} aria-label={"Share with " + person.name} />
      </label>
    </li>
  );
}

export function useShareSheet() {
  const gate = useAuthAction();
  const open = useCallback((role: Role | undefined, postId: Id) => {
    void gate.run("share_followers", context => {
    modal.show("Share", <ShareFollowersPanel role={context.role} postId={postId} />, "following");
    requestAnimationFrame(() => document.getElementById("share-followers-search")?.focus());
    }, {workspace:role,target:{kind:"entry",id:postId}});
  }, [gate]);
  return { open };
}
