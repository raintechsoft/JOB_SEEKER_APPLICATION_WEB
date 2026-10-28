"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, Button, IconButton, type AvatarPerson } from "@/components/ui/primitives";
import { MediaImage } from "@/components/ui/media-image";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/text";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { SuggestionCardMenu, type SuggestionCardAction } from "./suggestion-card-menu";

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

/** Placeholder with the real card's shell, cover, photo and text positions, so loading never reflows. */
function SuggestionCardSkeleton() {
  return (
    <div className="suggestion-card is-skeleton">
      <span className="suggestion-card-main">
        <Skeleton className="suggestion-card-cover" />
        <span className="suggestion-card-photo"><Skeleton className="suggestion-skeleton-photo" /></span>
        <Skeleton className="suggestion-skeleton-line is-name" />
        <Skeleton className="suggestion-skeleton-line" />
      </span>
      <Skeleton className="suggestion-skeleton-action" />
    </div>
  );
}

/** Loading rows of suggestion cards in the same grid; optional headings match discovery rows. */
export function SuggestionCardsSkeleton({ rows = 1, cards = 8, headings = false, label = "Loading people" }: { rows?: number; cards?: number; headings?: boolean; label?: string }) {
  return (
    <LoadingRegion label={label}>
      {Array.from({ length: rows }, (_, row) => (
        <div className={headings ? "talent-discovery-row" : undefined} key={row}>
          {headings && (
            <div className="suggestion-skeleton-heading">
              <Skeleton style={{ width: 210, height: 20 }} />
              <Skeleton style={{ width: 320, height: 13 }} />
            </div>
          )}
          <SuggestionCardGrid>
            {Array.from({ length: cards }, (_, i) => <SuggestionCardSkeleton key={i} />)}
          </SuggestionCardGrid>
        </div>
      ))}
    </LoadingRegion>
  );
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
  detail,
  action,
  menu,
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
  /** Extra muted line under the meta, such as availability or a recommendation reason. */
  detail?: ReactNode;
  /** Replaces the Follow button with another footer action. */
  action?: ReactNode;
  /** Extra actions in a top-corner "more" menu, such as Save to shortlist or Message. */
  menu?: SuggestionCardAction[];
  following?: boolean;
  onFollow?: () => void | Promise<void>;
  onDismiss?: () => void;
}) {
  const followLabel = (following ? "Unfollow " : "Follow ") + name;
  return (
    <article className={cn("suggestion-card", kind === "company" && "is-company")}>
      {onDismiss ? <IconButton icon="close" label={"Hide " + name} extra="suggestion-card-dismiss" onClick={onDismiss} /> : null}
      {menu?.length && !onDismiss ? <SuggestionCardMenu name={name} actions={menu} /> : null}
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
        {detail ? <span className="suggestion-card-detail">{detail}</span> : null}
      </Link>
      {action ?? (onFollow ? (
        <Button unstyled type="button" icon={following ? "check" : "plus"} className={"suggestion-card-follow" + (following ? " is-following" : "")} aria-pressed={following} aria-label={followLabel} onClick={onFollow}>
          {following ? "Following" : "Follow"}
        </Button>
      ) : null)}
    </article>
  );
}
