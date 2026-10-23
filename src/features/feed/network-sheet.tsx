"use client";
import { ContentSkeleton } from "@/components/ui/skeleton";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import type { Role } from "@/types/domain";
import type { NetworkPerson } from "@/services/feed/feed.service";
import { track } from "@/lib/analytics";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, LinkButton } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { CompanyAvatar } from "@/components/jobs/job-visuals";

type Tab = "following" | "followers";

function NetworkPanel({ role }: { role: Role }) {
  const [tab, setTab] = useState<Tab>("following");
  const run = useServiceAction();
  const { data, isError, refetch } = useServiceQuery(["network", role], (s) => s.feed.getNetwork(role));
  const tabsRef = useRef<HTMLDivElement>(null);
  if (isError) return <p role="alert">Your network could not be loaded. <button type="button" onClick={()=>void refetch()}>Try again</button></p>;
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
    const href = p.recruiter ? "/recruiters/" + p.id : role === "recruiter" ? "/recruiter/talent/" + p.id : "/professionals/" + p.slug;
    return (
      <li className="network-row" key={p.id}>
        <Link className="network-avatar" href={href} aria-label={`View ${p.name} profile`}>
          <Avatar person={p} />
        </Link>
        <div className="network-person">
          <Link href={href}>{p.name}</Link>
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
            data.companies.map((c) => (
              <li className="network-row" key={c.id}>
                <CompanyAvatar company={c} />
                <div className="network-person">
                  <strong>{c.name}</strong>
                  <p>{c.industry || "Organization"}</p>
                </div>
                <button type="button" className="btn sm network-follow is-following" aria-label={"Unfollow " + c.name} aria-pressed="true" onClick={() => follow(c.id, true)}>
                  Following
                </button>
              </li>
            ))}
        </ul>
        {!(isFollowing ? count : data.followers.length) && (
          <div className="network-empty">
            <Icon name="users" />
            <h3>{isFollowing ? "Your network starts here" : "No followers yet"}</h3>
            <p>{isFollowing ? "Follow people to keep up with their work." : "People who follow you will appear here."}</p>
          </div>
        )}
      </section>
      <footer className="network-footer">
        <LinkButton href={role === "recruiter" ? "/recruiter/discover" : "/app/dashboard"} variant="text sm" icon="search">
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
  const open = useCallback((role: Role, trigger?: HTMLElement) => {
    trigger?.closest("details")?.removeAttribute("open");
    modal.show("Your network", <NetworkPanel role={role} />, "following");
    requestAnimationFrame(() => document.getElementById("network-tab-following")?.focus());
  }, []);
  return { open };
}
