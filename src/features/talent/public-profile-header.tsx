"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MediaImage } from "@/components/ui/media-image";
import { Avatar, LinkButton } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import {
  PublicFollowButton,
  PublicMessageButton,
} from "@/features/public-browsing/public-account-actions";
import { PublicProfileSafetyMenu } from "@/features/talent/public-profile-safety-menu";

export type PublicProfileLink = { label: string; url: string };

export type PublicProfileHeaderPerson = {
  id: string;
  name: string;
  headline: string;
  picture?: string;
  color?: string;
  cover?: string;
  followerCount?: number;
  /** Optional directory facts shown before the follower count. */
  location?: string;
  years?: number;
};

/** Up to two public link badges from already-visible URLs. */
export function takePublicLinks(
  links: PublicProfileLink[],
  limit = 2,
): PublicProfileLink[] {
  const seen = new Set<string>();
  const out: PublicProfileLink[] = [];
  for (const link of links) {
    const url = link.url.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ label: link.label.trim() || hostLabel(url), url });
    if (out.length >= limit) break;
  }
  return out;
}

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

function formatFollowers(count: number) {
  if (count === 1) return "1 follower";
  return `${count.toLocaleString()} followers`;
}

/** `title · location · experience · followers` — omits empty leading parts. */
export function formatProfileFacts(input: {
  title?: string;
  location?: string;
  years?: number;
  /** Omit to hide the follower segment. */
  followerCount?: number;
}) {
  const parts = [
    input.title?.trim() || "",
    input.location?.trim() || "",
    input.years && input.years > 0 ? `${input.years} years` : "",
    input.followerCount !== undefined ? formatFollowers(input.followerCount) : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function TruncatedBio({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (expanded) return;
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);
  if (!text.trim()) return null;
  return (
    <div className="public-profile-bio">
      <p
        id={id}
        ref={ref}
        className={expanded ? "is-expanded" : "is-clamped"}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          className="public-profile-bio-toggle"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "More"}
        </button>
      )}
    </div>
  );
}

export function PublicProfileHeader({
  person,
  bio,
  links,
  own,
  following,
  editHref,
  association,
  extras,
  coverFallback,
  variant = "person",
  logoUrl,
  titleBadge,
  /** Put headline on the facts line with followers (`Title · 2 followers`) instead of a separate role row. */
  headlineInFacts = false,
}: {
  person: PublicProfileHeaderPerson;
  bio: string;
  links: PublicProfileLink[];
  own: boolean;
  following: boolean;
  editHref?: string;
  association?: ReactNode;
  extras?: ReactNode;
  coverFallback?: string;
  /** Organization public pages use a logo tile and company follow. */
  variant?: "person" | "organization";
  logoUrl?: string;
  titleBadge?: ReactNode;
  headlineInFacts?: boolean;
}) {
  const organization = variant === "organization";
  const [followers, setFollowers] = useState(person.followerCount ?? 0);
  useEffect(() => {
    setFollowers(person.followerCount ?? 0);
  }, [person.id, person.followerCount]);
  const badges = takePublicLinks(links);
  const cover = person.cover?.trim() || "";
  const headline = person.headline.trim();
  const facts = formatProfileFacts({
    title: headlineInFacts ? headline : undefined,
    location: person.location,
    years: person.years,
    followerCount: person.followerCount === undefined ? undefined : followers,
  });
  return (
    <header className="public-profile-hero">
      <div className={"public-profile-cover" + (cover ? " has-image" : "")}>
        {cover ? (
          <MediaImage src={cover} alt="" fallback={null} />
        ) : (
          <span>{coverFallback || (organization ? "GOOD WORK STARTS WITH GOOD PEOPLE." : "WORK SPEAKS.")}</span>
        )}
      </div>
      <div className="public-profile-identity">
        {!own ? (
          <PublicProfileSafetyMenu
            id={person.id}
            name={person.name}
            kind={organization ? "organization" : "person"}
          />
        ) : null}
        <span className={"public-profile-avatar" + (organization ? " is-logo" : "")}>
          {organization ? (
            logoUrl ? (
              <MediaImage src={logoUrl} alt="" fallback={null} />
            ) : (
              <span className="public-profile-logo-fallback" aria-hidden="true">
                {person.name.trim().slice(0, 1).toUpperCase() || "C"}
              </span>
            )
          ) : (
            <Avatar
              person={{
                id: person.id,
                name: person.name,
                picture: person.picture || "",
                color: person.color,
              }}
              size="xl"
            />
          )}
        </span>
        <div className="public-profile-meta">
          <div className="public-profile-title-row">
            <h1>{person.name}</h1>
            {titleBadge}
          </div>
          {!headlineInFacts && headline ? <p className="public-profile-role">{headline}</p> : null}
          {facts ? <p className="public-profile-followers">{facts}</p> : null}
          {association}
          <TruncatedBio text={bio} />
          {badges.length > 0 && (
            <ul className="public-profile-links" aria-label={organization ? "Company links" : "Professional links"}>
              {badges.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="public-profile-link-badge"
                  >
                    <Icon name="link" />
                    <span>{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="public-profile-actions">
            {own ? (
              editHref ? (
                <LinkButton href={editHref} variant="primary" icon="edit">
                  Edit profile
                </LinkButton>
              ) : null
            ) : (
              <>
                {!organization ? <PublicMessageButton id={person.id} /> : null}
                <PublicFollowButton
                  id={person.id}
                  name={person.name}
                  company={organization}
                  initialFollowing={following}
                  onChange={(next) =>
                    setFollowers((count) => Math.max(0, count + (next ? 1 : -1)))
                  }
                />
              </>
            )}
            {extras}
          </div>
        </div>
      </div>
    </header>
  );
}
