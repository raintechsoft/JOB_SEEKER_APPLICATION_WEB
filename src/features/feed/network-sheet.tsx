"use client";
import { useSocialQuery } from "@/hooks/use-social-query";
import {useAuthAction} from "@/features/auth/use-auth-action";
import { ContentSkeleton } from "@/components/ui/skeleton";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import type { Role } from "@/types/domain";
import type { NetworkPerson } from "@/services/feed/feed.service";
import { track } from "@/lib/analytics";
import { useServiceAction } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Avatar, EmptyState, LinkButton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/state-views";
import { DevOnly } from "@/components/ui/dev-only";
import { CompanyAvatar } from "@/components/jobs/job-visuals";
import { VerifiedCompanyMark } from "@/components/organization/controls";
import { organizationProfileHref, recruiterProfileHref } from "@/lib/routing/profiles";

type Tab = "following" | "followers";

function NetworkPanel({ role }: { role: Role }) {
  const [tab, setTab] = useState<Tab>("following");
  const run = useServiceAction();
  const { data, isError, error, refetch } = useSocialQuery(["network", role], (s, scope) => s.feed.getNetwork(role, scope));
  const tabsRef = useRef<HTMLDivElement>(null);
  if (isError) return <ErrorState compact error={error} title="Your network couldn’t load" description="Something interrupted the request. Please try again." onRetry={() => void refetch()} />;
  if (!data) return <ContentSkeleton label="Loading your network" />;
  const count = data.following.length + data.companies.length;
  const isFollowing = tab === "following";

  const follow = async (id: string, company = false) => {
    const following = await run((s) => (company ? s.feed.toggleFollowCompany(role, id) : s.feed.toggleFollow(role, id)));
    if (following === undefined) return;
    track(company ? "company_followed" : "person_followed", company ? { companyId: id, following } : { personId: id, following });
    toast("Following updated.");
  };

  const select = (next: Tab) => {
    setTab(next);
    requestAnimationFrame(() => tabsRef.current?.querySelector<HTMLElement>(`#network-tab-${next}`)?.focus());
  };

  const personRow = (p: NetworkPerson) => {
    const href = p.recruiter ? recruiterProfileHref(role, p.id) : role === "recruiter" ? "/recruiter/talent/" + p.id : "/app/professionals/" + encodeURIComponent(p.slug ?? "");
    return (
      <li className="network-row" key={p.id}>
        {href ? <Link className="network-avatar" href={href} aria-label={`View ${p.name} profile`}><Avatar person={p} /></Link> : <span className="network-avatar"><Avatar person={p} /></span>}
        <div className="network-person">
          {href ? <Link href={href}>{p.name}</Link> : <span>{p.name}</span>}
          <p>{p.headline}</p>
        </div>
        <button type="button" className={"btn sm network-follow " + (p.following ? "is-following" : "")} aria-label={(p.following ? "Unfollow " : "Follow ") + p.name} aria-pressed={p.following} onClick={() => follow(p.id)}>
          {p.following ? "Following" : tab === "followers" ? "Follow back" : "Follow"}
        </button>
      </li>
    );
  };

  const people = isFollowing ? data.following : data.followers;
  return (
    <div id="following-panel">
      <div
        className="network-tabs"
        role="tablist"
        aria-label="Your network"
        ref={tabsRef}
        onKeyDown={(e) => {
          if ((e.target as Element).getAttribute("role") !== "tab" || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
          e.preventDefault();
          select(e.key === "Home" ? "following" : e.key === "End" ? "followers" : tab === "following" ? "followers" : "following");
        }}
      >
        {(
          [
            ["following", "Following", count],
            ["followers", "Followers", data.followers.length],
          ] as const
        ).map(([id, label, n]) => (
          <button key={id} type="button" id={"network-tab-" + id} role="tab" aria-controls="network-list" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => select(id)}>
            {label} <span>{n}</span>
          </button>
        ))}
      </div>
      <section id="network-list" role="tabpanel" aria-labelledby={"network-tab-" + tab} tabIndex={0}>
        <p className="network-summary">{isFollowing ? `You are following ${count} ${count === 1 ? "account" : "accounts"} in your network.` : `${data.followers.length} ${data.followers.length === 1 ? "person follows" : "people follow"} you.`}</p>
        <ul className="network-list">
          {people.map(personRow)}
          {isFollowing &&
            data.companies.map((c) => {
              const href = organizationProfileHref(role, c.slug);
              return (
              <li className="network-row" key={c.id}>
                {href ? <Link className="network-avatar" href={href} aria-label={"View " + c.name + " profile"}><CompanyAvatar company={c} /></Link> : <CompanyAvatar company={c} />}
                <div className="network-person">
                  <span className="network-company-name">{href ? <Link href={href}>{c.name}</Link> : <strong>{c.name}</strong>}<VerifiedCompanyMark company={c} /></span>
                  <p>{c.industry || "Organization"}</p>
                </div>
                <button type="button" className="btn sm network-follow is-following" aria-label={"Unfollow " + c.name} aria-pressed="true" onClick={() => follow(c.id, true)}>
                  Following
                </button>
              </li>
              );
            })}
        </ul>
        {!(isFollowing ? count : data.followers.length) && (
          <EmptyState compact icon="users" title={isFollowing ? "Your network starts here" : "No followers yet"} description={isFollowing ? "Follow people to keep up with their work." : "People who follow you will appear here."} action={isFollowing ? <LinkButton href={role === "recruiter" ? "/recruiter/discover" : "/app/discover"} variant="sm" icon="search" onClick={() => modal.close()}>Discover people</LinkButton> : undefined} />
        )}
      </section>
      <footer className="network-footer">
        <LinkButton href={role === "recruiter" ? "/recruiter/discover" : "/app/discover"} variant="text sm" icon="search" onClick={() => modal.close()}>
          Discover people
        </LinkButton>
        <DevOnly>
          <small>Fictional demo network · Changes stay in this browser.</small>
        </DevOnly>
      </footer>
    </div>
  );
}

/** "Manage following" sheet with Following / Followers tabs. */
export function useNetworkSheet() {
  const gate = useAuthAction();
  const open = useCallback((role: Role, trigger?: HTMLElement) => {
    trigger?.closest("details")?.removeAttribute("open");
    void gate.run("view_following", () => {
    modal.show("Your network", <NetworkPanel role={role} />, "following");
    requestAnimationFrame(() => document.getElementById("network-tab-following")?.focus());
    }, {workspace:role,anchor:trigger});
  }, [gate]);
  return { open };
}
