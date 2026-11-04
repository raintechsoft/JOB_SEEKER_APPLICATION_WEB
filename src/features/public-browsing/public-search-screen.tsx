"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useInfiniteQuery} from "@tanstack/react-query";
import type {MouseEvent} from "react";
import type {z} from "zod";
import {useServices} from "@/hooks/use-services";
import {useHydrated} from "@/hooks/use-hydrated";
import {Avatar,Button,LinkButton} from "@/components/ui/primitives";
import {Icon} from "@/components/ui/icon";
import {LoadingRegion,Skeleton} from "@/components/ui/skeleton";
import {SearchFilterBar,SearchSubFilterBar} from "@/features/search/search-filter-bar";
import {SearchHighlight} from "@/features/search/highlight";
import {useJobActions} from "@/features/feed/job-dialogs";
import {compatibleSearchOptions} from "@/lib/search/capabilities";
import {searchKindScope,searchLabels,type SearchOptions,type SearchScope} from "@/lib/search/scopes";
import {publicSearchScopeSchema,type PublicSearchQuery,type publicSearchResultSchema} from "@/lib/validation/public-browsing";
import {readPublicSearch,publicSearchHref,publicMediaUrl,PUBLIC_QUERY_OPTIONS,type PublicRouteInput,type PublicScope} from "./public-routing";
import {PublicEmpty,PublicFailure,PublicInvalid} from "./public-feedback";
import {PublicFollowButton} from "./public-account-actions";
import {PublicEntryResult} from "./public-feed-screen";

type Result=z.output<typeof publicSearchResultSchema>;
const CATEGORY_PREVIEW=3;
const key=(item:Result)=>`${item.kind}:${item.id}`;

/** Same grid as the signed-in search page: filters, sub-filters and results are siblings. */
export function PublicSearchScreen({input}:{input:PublicRouteInput}){
  const router=useRouter(),parsed=readPublicSearch(input),scopeCheck=publicSearchScopeSchema.safeParse(input.scope??"all"),scope:PublicScope=scopeCheck.success?scopeCheck.data:"all";
  const blank=input.q===undefined&&Object.keys(input).every(name=>name==="scope");
  const category=(next:SearchScope)=>{
    if(!publicSearchScopeSchema.safeParse(next).success)return;
    if(blank){router.push(`/search?scope=${next}`);return;}
    if(!parsed.success)return;
    const {q,scope:oldScope,sort,limit,cursor,selected,...filters}=parsed.data;void cursor;void selected;
    router.push(publicSearchHref({q,scope:next,limit,...compatibleSearchOptions(oldScope,next,{sort,...filters})}));
  };
  return <section className="workspace-search-page public-search-page" aria-label="Search results">
    <SearchFilterBar role="professional" scope={scope} onCategory={category}/>
    {blank?<div className="workspace-search-main"><h1 className="sr-only">Search results</h1><div className="card public-search-start"><Icon name="search"/><h2>Find people, companies and opportunities</h2><p>Use the search at the top to get started.</p></div></div>:!parsed.success?<div className="workspace-search-main"><h1 className="sr-only">Search results</h1><PublicInvalid title="This search link isn’t valid" message="The search words or filters in this link can’t be used. Start a new search from the top of the page." reset="/search" resetLabel="Start a new search"/></div>:<PublicSearchResults key={JSON.stringify(parsed.data)} values={parsed.data}/>}
  </section>;
}

