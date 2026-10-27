"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, Button, IconButton, type AvatarPerson } from "@/components/ui/primitives";
import { MediaImage } from "@/components/ui/media-image";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/text";

const COVER_TONES = [
  ["#4a1d3a", "#8b3a4a"],
  ["#243c56", "#3d6b8a"],
  ["#1f3d36", "#3d7a62"],
  ["#2c2658", "#5a4a9a"],
  ["#4a2a1a", "#9a5a32"],
] as const;

function coverBackground(seed: string) {
  let hash = 0;
  for (const character of seed) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  const [from, to] = COVER_TONES[hash % COVER_TONES.length];
  return `linear-gradient(125deg, ${from} 0%, ${to} 100%)`;
}

export function SuggestionCardGrid({ children }: { children: ReactNode }) {
  return <div className="suggestion-card-grid">{children}</div>;
}

export function SuggestionCard({
  href,
  name,
  headline,
  person,
  kind = "person",
  label,
  coverUrl,
  verified,
  meta,
  following = false,
  onFollow,
  onDismiss,
}: {
  href: string;
  name: string;
  headline?: string;
  person: AvatarPerson;
  kind?: "person" | "company";
  label?: string;
  coverUrl?: string;
  verified?: boolean;
  meta?: ReactNode;
  following?: boolean;
  onFollow?: () => void | Promise<void>;
  onDismiss?: () => void;
}) {
  const followLabel = (following ? "Unfollow " : "Follow ") + name;
  return (
    <article className={cn("suggestion-card", kind === "company" && "is-company")}>
      {onDismiss ? <IconButton icon="close" label={"Hide " + name} extra="suggestion-card-dismiss" onClick={onDismiss} /> : null}
      <Link href={href} className="suggestion-card-main" aria-label={label ?? "View " + name}>
        <span className={"suggestion-card-cover" + (coverUrl ? " has-image" : "")} style={coverUrl ? undefined : { background: coverBackground(person.id || name) }}>
          {coverUrl ? <MediaImage src={coverUrl} alt="" /> : <><i /><i /><i /></>}
        </span>
        <span className="suggestion-card-photo">
          <Avatar person={person} size="lg" />
        </span>
        <strong className="suggestion-card-name">
          <span>{name}</span>
          {verified ? <Icon name="shield" /> : null}
        </strong>
        <span className="suggestion-card-headline" title={headline || undefined}>{headline || "\u00a0"}</span>
        {meta ? <span className="suggestion-card-meta">{meta}</span> : null}
      </Link>
      {onFollow ? (
        <Button unstyled type="button" icon={following ? "check" : "plus"} className={"suggestion-card-follow" + (following ? " is-following" : "")} aria-pressed={following} aria-label={followLabel} onClick={onFollow}>
          {following ? "Following" : "Follow"}
        </Button>
      ) : null}
    </article>
  );
}
