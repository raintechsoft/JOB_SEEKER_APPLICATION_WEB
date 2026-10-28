"use client";
import { BlockedAccounts } from "@/features/settings/blocked-accounts";
import { modal } from "@/stores/modal-store";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { Role } from "@/types/domain";
import { devCopy } from "@/lib/env/app-env";
import { workspaceTitle } from "@/lib/routing/titles";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { useNavigationDock } from "@/hooks/use-navigation-dock";
import { toast } from "@/stores/toast-store";
import { Icon, type IconName } from "@/components/ui/icon";
import { Avatar, Brand } from "@/components/ui/primitives";
import { NotificationBell } from "@/features/workspace/notification-bell";
import { useNetworkSheet } from "@/features/feed/network-sheet";
import { apiConfig } from "@/services/api/config";
import { RealWorkspace } from "@/features/auth/real-workspace";
import { RealtimeBridge, useLiveInterval } from "@/features/messaging/realtime-bridge";
import { clearIdentityState } from "@/features/auth/clear-identity-state";
import { WorkspaceAccessGate } from "@/features/auth/workspace-access-gate";
import type { Workspace } from "@/services/auth/auth.service";
import { HeaderSearch } from "@/features/search/header-search";
export { HeaderSearch } from "@/features/search/header-search";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
  unread?: number;
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
      <div className="professional-account-menu">{children}<button type="button" onClick={() => { if (ref.current) ref.current.open = false; modal.show("Blocked accounts", <BlockedAccounts role={pathname.startsWith("/recruiter") ? "recruiter" : "professional"} />); }}><Icon name="ban" />Blocked accounts</button></div>
    </details>
  );
}

function useAccountEmail(fallback?: string) {
  const session = useServiceQuery(["auth", "session"], (s) => s.auth.me(), { enabled: apiConfig.dataSource === "http" });
  return session.data?.user.email || fallback || "";
}

function WorkspaceSwitch({ kind }: { kind: Role }) {
  const router = useRouter();
  const cache = useQueryClient();
  const { auth } = useServices();
  const session = useServiceQuery(["auth", "session"], (s) => s.auth.me(), { enabled: apiConfig.dataSource === "http" });
  const href = kind === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard";
  const label = kind === "recruiter" ? "Switch to recruiter" : "Switch to professional";
  if (apiConfig.dataSource !== "http") {
    return (
      <Link href={href}>
        <Icon name="compare" />
        {label}
      </Link>
    );
  }
  const workspace = session.data?.workspaces.find((item: Workspace) => item.kind === kind);
  if (!workspace) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        const next = await auth.selectWorkspace(workspace.id);
        clearIdentityState();
        cache.clear();
        cache.setQueryData(["auth", "session"], next);
        router.push(href);
      }}
    >
      <Icon name="compare" />
      {label}
    </button>
  );
}

function useLogout() {
  const run = useServiceAction();
  const router = useRouter();
  const cache = useQueryClient();
  const services = useServices();
  return async () => {
    if (apiConfig.dataSource === "http") { await services.auth.logout(); clearIdentityState(); cache.clear(); router.push("/login"); return; }
    await run((s) => s.workspace.signOut());
    router.push("/");
    toast(devCopy("You’ve left the demo workspace. Local changes are kept.", "You’ve signed out."));
  };
}

/** Mirrors the prototype: entering a workspace URL switches the demo session role. */
function useWorkspaceRole(role: Role, enabled: boolean) {
  const run = useServiceAction();
  useEffect(() => {
    if (enabled && apiConfig.dataSource === "mock") void run((s) => s.workspace.setRole(role), { refresh: false });
  }, [role, enabled, run]);
}

