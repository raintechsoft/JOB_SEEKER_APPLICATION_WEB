"use client";

import { usePathname } from "next/navigation";
import { useServiceQuery } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { LinkButton } from "@/components/ui/primitives";
import {apiConfig} from "@/services/api/config";
import {RealNotificationsSheet} from "./notifications-sheet";

function PrivacyInfo() {
  if(apiConfig.dataSource==="http")return <div className="stack"><p>Your account data is stored securely by Skillora. Profile, portfolio and individual work visibility determine what others can see.</p><p>Private conversations and files are available to their authorized participants. Notification channels can be changed in Notifications. Optional external analytics and recommendations are introduced only in their documented advanced phases.</p><LinkButton href="/app/settings">Privacy settings</LinkButton></div>;
  return (
    <div className="stack">
      <p className="small muted">Skillora is a frontend prototype. Changes are saved in this browser’s local storage. All people, companies, conversations, and project examples are fictional.</p>
      <p className="small muted">There is no production account system, CV extraction service, messaging delivery, analytics tracking, or secure portfolio access enforcement. Local visibility settings demonstrate the intended experience.</p>
      <p className="small muted">To clear local changes, open Settings in the professional workspace and choose Reset demo data. Do not enter sensitive personal information or real passwords.</p>
      <LinkButton href="/app/settings" variant="primary" icon="settings">
        Open demo settings
      </LinkButton>
    </div>
  );
}

function DemoNotificationsSheet() {
  const pathname = usePathname();
  const recruiter = pathname.startsWith("/recruiter");
  const { data: settings } = useServiceQuery(["settings"], (s) => s.workspace.getSettings());
  if (!settings) return null;
  const enabled = settings.notifications;
  return (
    <div className="notifications-empty">
      <div className="notifications-illustration" aria-hidden="true">
        <svg viewBox="0 0 160 150" fill="none">
          <circle cx="83" cy="24" r="9" stroke="currentColor" strokeWidth="2.5" />
          <path d="M46 95c13-10 11-21 13-35 3-21 39-30 51-7 8 15 0 28 10 41l9 10c-5 14-77 20-91 2l8-11Z" fill="#f1eeff" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M71 53c-7 5-10 13-10 22M27 91c-8 10-9 19-1 26M139 104c5 10 3 17-4 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="83" cy="108" rx="43" ry="10" fill="currentColor" />
          <circle cx="83" cy="117" r="17" fill="#6550f5" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="88" cy="112" r="6" fill="white" />
        </svg>
      </div>
      <h3>{enabled ? "You’re all caught up" : "Notifications are turned off"}</h3>
      <p>{enabled ? "New job matches, application updates, and activity from your network will appear here. Explore your next opportunity while you wait." : "Turn on notifications in Settings to keep up with opportunities and your professional community."}</p>
      <LinkButton href={enabled ? (recruiter ? "/recruiter/discover" : "/app/dashboard?view=jobs") : "/app/settings"} variant="primary">
        {enabled ? (recruiter ? "Explore talent" : "Explore recommended jobs") : "Open settings"}
      </LinkButton>
    </div>
  );
}

const SEARCH_LINKS: [string, string][] = [
  ["Profile", "/app/profile"],
  ["Projects", "/app/projects"],
  ["Portfolio builder", "/app/portfolio"],
  ["Talent discovery", "/recruiter/discover"],
  ["Shortlists", "/recruiter/shortlists"],
  ["Messages", "/app/messages"],
];

function GlobalSearch() {
  return (
    <div className="stack">
      {SEARCH_LINKS.map(([t, p]) => (
        <LinkButton key={p} href={p} icon="arrow">
          {t}
        </LinkButton>
      ))}
    </div>
  );
}

export const workspaceDialogs = {
  privacy: () => modal.show("Your work. Your data. Your browser.", <PrivacyInfo />),
    notifications: () => modal.show("Notifications", apiConfig.dataSource==="http"?<RealNotificationsSheet/>:<DemoNotificationsSheet/>, "sheet"),
  globalSearch: () => modal.show("Find your way around.", <GlobalSearch />),
};