function PublicResultRows({items,query,selected}:{items:Result[];query:string;selected?:string}){
  const jobs=useJobActions();
  // Jobs open the shared side sheet; modified clicks still follow the link.
  const openJob=(item:Result,event:MouseEvent<HTMLAnchorElement>)=>{
    if(item.kind!=="job"||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
    event.preventDefault();jobs.view(item.id,"public-search");
  };
  return <ul className="workspace-search-results">{items.map(item=><li key={key(item)} className={selected===key(item)?"is-selected":undefined}>
    <Link href={item.path} aria-label={item.title} onClick={event=>openJob(item,event)}>
      <span className={`search-result-mark${item.kind==="company"||item.kind==="job"?" is-company":` is-${item.kind}`}`}><Avatar person={{id:item.id,name:item.title,picture:item.picture?publicMediaUrl(item.picture.downloadPath):""}}/></span>
      <span className="header-search-copy"><strong><SearchHighlight text={item.title} query={query}/></strong>{item.subtitle.trim()?<span className="header-search-meta"><SearchHighlight text={item.subtitle} query={query}/></span>:null}</span>
    </Link>
    {(item.kind==="person"||item.kind==="company")&&<span className="header-search-follow-slot"><PublicFollowButton id={item.id} company={item.kind==="company"} name={item.title}/></span>}
  </li>)}</ul>;
}

/** Posts and work updates render as full feed cards, like the signed-in results. */
function PublicResultGroup({items,query,selected}:{items:Result[];query:string;selected?:string}){
  const groups:({post:Result}|{rows:Result[]})[]=[];
  for(const item of items){
    if(item.kind==="post"||item.kind==="update"){groups.push({post:item});continue;}
    const last=groups.at(-1);
    if(last&&"rows"in last)last.rows.push(item);else groups.push({rows:[item]});
  }
  return <>{groups.map(group=>"post"in group?<PublicEntryResult key={key(group.post)} id={group.post.id} compact/>:<PublicResultRows key={key(group.rows[0])} items={group.rows} query={query} selected={selected}/>)}</>;
}

function PublicSearchResults({values}:{values:PublicSearchQuery}){
  const {publicBrowsing}=useServices(),router=useRouter(),hydrated=useHydrated();
  const results=useInfiniteQuery({...PUBLIC_QUERY_OPTIONS,enabled:hydrated,queryKey:["public-browsing","search",values],meta:{searchCategory:values.scope},refetchOnWindowFocus:false,refetchOnReconnect:false,initialPageParam:undefined as string|undefined,queryFn:({pageParam,signal})=>publicBrowsing.search({...values,...(pageParam?{cursor:pageParam}:{})},{signal}),getNextPageParam:page=>page.nextCursor??undefined});
  const {q,scope,sort,limit,cursor,selected,...filters}=values;void cursor;
  const options:SearchOptions={sort,...(selected?{selected}:{}),...filters};
  const apply=(next:SearchOptions)=>{const checked=readPublicSearch({q,scope,limit:String(limit),...Object.fromEntries(Object.entries(next).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)]))});if(!checked.success)return false;router.push(publicSearchHref(checked.data));return true;};
  const items=[...new Map((results.data?.pages.flatMap(page=>page.items)??[]).map(item=>[key(item),item])).values()];
  const chosen=selected?items.find(item=>key(item)===selected):undefined;
  const ordered=chosen?[chosen,...items.filter(item=>item!==chosen)]:items;
  const total=results.data?.pages[0].total;
  const sections=publicSearchScopeSchema.options.filter(name=>name!=="all").map(name=>({scope:name,items:ordered.filter(item=>searchKindScope(item.kind)===name)})).filter(section=>section.items.length);
  return <>
    <SearchSubFilterBar publicMode role="professional" scope={scope} options={options} pending={results.isFetching} onApply={apply}/>
    <div className="workspace-search-main">
      <h1 className="sr-only">Search results</h1>
      <p className="workspace-search-summary" role="status">{searchLabels[scope]} results for “{q}”{total!=null?` · ${total} ${total===1?"match":"matches"}`:""}</p>
      {results.isPending&&<LoadingRegion label="Loading search results"><div className="stack"><Skeleton style={{height:70}}/><Skeleton style={{height:70}}/></div></LoadingRegion>}
      {results.isError&&<PublicFailure key={results.errorUpdatedAt} error={results.error} onRetry={()=>results.refetch()} what="search results" resetHref="/search" resetLabel="Start a new search"/>}
      {results.isSuccess&&!ordered.length&&<PublicEmpty title="No results found" description={<>Nothing matched “{q}”{scope!=="all"?` in ${searchLabels[scope].toLowerCase()}`:""}. Try different words{scope!=="all"?" or search all categories":""}.</>} action={<>{scope!=="all"&&<LinkButton href={publicSearchHref({q,scope:"all"})} variant="primary">Search all categories</LinkButton>}<LinkButton href="/jobs">Browse open jobs</LinkButton><LinkButton href="/">Go to the feed</LinkButton></>}/>}
      <div className="workspace-search-stack">{scope==="all"?sections.map(section=><section key={section.scope} className="workspace-search-category" aria-labelledby={`search-category-${section.scope}`}>
        <h2 id={`search-category-${section.scope}`}>{searchLabels[section.scope]}</h2>
        <PublicResultGroup items={section.items.slice(0,CATEGORY_PREVIEW)} query={q} selected={selected}/>
        <Link href={publicSearchHref({q,scope:section.scope,...compatibleSearchOptions("all",section.scope,{sort,...filters})})} className="workspace-search-show-all">Show all <Icon name="arrow"/></Link>
      </section>):<PublicResultGroup items={ordered} query={q} selected={selected}/>}</div>
      {results.hasNextPage&&<Button disabled={results.isFetchingNextPage} onClick={()=>void results.fetchNextPage()}>Show more results</Button>}
    </div>
  </>;
}
