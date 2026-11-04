"use client";
import Link from "next/link";
import {useState} from "react";
import {usePathname,useSearchParams} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {useServices} from "@/hooks/use-services";
import {useHydrated} from "@/hooks/use-hydrated";
import {Icon} from "@/components/ui/icon";
import {LinkButton} from "@/components/ui/primitives";
import {CompanyAvatar} from "@/components/jobs/job-visuals";
import {VerifiedCompanyMark} from "@/components/organization/controls";
import {LoadingRegion,TextSkeleton} from "@/components/ui/skeleton";
import {EmptyPanel,ErrorState} from "@/components/ui/state-views";
import {postedAgo} from "@/lib/utils/date";
import {authDestination} from "@/features/auth/auth-navigation";
import {useJobActions} from "@/features/feed/job-dialogs";
import {useBrowseSession} from "./public-account-actions";
import {publicMediaUrl,PUBLIC_QUERY_OPTIONS} from "./public-routing";

const EXPLORE=[["/","home","Latest feed"],["/jobs","briefcase","Open jobs"],["/search?scope=people","users","People"],["/search?scope=companies","building","Companies"]] as const;

/** Guest counterpart of the profile column: what Skillora is, how to join, and where to explore. */
export function PublicGuestColumn(){
  const session=useBrowseSession(),pathname=usePathname(),params=useSearchParams();
  const here=(href:string)=>{const [path,query]=href.split("?");return path===pathname&&(query??"")===(params?.toString()??"");};
  return <aside className="feed-profile-column public-guest-column" aria-label="Explore Skillora">
    <section className="card public-guest-welcome">
      <span className="public-guest-mark" aria-hidden="true"><Icon name="spark"/></span>
      <h2>{session?"Welcome back":"Welcome to Skillora"}</h2>
      <p>Show your work, follow the people and companies you admire, and find your next opportunity.</p>
      {session?<LinkButton href={authDestination(session)} variant="primary">{session.user.email_verified?"Go to your workspace":"Verify your account"}</LinkButton>:<div className="public-guest-cta"><LinkButton href="/signup" variant="primary">Create account</LinkButton><LinkButton href="/login">Sign in</LinkButton></div>}
      {!session&&<small>Sign in to post, apply, follow and message.</small>}
    </section>
    <nav className="card public-guest-explore" aria-label="Explore">
      <h2>Explore</h2>
      {EXPLORE.map(([href,icon,label])=><Link key={href} href={href} aria-current={here(href)?"page":undefined}><Icon name={icon}/>{label}</Link>)}
    </nav>
  </aside>;
}

/** Guest counterpart of the jobs rail: newest open roles, opened in the shared job side sheet. */
export function PublicJobsRail(){
  const {publicBrowsing}=useServices(),hydrated=useHydrated(),jobs=useJobActions(),[open,setOpen]=useState(false);
  const latest=useQuery({...PUBLIC_QUERY_OPTIONS,enabled:hydrated,queryKey:["public-browsing","feed",{filter:"jobs",rail:true}],queryFn:({signal})=>publicBrowsing.feed({filter:"jobs",limit:5},{signal})});
  const items=(latest.data?.items??[]).filter(entry=>entry.job?.acceptingApplications).slice(0,5);
  return <aside className={"feed-jobs-column public-jobs-rail"+(open?" show-jobs":"")} aria-label="Open opportunities">
    <button type="button" className="jobs-mobile-toggle" onClick={()=>setOpen(value=>!value)} aria-expanded={open}><span><Icon name="briefcase"/>Latest jobs{items.length>0&&<b>{items.length} open</b>}</span><Icon name={open?"up":"down"}/></button>
    <div className="jobs-rail-content">
      <section className="card relevant-jobs-card">
        <header className="rail-heading"><span className="eyebrow">OPEN OPPORTUNITIES</span><h2>Latest jobs</h2><p>Fresh roles from hiring teams on Skillora.</p></header>
        <div className="rail-job-list">
          {latest.isPending&&<LoadingRegion label="Loading latest jobs"><TextSkeleton lines={4}/></LoadingRegion>}
          {latest.isError&&<ErrorState compact error={latest.error} onRetry={()=>latest.refetch()} title="Jobs couldn’t load" description="Something interrupted the request. Please try again." homeHref="/jobs" homeLabel="See all jobs"/>}
          {latest.isSuccess&&!items.length&&<EmptyPanel compact icon="briefcase" title="No open roles right now" description="New roles appear here as soon as hiring teams publish them." action={<LinkButton href="/">Browse the feed</LinkButton>}/>}
          {items.map(entry=>{const job=entry.job!,company=entry.company,logo=company?.logo?publicMediaUrl(company.logo.downloadPath):undefined;return <article className="rail-job" key={entry.id}>
            <div className="rail-job-company"><CompanyAvatar company={{id:company?.id??entry.id,name:company?.name??"Company",logoUrl:logo,confidential:company?.confidential,verified:company?.verified}}/><div><span className="rail-job-company-name">{company?.name??"Company"}<VerifiedCompanyMark company={company}/></span><small>{postedAgo(entry.publishedAt)}</small></div></div>
            <button type="button" className="rail-job-title" onClick={()=>jobs.view(job.id,"public-jobs-rail")}>{job.title} <Icon name="arrowUp"/></button>
            {(job.location.trim()||job.arrangement)&&<p>{job.location.trim()&&<Icon name="location"/>}{[job.location.trim(),job.arrangement].filter(Boolean).join(" · ")}</p>}
            <div className="rail-job-tags">{job.employment&&<span>{job.employment}</span>}<span>{job.compensationLabel}</span></div>
            <div className="rail-job-actions"><button type="button" onClick={()=>jobs.view(job.id,"public-jobs-rail")}>View opportunity <Icon name="arrow"/></button></div>
          </article>;})}
        </div>
        <Link href="/jobs" className="rail-manage-alerts">See all jobs <Icon name="arrow"/></Link>
      </section>
    </div>
  </aside>;
}
