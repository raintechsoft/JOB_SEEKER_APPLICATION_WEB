"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/types/domain";
import { track } from "@/lib/analytics";
import { workspaceTitle } from "@/lib/routing/titles";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { useNavigationDock } from "@/hooks/use-navigation-dock";
import { useUiStore } from "@/stores/ui-store";
import { toast } from "@/stores/toast-store";
import { Icon, type IconName } from "@/components/ui/icon";
import { FloatingInput } from "@/components/ui/field";
import { Avatar, Brand, IconButton } from "@/components/ui/primitives";
import { workspaceDialogs } from "@/features/workspace/dialogs";
import { useNetworkSheet } from "@/features/feed/network-sheet";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
  unread?: number;
}

function HeaderSearch({ role }: { role: Role }) {
  const router = useRouter();
  const query = useUiStore((s) => s.feed.query);
  const setFeed = useUiStore((s) => s.setFeed);
  return (
    <form
      className="professional-search"
      id="feed-search-form"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const value = String(new FormData(e.currentTarget).get("query") || "").trim();
        setFeed({ query: value, visible: 12 });
        track("search_performed", { surface: "feed", hasQuery: !!value });
        router.push(role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard");
      }}
    >
      <Icon name="search" />
      <FloatingInput key={query} compact label="Search your feed" name="query" type="search" aria-label="Search your feed" placeholder="Search your feed" defaultValue={query} />
      <kbd>⌘ K</kbd>
    </form>
  );
}

function WorkspaceNav({ items, label }: { items: NavItem[]; label: string }) {
  const ref = useRef<HTMLElement>(null);
  useNavigationDock(ref);
  return (
    <nav className="professional-nav" aria-label={label} ref={ref}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={item.active ? "active" : ""} aria-current={item.active ? "page" : undefined}>
          <span className="nav-dock-icon" aria-hidden="true">
            <Icon name={item.icon} />
          </span>
          <span>{item.label}</span>
          {!!item.unread && (
            <i className="nav-unread" aria-label={`${item.unread} unread conversation${item.unread === 1 ? "" : "s"}`}>
              {item.unread > 99 ? "99+" : item.unread}
            </i>
          )}
        </Link>
      ))}
    </nav>
  );
}

function AccountMenu({ person, children }: { person: { id: string; name: string; picture?: string; color?: string } | undefined; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return (
    <details className="professional-account" ref={ref}>
      <summary aria-label="Open account menu">
        {person ? <Avatar person={person} /> : <span className="avatar" />}
        <Icon name="down" />
      </summary>
      <div className="professional-account-menu">{children}</div>
    </details>
  );
}

function useLogout() {
  const run = useServiceAction();
  const router = useRouter();
  return async () => {
    await run((s) => s.workspace.signOut());
    router.push("/");
    toast("You’ve left the demo workspace. Local changes are kept.");
  };
}

/** Mirrors the prototype: entering a workspace URL switches the demo session role. */
function useWorkspaceRole(role: Role, enabled: boolean) {
  const run = useServiceAction();
  useEffect(() => {
    if (enabled) void run((s) => s.workspace.setRole(role), { refresh: false });
  }, [role, enabled, run]);
}

function WorkspaceFrame({ recruiter, nav, navLabel, account, children }: { recruiter: boolean; nav: NavItem[]; navLabel: string; account: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const base = recruiter ? "/recruiter" : "/app";
  const mainClass = pathname === base + "/dashboard" ? "is-feed" : pathname === (recruiter ? "/recruiter/activity" : "/app/updates") ? "is-activity" : "";
  return (
    <div className={recruiter ? "professional-app recruiter-app" : "professional-app"}>
      <header className="professional-header">
        <div className="professional-header-inner">
          <Brand />
          <HeaderSearch role={recruiter ? "recruiter" : "professional"} />
          <WorkspaceNav items={nav} label={navLabel} />
          <div className="professional-header-tools">
            <IconButton icon="bell" label="Notifications" onClick={workspaceDialogs.notifications} />
            {account}
          </div>
        </div>
      </header>
      <main id="main" className={("professional-main " + mainClass).trim()} aria-label={workspaceTitle(pathname)}>
        {children}
      </main>
    </div>
  );
}

const PROFESSIONAL_NAV: [string, string, IconName][] = [
  ["dashboard", "Feed", "home"],
  ["applications", "My Application", "briefcase"],
  ["updates", "My Activity", "pulse"],
  ["projects", "Projects", "folder"],
  ["portfolio", "Portfolio", "layout"],
  ["messages", "Messages", "message"],
];

export function ProfessionalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data } = useServiceQuery(["shell", "professional"], (s) => s.workspace.getProfessionalShell());
  const logout = useLogout();
  const network = useNetworkSheet();
  useWorkspaceRole("professional", pathname.startsWith("/app"));
  const nav = PROFESSIONAL_NAV.map(([slug, label, icon]) => ({ href: "/app/" + slug, label, icon, active: pathname.startsWith("/app/" + slug), unread: slug === "messages" ? data?.unreadConversations : undefined }));
  return (
    <WorkspaceFrame
      recruiter={false}
      nav={nav}
      navLabel="Professional workspace"
      account={
        <AccountMenu person={data?.person}>
          <strong>{data?.person.name}</strong>
          <span>Professional demo account</span>
          <Link href="/app/profile">
            <Icon name="user" />
            Profile
          </Link>
          <Link href="/app/settings">
            <Icon name="settings" />
            Settings & privacy
          </Link>
          <button type="button" onClick={(e) => network.open("professional", e.currentTarget)}>
            <Icon name="users" />
            Manage following
          </button>
          <Link href="/recruiter/dashboard">
            <Icon name="compare" />
            Switch to recruiter
          </Link>
          <Link href="/">
            <Icon name="globe" />
            Back to website
          </Link>
          <button type="button" onClick={logout}>
            <Icon name="logout" />
            Log out
          </button>
        </AccountMenu>
      }
    >
      {children}
    </WorkspaceFrame>
  );
}

