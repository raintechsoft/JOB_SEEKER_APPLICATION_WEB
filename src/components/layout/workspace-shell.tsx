"use client";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { Role } from "@/types/domain";
import { workspaceTitle } from "@/lib/routing/titles";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { Icon, type IconName } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/primitives";
import { NotificationBell } from "@/features/workspace/notification-bell";
import { useNetworkSheet } from "@/features/feed/network-sheet";
import { apiConfig } from "@/services/api/config";
import { RealWorkspace } from "@/features/auth/real-workspace";
import {useCommunicationQuery} from "@/hooks/use-communication-query";
import { clearIdentityState } from "@/features/auth/clear-identity-state";
import { useLogout } from "@/features/auth/use-logout";
import { WorkspaceAccessGate } from "@/features/auth/workspace-access-gate";
import type { Workspace } from "@/services/auth/auth.service";
import { HeaderSearch } from "@/features/search/header-search";
import { HeaderFrame, SidebarAccount, type HeaderNavItem } from "./header-frame";
import { useCompose } from "@/features/feed/feed-parts";

/** Opens the post editor from any workspace page. */
function QuickPostButton({ role }: { role: Role }) {
  const compose = useCompose(role);
  return <button type="button" className="header-quick-post" onClick={() => compose("post")} aria-label="Create a post"><Icon name="plus" /><span>Post</span></button>;
}
import {isApplicationWizardRoute} from "@/features/applications/application-wizard-policy";
import { portfolioUiEnabled } from "@/features/portfolio/portfolio-ui-policy";
import { COMPARE_CANDIDATES_ENABLED, TEAM_WORKSPACE_ACCESS_ENABLED } from "@/lib/feature-flags";
export { HeaderSearch } from "@/features/search/header-search";

type NavItem = HeaderNavItem;

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

function BlockedAccountsAction() {
  const pathname = usePathname();
  return (
    <Link href={pathname.startsWith("/recruiter") ? "/recruiter/settings/privacy" : "/app/settings/privacy"}>
      <Icon name="ban" />
      Blocked accounts
    </Link>
  );
}

function LogoutAction({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}>
      <Icon name="logout" />
      Log out
    </button>
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

/** Mirrors the prototype: entering a workspace URL switches the demo session role. */
function useWorkspaceRole(role: Role, enabled: boolean) {
  const run = useServiceAction();
  useEffect(() => {
    if (enabled && apiConfig.dataSource === "mock") void run((s) => s.workspace.setRole(role), { refresh: false });
  }, [role, enabled, run]);
}

function WorkspaceFrame({ recruiter, nav, navLabel, account, sidebarAccount, children }: { recruiter: boolean; nav: NavItem[]; navLabel: string; account: ReactNode; sidebarAccount: ReactNode; children: ReactNode }) {
  useServiceQuery(["media-policy"], service => service.media.policy!(), {enabled:apiConfig.dataSource==="http",staleTime:Infinity});
  const pathname = usePathname();
  const base = recruiter ? "/recruiter" : "/app";
  const mainClass =
    pathname === base + "/dashboard" || pathname === "/app/jobs" || pathname === "/recruiter/discover" || pathname === "/app/discover"
      ? "is-feed"
      : pathname === (recruiter ? "/recruiter/activity" : "/app/updates")
        ? "is-activity"
        : pathname === base + "/search"
          ? "is-search"
          : pathname === "/recruiter/applications/table"
            ? "is-responses-table"
            : "";
  return (
    <HeaderFrame
      className={[recruiter && "recruiter-app", pathname === base + "/search" && "is-search"].filter(Boolean).join(" ")}
      brandHref={base + "/dashboard"}
      search={<HeaderSearch role={recruiter ? "recruiter" : "professional"} />}
      nav={nav}
      navLabel={navLabel}
      searchHref={base + "/search"}
      tools={<><QuickPostButton role={recruiter ? "recruiter" : "professional"} /><NotificationBell role={recruiter ? "recruiter" : "professional"} />{account}</>}
      sidebarAccount={sidebarAccount}
      mainClass={mainClass}
      mainLabel={workspaceTitle(pathname)}
    >
      {children}
    </HeaderFrame>
  );
}

const PROFESSIONAL_NAV: [string, string, IconName][] = [
  ["dashboard", "Home", "home"],
  ["applications", "Job Tracker", "briefcase"],
  ["updates", "My Activity", "pulse"],
  ["projects", "Projects", "folder"],
  ...(portfolioUiEnabled()
    ? ([["portfolio", "Portfolio", "layout"]] as [string, string, IconName][])
    : []),
  ["messages", "Messages", "message"],
];

function MockProfessionalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data } = useServiceQuery(["shell", "professional"], (s) => s.workspace.getProfessionalShell());
  const {data:unreadCount}=useCommunicationQuery(["messaging-unread","professional"],(s,scope)=>s.messaging.getUnreadCount!("professional",scope),{enabled:apiConfig.dataSource==="http"});
  const email = useAccountEmail(data?.person.email);
  const logout = useLogout();
  const network = useNetworkSheet();
  useWorkspaceRole("professional", pathname.startsWith("/app"));
  const nav = PROFESSIONAL_NAV.map(([slug, label, icon]) => ({ href: "/app/" + slug, label, icon, active: pathname.startsWith("/app/" + slug) || slug === "applications" && isApplicationWizardRoute(pathname), unread: slug === "messages" ? unreadCount??data?.unreadConversations : undefined }));
  const actions = () => (
    <>
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
      <BlockedAccountsAction />
    </>
  );
  return (
    <WorkspaceFrame
      recruiter={false}
      nav={nav}
      navLabel="Professional workspace"
      account={
        <AccountMenu person={data?.person}>
          <strong>{data?.person.name}</strong>
          {email ? <span className="professional-account-email">{email}</span> : null}
          {actions()}
          <LogoutAction onClick={logout} />
        </AccountMenu>
      }
      sidebarAccount={
        <SidebarAccount person={data?.person} email={email}>
          {actions()}
          <LogoutAction onClick={logout} />
        </SidebarAccount>
      }
    >
      {children}
    </WorkspaceFrame>
  );
}

