"use client";
import Link from "next/link";
import {useRef} from "react";
import {useLivePublicFeed} from "@/hooks/use-live-feed";
import {useRouter} from "next/navigation";
import {useDismissableDetails} from "@/hooks/use-dismissable";
import {Icon, type IconName} from "@/components/ui/icon";
import {useQuery} from "@tanstack/react-query";
import {useServices} from "@/hooks/use-services";
import {useHydrated} from "@/hooks/use-hydrated";
import {FeedSkeleton,CardSkeleton,LoadingRegion} from "@/components/ui/skeleton";
import {PublicGuestColumn,PublicJobsRail} from "./public-feed-columns";
import {NewPostsButton} from "@/features/feed/feed-parts";
import {Button, LinkButton} from "@/components/ui/primitives";
import {useBrowseSession} from "./public-account-actions";
import {authDestination} from "@/features/auth/auth-navigation";
import {PublicEmpty,PublicFailure,PublicInvalid} from "./public-feedback";
import {PublicEntryCard} from "./public-entry-card";
import {readPublicFeed,readPublicEntry,PUBLIC_QUERY_OPTIONS,type PublicRouteInput} from "./public-routing";
import type {PublicFeedQuery} from "@/lib/validation/public-browsing";

const tabs=[['all','All'],['posts','Posts'],['jobs','Jobs'],['updates','Work updates']] as const;
const filterIcon=(value:(typeof tabs)[number][0]):IconName=>value==="jobs"?"briefcase":value==="updates"?"pulse":"spark";
function PublicFeedToolbar({filter,jobs}:{filter:(typeof tabs)[number][0];jobs:boolean}){
  const router=useRouter(),menu=useRef<HTMLDetailsElement>(null);
  useDismissableDetails(menu,{closeOnAction:true});
  const select=(value:(typeof tabs)[number][0])=>router.push(value==="all"?"/":value==="jobs"&&jobs?"/jobs":`/?filter=${value}`);
  return <div className="feed-toolbar">
    <div className="feed-filter-tabs" role="tablist" aria-label="Feed filters">{tabs.map(([value,label])=><button type="button" key={value} role="tab" aria-selected={filter===value} className={filter===value?"active":""} onClick={()=>select(value)}>{value==="jobs"&&<Icon name="briefcase"/>}{label}</button>)}</div>
    <span className="public-feed-sort"><Icon name="clock"/>Latest first</span>
    <details ref={menu} className={"feed-filter-menu"+(filter!=="all"?" has-filter":"")}>
      <summary className="iconbtn" aria-label="Feed filters"><Icon name="more"/></summary>
      <div className="feed-filter-list" role="group" aria-label="Feed filters">{tabs.map(([value,label])=><Button key={value} variant="text sm" icon={filterIcon(value)} aria-pressed={filter===value} className={filter===value?"active":undefined} onClick={()=>select(value)}>{label}</Button>)}</div>
    </details>
  </div>;
}
/** Same three-column geometry and toolbar as the signed-in feed. */
export function PublicFeedScreen({input,jobs=false}:{input:PublicRouteInput;jobs?:boolean}){
  const parsed=readPublicFeed(jobs?{...input,filter:input.filter??"jobs"}:input);
  const filter=parsed.success?parsed.data.filter:"all";
  return <div className="professional-feed-layout public-feed-layout"><PublicGuestColumn/><section className="feed-timeline" aria-label={jobs?"Open opportunities":"Public community feed"}>
    <h1 className="sr-only">{jobs?"Open opportunities":"Community feed"}</h1>
    <PublicFeedToolbar filter={filter} jobs={jobs}/>
    {!parsed.success||jobs&&parsed.data.filter!=="jobs"?<PublicInvalid title="These filters aren’t valid" reset={jobs?"/jobs":"/"}/>:<PublicFeedResults key={JSON.stringify(parsed.data)} query={parsed.data}/>}
  </section><PublicJobsRail/></div>;
}
function PublicFeedResults({query}:{query:PublicFeedQuery}){
  const feed=useLivePublicFeed(query);
  const items=[...new Map((feed.data?.pages.flatMap(page=>page.items)??[]).map(entry=>[entry.id,entry])).values()];
  const jobsOnly=query.filter==="jobs";
  if(feed.isError)return <PublicFailure key={feed.errorUpdatedAt} error={feed.error} onRetry={()=>feed.refetch()} what={jobsOnly?"open opportunities":"the feed"} resetHref={jobsOnly?"/jobs":"/"} resetLabel={jobsOnly?"Back to jobs":"Back to feed"}/>;
  if(feed.isPending)return <div style={{minHeight:feed.placeholderHeight}}><FeedSkeleton/></div>;
  return <><NewPostsButton show={!!feed.newPosts} onShow={feed.showNewPosts}/><div id="feed-post-list" className="feed-post-list public-feed-results" data-live-feed aria-busy={feed.isFetchingNextPage}>{items.map(entry=><PublicEntryCard key={entry.id} entry={entry}/>)}{!items.length&&<PublicFeedEmpty filter={query.filter}/>}{feed.hasNextPage?<div className="feed-load-more"><button className="btn" type="button" disabled={feed.isFetchingNextPage} onClick={()=>{void feed.fetchNextPage();}}><Icon name="down"/>See more posts</button></div>:items.length?<div className="feed-end">You’re all caught up for now.</div>:null}</div></>;
}
const FEED_EMPTY={
  all:{icon:"users",title:"No posts yet",description:"Nothing has been shared publicly yet. Check back soon or browse open jobs."},
  posts:{icon:"users",title:"No posts yet",description:"No public posts have been shared yet. Try work updates or open jobs."},
  jobs:{icon:"briefcase",title:"No open opportunities yet",description:"There are no open roles right now. Check back soon or see what people are sharing."},
  updates:{icon:"pulse",title:"No work updates yet",description:"No public work updates have been shared yet. Try posts or open jobs."},
} as const;
/** Empty feed tab: points to the other public tabs instead of a dead end. */
function PublicFeedEmpty({filter}:{filter:PublicFeedQuery["filter"]}){
  const copy=FEED_EMPTY[filter];
  const action=filter==="jobs"?<LinkButton href="/" variant="primary">Browse the feed</LinkButton>:<>{filter!=="all"&&<LinkButton href="/">See all posts</LinkButton>}<LinkButton href="/jobs" variant="primary">Browse open jobs</LinkButton></>;
  return <PublicEmpty icon={copy.icon} title={copy.title} description={copy.description} action={action}/>;
}
export function PublicEntryScreen({id,input}:{id:string;input:PublicRouteInput}){
  const values=readPublicEntry(id,input);
  return <div className="professional-feed-layout public-feed-layout"><PublicGuestColumn/><section className="feed-timeline" aria-label="Public post"><div className="public-entry-toolbar"><Link href="/" className="public-back-link">Back to feed</Link>{values?<PublicEntryWorkspaceLink id={values.id}/>:null}</div>{values?<PublicEntryResult key={id} id={values.id} focus={values.comments.focus}/>:<PublicInvalid title="This post link isn’t valid" message="Check the link, or head back to the feed to keep browsing." resetLabel="Back to feed"/>}</section><PublicJobsRail/></div>;
}
/** A verified, signed-in viewer opens the same entry highlighted inside their own workspace feed. */
function PublicEntryWorkspaceLink({id}:{id:string}){
  const session=useBrowseSession();
  if(!session||!session.user.email_verified)return null;
  return <LinkButton href={`${authDestination(session)}?post=${encodeURIComponent(id)}`} variant="primary sm" icon="external">Open in your workspace</LinkButton>;
}
export function PublicEntryResult({id,focus,compact}:{id:string;focus?:string;compact?:boolean}){
  const {publicBrowsing}=useServices(),hydrated=useHydrated();
  const entry=useQuery({...PUBLIC_QUERY_OPTIONS,refetchOnWindowFocus:false,refetchOnReconnect:false,enabled:hydrated,queryKey:["public-browsing","entry",id],queryFn:({signal})=>publicBrowsing.entry(id,{signal})});
  if(entry.isError)return <PublicFailure key={entry.errorUpdatedAt} error={entry.error} onRetry={()=>entry.refetch()} compact={compact} what="this post" resetLabel="Back to feed"/>;
  if(entry.isPending)return <LoadingRegion label="Loading post"><CardSkeleton/></LoadingRegion>;
  return <PublicEntryCard entry={entry.data} details focus={focus}/>;
}
