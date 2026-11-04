"use client";
import {useEffect,useId,useRef,useState} from "react";
import {usePathname,useRouter,useSearchParams} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {useServices} from "@/hooks/use-services";
import {Icon} from "@/components/ui/icon";
import {Avatar} from "@/components/ui/primitives";
import {Skeleton} from "@/components/ui/skeleton";
import {EmptyPanel,ErrorState} from "@/components/ui/state-views";
import {SearchScopeBadges} from "@/features/search/scope-badges";
import {searchLabels,searchKindScope} from "@/lib/search/scopes";
import {publicSearchQuerySchema} from "@/lib/validation/public-browsing";
import {publicMediaUrl,publicSearchHref,PUBLIC_QUERY_OPTIONS,type PublicScope} from "./public-routing";
import type {z} from "zod";
import type {publicSearchResultSchema} from "@/lib/validation/public-browsing";

type Result=z.output<typeof publicSearchResultSchema>;
// Anonymous searches remain in this mounted tab only; no browser storage or history endpoint.
let recentTerms:string[]=[];
export function PublicHeaderSearch(){
  const params=useSearchParams(),pathname=usePathname();
  const parsed=publicSearchQuerySchema.shape.scope.safeParse(params.get("scope")??(pathname==="/jobs"?"jobs":"all"));
  const q=pathname==="/search"?params.get("q")??"":"";
  return <PublicSearchInput key={`${pathname}:${params.toString()}`} initialQuery={q} initialScope={parsed.success?parsed.data:"all"}/>;
}
export function PublicSearchFallback(){return <form className="professional-search header-search header-search-badge" id="feed-search-form" action="/search" role="search" data-no-floating-label><Icon name="search"/><input aria-label="Search Skillora" placeholder="Search Skillora" name="q" minLength={2} maxLength={200} autoComplete="off"/></form>;}