const RECRUITER_NAV: [string, string, IconName][] = [
  ["dashboard", "Home", "home"],
  ["applications", "Job & Responses", "briefcase"],
  ["activity", "My Activity", "pulse"],
  ["messages", "Messages", "message"],
];

const RECRUITER_MENU: [string, string, IconName][] = [
  ["company", "Organization Profile", "building"],
  ["profile", "My Recruiter Profile", "user"],
  ["company?section=team", "Team & Recruiters", "users"],
  ["jobs", "Job posts", "briefcase"],
  ["discover", "Discover Talent", "search"],
  ["shortlists", "Shortlists", "bookmark"],
  ...(COMPARE_CANDIDATES_ENABLED ? ([["compare", "Compare Candidates", "compare"]] as [string, string, IconName][]) : []),
  ["settings", "Settings & privacy", "settings"],
];

function MockRecruiterShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data } = useServiceQuery(["shell", "recruiter"], (s) => s.workspace.getRecruiterShell());
  const {data:unreadCount}=useCommunicationQuery(["messaging-unread","recruiter"],(s,scope)=>s.messaging.getUnreadCount!("recruiter",scope),{enabled:apiConfig.dataSource==="http"});
  const email = useAccountEmail(data?.email);
  const logout = useLogout();
  const network = useNetworkSheet();
  useWorkspaceRole("recruiter", true);
  const nav = RECRUITER_NAV.map(([slug, label, icon]) => {
    const active = pathname === "/recruiter/" + slug || (slug === "applications" && (pathname.startsWith("/recruiter/jobs") || pathname.startsWith("/recruiter/applications")));
    return { href: "/recruiter/" + slug, label, icon, active, unread: slug === "messages" ? unreadCount??data?.unreadConversations : undefined };
  });
  const actions = () => (
    <>
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
      {TEAM_WORKSPACE_ACCESS_ENABLED && apiConfig.dataSource === "http" && <Link href="/recruiter/access">Team and workspace access</Link>}
      <BlockedAccountsAction />
    </>
  );
  return (
    <WorkspaceFrame
      recruiter
      nav={nav}
      navLabel="Recruiter workspace"
      account={
        <AccountMenu person={data?.identity}>
          <strong>{data?.identity.name}</strong>
          {email ? <span className="professional-account-email">{email}</span> : null}
          {actions()}
          <LogoutAction onClick={logout} />
        </AccountMenu>
      }
      sidebarAccount={
        <SidebarAccount person={data?.identity} email={email}>
          {actions()}
          <LogoutAction onClick={logout} />
        </SidebarAccount>
      }
    >
      {children}
    </WorkspaceFrame>
  );
}

export function ProfessionalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!pathname.startsWith("/app/")) return <>{children}</>;
  const connected = isApplicationWizardRoute(pathname) || pathname.startsWith("/app/settings") || ["/app/account", "/app/search", "/app/discover", "/app/messages", "/app/dashboard", "/app/posts/new", "/app/updates", "/app/profile", "/app/projects", "/app/work-pulse", "/app/portfolio", "/app/portfolio/preview", "/app/applications", "/app/jobs"].includes(pathname) || pathname.startsWith("/app/professionals/") || pathname.startsWith("/app/organizations/") || pathname.startsWith("/app/recruiters/");
  if(apiConfig.dataSource === "http") return connected ? <WorkspaceAccessGate role="professional"><MockProfessionalShell>{children}</MockProfessionalShell></WorkspaceAccessGate> : <RealWorkspace role="professional"/>;
  return <MockProfessionalShell>{children}</MockProfessionalShell>;
}

export function RecruiterShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const connected = pathname.startsWith("/recruiter/settings") || pathname.startsWith("/recruiter/applications") || ["/recruiter/access", "/recruiter/search", "/recruiter/messages", "/recruiter/dashboard", "/recruiter/posts/new", "/recruiter/activity", "/recruiter/company", "/recruiter/company/preview", "/recruiter/organization", "/recruiter/profile", "/recruiter/profile/preview", "/recruiter/jobs/new", "/recruiter/jobs", "/recruiter/discover", "/recruiter/shortlists", "/recruiter/compare"].includes(pathname) || pathname.startsWith("/recruiter/team/") || pathname.startsWith("/recruiter/talent/") || pathname.startsWith("/recruiter/organizations/") || pathname.startsWith("/recruiter/recruiters/");
  if(apiConfig.dataSource === "http") return connected ? <WorkspaceAccessGate role="recruiter"><MockRecruiterShell>{children}</MockRecruiterShell></WorkspaceAccessGate> : <RealWorkspace role="recruiter"/>;
  return <MockRecruiterShell>{children}</MockRecruiterShell>;
}
