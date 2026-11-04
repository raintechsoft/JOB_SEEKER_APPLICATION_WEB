"use client";
import {Suspense,type ReactNode} from "react";
import {usePathname} from "next/navigation";
import Link from "next/link";
import {Icon} from "@/components/ui/icon";
import {LinkButton} from "@/components/ui/primitives";
import {HeaderFrame,SidebarAccount,type HeaderNavItem} from "@/components/layout/header-frame";
import {authDestination} from "@/features/auth/auth-navigation";
import {useLogout} from "@/features/auth/use-logout";
import {PublicHeaderSearch,PublicSearchFallback} from "./public-header-search";
import "./public-browsing.css";
import {useBrowseSession} from "./public-account-actions";

/** Observe an already resolved session without starting account, count or network requests. */
function BrowseAccountLink(){
  const session=useBrowseSession();
  return <span className="header-desktop-account">{session?<LinkButton href={authDestination(session)} variant="primary sm">{session.user.email_verified?"Your workspace":"Verify account"}</LinkButton>:<LinkButton href="/login" variant="primary sm">Sign in</LinkButton>}</span>;
}

function BrowseSidebarGuest(){
  const session=useBrowseSession();
  if(session)return null;
  return <>
    <LinkButton href="/login" variant="sm">Login</LinkButton>
    <LinkButton href="/signup" variant="primary sm">Create account</LinkButton>
  </>;
}

function BrowseSidebarAccount(){
  const session=useBrowseSession();
  const logout=useLogout();
  if(!session)return null;
  return <SidebarAccount person={{id:session.user.id,name:session.user.name}} email={session.user.email}>
    <Link href={authDestination(session)}>
      <Icon name="arrow"/>
      {session.user.email_verified?"Your workspace":"Verify account"}
    </Link>
    <button type="button" onClick={logout}><Icon name="logout"/>Log out</button>
  </SidebarAccount>;
}

const NAV=[["/","home","Home"],["/jobs","briefcase","Jobs"]] as const;
/** Guest content inside the same header frame the workspaces use. */
export function BrowseShell({children}:{children:ReactNode}){
  const pathname=usePathname(),search=pathname==="/search";
  const session=useBrowseSession();
  const active=(href:string)=>href==="/"?pathname==="/"||pathname.startsWith("/feed"):pathname.startsWith("/jobs");
  const nav:HeaderNavItem[]=NAV.map(([href,icon,label])=>({href,icon,label,active:active(href)}));
  return <HeaderFrame className={`public-browse${search?" is-search":""}`} brandHref="/" search={<Suspense fallback={<PublicSearchFallback/>}><PublicHeaderSearch/></Suspense>} nav={nav} navLabel="Public navigation" searchHref="/search" tools={<BrowseAccountLink/>} sidebarGuest={session?undefined:<BrowseSidebarGuest/>} sidebarAccount={session?<BrowseSidebarAccount/>:undefined} mainClass={`public-browse-main ${search?"is-search":"is-feed"}`}>{children}</HeaderFrame>;
}
