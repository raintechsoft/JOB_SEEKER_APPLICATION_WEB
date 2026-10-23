"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import {apiConfig} from "@/services/api/config";
import {ApiError} from "@/services/api/client";
import { toast } from "@/stores/toast-store";
import { Icon, type IconName } from "@/components/ui/icon";
import { Avatar, Brand, IconButton } from "@/components/ui/primitives";
import { workspaceDialogs } from "@/features/workspace/dialogs";

const NAV: [string, string, IconName][] = [
  ["dashboard", "Overview", "grid"],
  ["users", "Users", "users"],
  ["companies", "Companies", "building"],
  ["moderation", "Moderation", "shield"],
];

const ADMIN = { name: "Admin Demo" };

/** The prototype's legacy sidebar workspace, used only by the optional admin demo. */
function AdminFrame({ children,adminName=ADMIN.name }: { children: ReactNode;adminName?:string }) {
  const pathname = usePathname();
  const router = useRouter();
  const run = useServiceAction();
  // The mobile sidebar belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const page = pathname.split("/")[2] || "dashboard";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const logout = async () => {
    const ok=await run(async(s)=>{await s.workspace.signOut();return true;});if(!ok)return;
    router.push("/");
    toast(apiConfig.dataSource==="http"?"You’ve signed out.":"You’ve left the demo workspace. Local changes are kept.");
  };
  return (
    <div className="workspace">
      <aside className={"sidebar" + (open ? " open" : "")} id="sidebar">
        <Brand />
        <div className="workspace-label">Administration</div>
        <nav className="side-nav">
          {NAV.map(([slug, label, icon]) => (
            <Link key={slug} href={"/admin/" + slug} className={pathname.startsWith("/admin/" + slug) ? "active" : ""}>
              <Icon name={icon} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="side-promo">
            <Icon name="spark" />
            <h4>Your work tells a story.</h4>
            <p>Turn your everyday progress into your next opportunity.</p>
            <Link href="/app/portfolio">
              Build your portfolio <Icon name="arrow" />
            </Link>
          </div>
          <nav className="side-nav">
            <Link href="/">
              <Icon name="globe" />
              Back to website
            </Link>
            <Link href="/recruiter/dashboard">
              <Icon name="compare" />
              Switch to recruiter
            </Link>
          </nav>
          <div className="account">
            <Avatar person={{name:adminName}} />
            <div>
              <strong>{adminName}</strong>
              <small>Administration</small>
            </div>
            <IconButton icon="logout" label="Log out" onClick={logout} />
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <IconButton icon="menu" label="Open workspace menu" extra="mobile-nav-toggle" onClick={() => setOpenOn(open ? null : pathname)} />
          <div className="crumb">
            Workspace <Icon name="chevron" /> <strong>{page[0].toUpperCase() + page.slice(1)}</strong>
          </div>
          <div className="top-actions">
            <button type="button" className="row search-mini" onClick={workspaceDialogs.globalSearch}>
              <Icon name="search" />
              Search anything... <span className="key">⌘ K</span>
            </button>
            {apiConfig.dataSource==="mock"&&<span className="demo">DEMO WORKSPACE</span>}
            <IconButton icon="bell" label="Notifications" onClick={workspaceDialogs.notifications} />
            <Avatar person={{name:adminName}} />
          </div>
        </header>
        <main id="main" className="page">
          {children}
        </main>
      </div>
    </div>
  );
}

function RealAdminGate({children}:{children:ReactNode}){const router=useRouter();const session=useServiceQuery(["admin","session"],(s)=>s.admin.session!());useEffect(()=>{if(session.error instanceof ApiError&&session.error.status===401)router.replace("/login?next=/admin/dashboard");},[session.error,router]);if(session.isPending)return <p role="status">Loading administration…</p>;if(session.isError||!session.data)return <div className="card"><h1>Administrator access required</h1><p>This account does not have access to platform administration.</p><Link href="/">Back to Skillora</Link></div>;return <AdminFrame adminName={session.data.name}>{children}</AdminFrame>;}
export function AdminShell({children}:{children:ReactNode}){return apiConfig.dataSource==="http"?<RealAdminGate>{children}</RealAdminGate>:<AdminFrame>{children}</AdminFrame>;}