function WorkspaceFrame({ recruiter, nav, navLabel, account, children }: { recruiter: boolean; nav: NavItem[]; navLabel: string; account: ReactNode; children: ReactNode }) {
  useServiceQuery(["media-policy"], service => service.media.policy!(), {enabled:apiConfig.dataSource==="http",staleTime:Infinity});
  const pathname = usePathname();
  const base = recruiter ? "/recruiter" : "/app";
  const mainClass = pathname === base + "/dashboard" || pathname === "/app/jobs" || pathname === "/recruiter/discover" || pathname === "/app/discover" ? "is-feed" : pathname === (recruiter ? "/recruiter/activity" : "/app/updates") ? "is-activity" : pathname === base + "/search" ? "is-search" : "";
  return (
    <div className={`${recruiter ? "professional-app recruiter-app" : "professional-app"}${pathname === base + "/search" ? " is-search" : ""}`}>
      <header className="professional-header">
        <div className="professional-header-inner">
          <Brand href={base + "/dashboard"} />
          <HeaderSearch role={recruiter ? "recruiter" : "professional"} />
          <WorkspaceNav items={nav} label={navLabel} />
          <div className="professional-header-tools">
            <Link href={base + "/search"} className="mobile-workspace-search iconbtn" aria-label="Search Skillora"><Icon name="search" /></Link>
            <NotificationBell role={recruiter ? "recruiter" : "professional"} />
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
  ["applications", "Job Tracker", "briefcase"],
  ["updates", "My Activity", "pulse"],
  ["projects", "Projects", "folder"],
  ["portfolio", "Portfolio", "layout"],
  ["messages", "Messages", "message"],
];

function MockProfessionalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data } = useServiceQuery(["shell", "professional"], (s) => s.workspace.getProfessionalShell());
  const {data:unreadCount}=useServiceQuery(["messaging-unread","professional"],(s)=>s.messaging.getUnreadCount!("professional"),{enabled:apiConfig.dataSource==="http",refetchInterval:useLiveInterval(10000)});
  const email = useAccountEmail(data?.person.email);
  const logout = useLogout();
  const network = useNetworkSheet();
  useWorkspaceRole("professional", pathname.startsWith("/app"));
  const nav = PROFESSIONAL_NAV.map(([slug, label, icon]) => ({ href: "/app/" + slug, label, icon, active: pathname.startsWith("/app/" + slug), unread: slug === "messages" ? unreadCount??data?.unreadConversations : undefined }));
  return (
    <WorkspaceFrame
      recruiter={false}
      nav={nav}
      navLabel="Professional workspace"
      account={
        <AccountMenu person={data?.person}>
          <strong>{data?.person.name}</strong>
          {email ? <span className="professional-account-email">{email}</span> : null}
          <Link href="/app/profile">
            <Icon name="user" />
            Profile
          </Link>
          <Link href="/app/discover">
            <Icon name="search" />
            Discover people
          </Link>
          <Link href="/app/settings">
            <Icon name="settings" />
            Settings & privacy
          </Link>
          <button type="button" onClick={(e) => network.open("professional", e.currentTarget)}>
            <Icon name="users" />
            Manage following
          </button>
          <WorkspaceSwitch kind="recruiter" />
          {apiConfig.dataSource === "http" && <Link href="/app/account">Account and workspace access</Link>}
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
      <RealtimeBridge />
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
  ["settings", "Settings & privacy", "settings"],
];

function MockRecruiterShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data } = useServiceQuery(["shell", "recruiter"], (s) => s.workspace.getRecruiterShell());
  const {data:unreadCount}=useServiceQuery(["messaging-unread","recruiter"],(s)=>s.messaging.getUnreadCount!("recruiter"),{enabled:apiConfig.dataSource==="http",refetchInterval:useLiveInterval(10000)});
  const email = useAccountEmail(data?.email);
  const logout = useLogout();
  const network = useNetworkSheet();
  useWorkspaceRole("recruiter", true);
  const nav = RECRUITER_NAV.map(([slug, label, icon]) => {
    const active = pathname === "/recruiter/" + slug || (slug === "applications" && pathname.startsWith("/recruiter/jobs"));
    return { href: "/recruiter/" + slug, label, icon, active, unread: slug === "messages" ? unreadCount??data?.unreadConversations : undefined };
  });
  return (
    <WorkspaceFrame
      recruiter
      nav={nav}
      navLabel="Recruiter workspace"
      account={
        <AccountMenu person={data?.identity}>
          <strong>{data?.identity.name}</strong>
          {email ? <span className="professional-account-email">{email}</span> : null}
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
          <WorkspaceSwitch kind="professional" />
          {apiConfig.dataSource === "http" && <Link href="/recruiter/access">Team and workspace access</Link>}
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
      <RealtimeBridge />
      {children}
    </WorkspaceFrame>
  );
}

export function ProfessionalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!pathname.startsWith("/app/")) return <>{children}</>;
  const connected = ["/app/search", "/app/discover", "/app/messages", "/app/settings", "/app/dashboard", "/app/posts/new", "/app/updates", "/app/profile", "/app/projects", "/app/work-pulse", "/app/portfolio", "/app/portfolio/preview", "/app/applications", "/app/jobs"].includes(pathname) || pathname.startsWith("/app/professionals/") || pathname.startsWith("/app/organizations/") || pathname.startsWith("/app/recruiters/");
  if(apiConfig.dataSource === "http") return connected ? <WorkspaceAccessGate role="professional"><MockProfessionalShell>{children}</MockProfessionalShell></WorkspaceAccessGate> : <RealWorkspace role="professional"/>;
  return <MockProfessionalShell>{children}</MockProfessionalShell>;
}

export function RecruiterShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const connected = ["/recruiter/search", "/recruiter/messages", "/recruiter/settings", "/recruiter/dashboard", "/recruiter/posts/new", "/recruiter/activity", "/recruiter/company", "/recruiter/company/preview", "/recruiter/organization", "/recruiter/profile", "/recruiter/profile/preview", "/recruiter/jobs/new", "/recruiter/jobs", "/recruiter/applications", "/recruiter/discover", "/recruiter/shortlists", "/recruiter/compare", "/recruiter/overview"].includes(pathname) || pathname.startsWith("/recruiter/team/") || pathname.startsWith("/recruiter/talent/") || pathname.startsWith("/recruiter/organizations/") || pathname.startsWith("/recruiter/recruiters/");
  if(apiConfig.dataSource === "http") return connected ? <WorkspaceAccessGate role="recruiter"><MockRecruiterShell>{children}</MockRecruiterShell></WorkspaceAccessGate> : <RealWorkspace role="recruiter"/>;
  return <MockRecruiterShell>{children}</MockRecruiterShell>;
}
