"use client";

import { useCallback, useMemo, useState } from "react";
import type { Id, Role } from "@/types/domain";
import type { NetworkPerson } from "@/services/feed/feed.service";
import { devCopy } from "@/lib/env/app-env";
import { parseShareFollowers } from "@/lib/validation/social";
import { useServiceQuery } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button } from "@/components/ui/primitives";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/field";
import { filterFollowers } from "./share-followers";
import { postShareUrl } from "./share-links";
import { ShareDestinations } from "./share-destinations";

export function ShareFollowersPanel({ role, postId }: { role: Role; postId: Id }) {
  return <div className="post-share-panel"><div className="post-share-followers-region"><ShareFollowersForm role={role} postId={postId} /></div><ShareDestinations role={role} postId={postId} /></div>;
}

function ShareFollowersForm({ role, postId }: { role: Role; postId: Id }) {
  const { data, isError, refetch } = useServiceQuery(["network", role], (s) => s.feed.getNetwork(role));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [pending, setPending] = useState(false);
  const followers = useMemo(() => data?.followers ?? [], [data]);
  const visible = useMemo(() => filterFollowers(followers, query), [followers, query]);

  const toggle = (id: string) => {
    setSelected((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
    if (error) setError("");
  };

  if (isError) {
    return (
      <p role="alert">
        Your followers could not be loaded.{" "}
        <button type="button" onClick={() => void refetch()}>
          Try again
        </button>
      </p>
    );
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
        const url = postShareUrl(role, postId, window.location.origin);
        setPending(true);
        try {
          await navigator.clipboard.writeText(url);
          toast(devCopy("Post link copied. Local-only content stays in this browser.", "Post link copied."));
          modal.close();
        } catch {
          setLink(url);
          setError("Copy the post link below.");
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
        <div className="network-empty">
          <Icon name="users" />
          <h3>No followers yet</h3>
          <p>People who follow you will appear here so you can share a post with them.</p>
        </div>
      ) : (
        <ul className="share-followers-list">
          {visible.map((person) => (
            <FollowerRow key={person.id} person={person} checked={selected.includes(person.id)} disabled={pending} onToggle={() => toggle(person.id)} />
          ))}
        </ul>
      )}
      {followers.length > 0 && visible.length === 0 && <p className="share-followers-empty">No followers match your search.</p>}
      {link && <TextField label="Follower share link" name="link" value={link} readOnly onClick={(event) => event.currentTarget.select()} />}
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
  const open = useCallback((role: Role, postId: Id) => {
    modal.show("Share", <ShareFollowersPanel role={role} postId={postId} />, "following");
    requestAnimationFrame(() => document.getElementById("share-followers-search")?.focus());
  }, []);
  return { open };
}