const RECRUITER_NAV: [string, string, IconName][] = [
  ["dashboard", "Feed", "home"],
  ["applications", "Job & Responses", "briefcase"],
  ["activity", "My Activity", "pulse"],
  ["messages", "Messages", "message"],
];

const RECRUITER_MENU: [string, string, IconName][] = [
  ["company", "Organization Profile", "building"],
  ["profile", "My Recruiter Profile", "user"],
  ["company?section=team", "Team & Recruiters", "users"],
  ["overview", "Hiring overview", "grid"],
  ["jobs", "Job posts", "briefcase"],
  ["discover", "Discover Talent", "search"],
  ["shortlists", "Shortlists", "bookmark"],
  ["compare", "Compare Candidates", "compare"],
];

export function RecruiterShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data } = useServiceQuery(["shell", "recruiter"], (s) => s.workspace.getRecruiterShell());
  const logout = useLogout();
  const network = useNetworkSheet();
  useWorkspaceRole("recruiter", true);
  const nav = RECRUITER_NAV.map(([slug, label, icon]) => {
    const active = pathname === "/recruiter/" + slug || (slug === "applications" && pathname.startsWith("/recruiter/jobs"));
    return { href: "/recruiter/" + slug, label, icon, active, unread: slug === "messages" ? data?.unreadConversations : undefined };
  });
  return (
    <WorkspaceFrame
      recruiter
      nav={nav}
      navLabel="Recruiter workspace"
      account={
        <AccountMenu person={data?.identity}>
          <strong>{data?.identity.name}</strong>
          <span>
            {data?.title} · {data?.companyName}
          </span>
          {RECRUITER_MENU.map(([slug, label, icon]) => (
            <Link key={slug} href={"/recruiter/" + slug}>
              <Icon name={icon} />
              {label}
            </Link>
          ))}
          <button type="button" onClick={(e) => network.open("recruiter", e.currentTarget)}>
            <Icon name="users" />
            Manage following
          </button>
          <Link href="/app/dashboard">
            <Icon name="compare" />
            Switch to professional
          </Link>
          <Link href="/">
            <Icon name="globe" />
            Back to website
          </Link>
          <button type="button" onClick={logout}>
            <Icon name="logout" />
            Log out
          </button>
        </AccountMenu>
      }
    >
      {children}
    </WorkspaceFrame>
  );
}