function PublicSearchInput({initialQuery,initialScope}:{initialQuery:string;initialScope:PublicScope}){
  const {publicBrowsing}=useServices(),router=useRouter(),id=useId(),root=useRef<HTMLFormElement>(null),input=useRef<HTMLInputElement>(null);
  const [value,setValue]=useState(initialQuery),[scope,setScope]=useState(initialScope),[debounced,setDebounced]=useState(""),[open,setOpen]=useState(false),[composing,setComposing]=useState(false),[active,setActive]=useState(-1),[error,setError]=useState(""),[recent,setRecent]=useState(recentTerms);
  const pointerInside=useRef(false),parsed=publicSearchQuerySchema.safeParse({q:value,scope,limit:8}),term=parsed.success?parsed.data.q:value.trim();
  useEffect(()=>{if(composing)return;const timer=setTimeout(()=>setDebounced(value.trim().replace(/\s+/gu," ")),300);return()=>clearTimeout(timer);},[value,composing]);
  useEffect(()=>{const close=(event:PointerEvent)=>{pointerInside.current=!!root.current?.contains(event.target as Node);if(!pointerInside.current){setOpen(false);setActive(-1);}};document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close);},[]);
  const ready=parsed.success&&debounced===term&&!composing;
  const result=useQuery({...PUBLIC_QUERY_OPTIONS,queryKey:["public-browsing","header",scope,debounced],meta:{searchCategory:scope},refetchOnReconnect:false,queryFn:({signal})=>publicBrowsing.search({q:debounced,scope,limit:8},{signal}),enabled:open&&ready,refetchOnWindowFocus:false});
  const items=ready&&!result.isError?result.data?.items??[]:[];
  const count=term?items.length:recent.length;
  useEffect(()=>{if(open&&active>=0&&active<count)document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({block:"nearest"});},[id,open,active,count]);
  const submit=(query:string,selected?:Result,remember=false)=>{
    const category=selected?searchKindScope(selected.kind) as PublicScope:scope;
    const checked=publicSearchQuerySchema.safeParse({q:query,scope:category,...(selected?{selected:`${selected.kind}:${selected.id}`}:{})});
    if(!checked.success){setError(checked.error.issues[0].message);return;}
    if(remember){recentTerms=[checked.data.q,...recentTerms.filter(item=>item!==checked.data.q)].slice(0,5);setRecent(recentTerms);}
    setOpen(false);setActive(-1);setError("");router.push(publicSearchHref(checked.data));
  };
  return <form ref={root} className={`professional-search header-search header-search-badge${value?" has-query":""}${open||value?" is-expanded":""}`} id="feed-search-form" role="search" data-no-floating-label noValidate onSubmit={event=>{event.preventDefault();if(!composing)submit(value,undefined,true);}} onPointerDownCapture={()=>{pointerInside.current=true;}} onBlur={event=>{if(event.currentTarget.contains(event.relatedTarget as Node|null)||(!event.relatedTarget&&pointerInside.current))return;setOpen(false);setActive(-1);}}>
    <Icon name="search"/>
    <input ref={input} id={`${id}-input`} type="search" role="combobox" aria-label="Search Skillora" placeholder="Search people, companies and jobs" maxLength={200} value={value} autoComplete="off" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open} aria-controls={open?`${id}-list`:undefined} aria-activedescendant={open&&active>=0&&active<count?`${id}-option-${active}`:undefined} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} onFocus={()=>{setRecent(recentTerms);setOpen(true);}} onClick={()=>setOpen(true)} onChange={event=>{setValue(event.target.value);setActive(-1);setError("");setOpen(true);}} onCompositionStart={()=>setComposing(true)} onCompositionEnd={()=>setComposing(false)} onKeyDown={event=>{if(composing||event.nativeEvent.isComposing)return;if(event.key==="Escape"){event.preventDefault();setOpen(false);setActive(-1);}else if(["ArrowDown","ArrowUp"].includes(event.key)){event.preventDefault();setOpen(true);setActive(index=>count?(index<0?(event.key==="ArrowDown"?0:count-1):(index+(event.key==="ArrowDown"?1:-1)+count)%count):-1);}else if(event.key==="Enter"&&open&&active>=0&&active<count){event.preventDefault();if(term)submit(value,items[active]);else submit(recent[active]);}}}/>
    {open&&<div className="header-search-dropdown">
      <SearchScopeBadges role="professional" value={scope} onChange={next=>{setScope(next as PublicScope);setActive(-1);input.current?.focus();}}/>
      <div id={`${id}-list`} role="listbox" aria-label="Public search suggestions" className="public-search-options">
        {!term&&<><h3>Recent searches</h3>{recent.length?recent.map((query,index)=><button type="button" role="option" key={query} id={`${id}-option-${index}`} aria-selected={active===index} onClick={()=>submit(query)}><Icon name="clock"/><span>{query}</span></button>):<p className="muted small">Your searches will appear here in this tab.</p>}</>}
        {!!term&&!parsed.success&&<p className="small">{parsed.error.issues[0].message}</p>}
        {!!term&&parsed.success&&(!ready||result.isPending)&&<div aria-label="Searching public content" role="status"><Skeleton/><Skeleton/><Skeleton/></div>}
        {!!term&&ready&&result.isError&&<ErrorState compact error={result.error} onRetry={()=>result.refetch()} title="Suggestions couldn’t load" description="Something interrupted the search. Please try again."/>}
        {items.map((item,index)=><button type="button" role="option" id={`${id}-option-${index}`} aria-selected={active===index} key={`${item.kind}:${item.id}`} onClick={()=>submit(value,item)}><Avatar person={{id:item.id,name:item.title,picture:item.picture?publicMediaUrl(item.picture.downloadPath):""}}/><span><strong>{item.title}</strong><small>{searchLabels[searchKindScope(item.kind)??"all"]}{item.subtitle?` · ${item.subtitle}`:""}</small></span></button>)}
        {!!term&&ready&&result.isSuccess&&!items.length&&<EmptyPanel compact icon="search" title="No matches yet" description={<>Nothing matched “{term}”{scope!=="all"?` in ${searchLabels[scope].toLowerCase()}`:""}. Try different words or see all results.</>}/>}
      </div>
      {!!term&&parsed.success&&<button type="button" className="header-search-all" onClick={()=>submit(value)}>See all results</button>}
    </div>}
    {error&&<p className="header-search-error" id={`${id}-error`} role="alert">{error}</p>}
  </form>;
}
