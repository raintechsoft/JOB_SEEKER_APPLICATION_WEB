"use client";
import Link from "next/link";
import {useEffect,useId,useMemo,useRef,useState} from "react";
import {useInfiniteQuery} from "@tanstack/react-query";
import type {z} from "zod";
import type {publicCommentSchema} from "@/lib/validation/public-browsing";
import type {PublicFeedEntry} from "@/services/public-browsing/public-browsing.service";
import {useServices} from "@/hooks/use-services";
import {useHydrated} from "@/hooks/use-hydrated";
import {Avatar,Badge,Button} from "@/components/ui/primitives";
import {FeedActionIcon,Icon} from "@/components/ui/icon";
import {CompanyAvatar} from "@/components/jobs/job-visuals";
import {VerifiedCompanyMark} from "@/components/organization/controls";
import {useJobActions} from "@/features/feed/job-dialogs";
import {useAuthAction} from "@/features/auth/use-auth-action";
import {PostCarousel} from "@/components/feed/post-carousel";
import {LinkifiedText} from "@/components/feed/link-preview-card";
import {LoadingRegion,TextSkeleton} from "@/components/ui/skeleton";
import {modal} from "@/stores/modal-store";
import {timeAgo} from "@/lib/utils/date";
import {publicEntryMedia,publicMediaUrl,publicShareUrl,PUBLIC_QUERY_OPTIONS} from "./public-routing";
import {EmptyPanel} from "@/components/ui/state-views";
import {PublicFailure} from "./public-feedback";
import {PublicEntryActions,PublicEntryMenu,PublicFollowButton,PublicFollowersShare,usePublicEntryActions} from "./public-account-actions";
import {PublicCommentComposer,PublicCommentMenu} from "./public-comment-actions";

type Comment=z.output<typeof publicCommentSchema>;
export function PublicShareControls({path,entryId}:{path:string;entryId?:string}){
  const input=useRef<HTMLInputElement>(null),lock=useRef(false),[message,setMessage]=useState(""),[copied,setCopied]=useState(false),id=useId();
  const url=typeof window==="undefined"?"":publicShareUrl(path,window.location.origin);
  const copy=async()=>{if(lock.current)return;lock.current=true;setCopied(false);setMessage("");try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(url);setCopied(true);}catch{input.current?.focus();input.current?.select();setMessage("Select and copy the link.");}finally{lock.current=false;}};
  const share=async()=>{if(lock.current)return;setMessage("");if(!navigator.share){setMessage("System sharing isn’t available here. Copy the link instead.");return;}lock.current=true;try{await navigator.share({title:"On Skillora",url});}catch(error){if(!(error instanceof DOMException&&error.name==="AbortError")&&!(typeof error==="object"&&error&&"name"in error&&error.name==="AbortError"))setMessage("System sharing couldn’t open. Copy the link instead.");}finally{lock.current=false;}};
  return <section className="post-share-destinations public-share-controls" aria-label="Share link" data-no-floating-label><h3>Share link</h3><div className="post-share-controls"><div className="post-share-copy"><label className="sr-only" htmlFor={id}>Post link</label><input ref={input} id={id} value={url} readOnly onFocus={event=>event.currentTarget.select()}/><button type="button" onClick={()=>{void copy();}}>{copied?"Copied":"Copy"}</button></div><button type="button" className="post-share-more" onClick={()=>{void share();}} aria-label="More sharing options"><Icon name="more"/><span>More</span></button></div>{message&&<p role="status">{message}</p>}{entryId&&<PublicFollowersShare entryId={entryId}/>}</section>;
}
function PublicComment({comment,highlighted}:{comment:Comment;highlighted:boolean}){
  return <article id={`comment-${comment.id}`} className={`feed-comment${comment.parentId?" is-reply":""}${highlighted?" is-highlighted":""}`} aria-current={highlighted?"true":undefined}><Link href={comment.author.profilePath}><Avatar person={{id:comment.author.id,name:comment.author.name,picture:comment.author.picture?publicMediaUrl(comment.author.picture.downloadPath):""}}/></Link><div className="feed-comment-main"><div className="feed-comment-head"><div className="feed-comment-identity"><strong><Link href={comment.author.profilePath}>{comment.author.name}</Link></strong>{comment.author.headline&&<p className="feed-comment-byline">{comment.author.headline}</p>}</div><time dateTime={comment.createdAt}>{timeAgo(comment.createdAt)}</time><PublicCommentMenu comment={comment}/></div>{comment.pinned&&<span className="feed-comment-pinned"><Icon name="pin"/>Pinned</span>}<p className="feed-comment-text">{comment.text}</p>{!comment.parentId&&<PublicCommentComposer entryId={comment.entryId} parentId={comment.id}/>}</div></article>;
}
export function PublicComments({entryId,focus}:{entryId:string;focus?:string}){
  const {publicBrowsing}=useServices(),hydrated=useHydrated();
  const comments=useInfiniteQuery({...PUBLIC_QUERY_OPTIONS,refetchOnWindowFocus:false,refetchOnReconnect:false,enabled:hydrated,queryKey:["public-browsing","comments",entryId,focus??null],initialPageParam:undefined as string|undefined,queryFn:({pageParam,signal})=>publicBrowsing.comments(entryId,{...(focus?{focus}:{}),...(pageParam?{cursor:pageParam}:{})},{signal}),getNextPageParam:page=>page.nextCursor??undefined});
  const items=useMemo(()=>[...new Map((comments.data?.pages.flatMap(page=>page.items)??[]).map(item=>[item.id,item])).values()],[comments.data]);
  const scrolled=useRef<string|null>(null);
  useEffect(()=>{if(focus&&scrolled.current!==focus&&items.some(item=>item.id===focus)){scrolled.current=focus;document.getElementById(`comment-${focus}`)?.scrollIntoView?.({block:"center",behavior:"instant"});}},[focus,items]);
  return <section className="public-comments" aria-label="Comments"><h3>Comments</h3>{comments.isError?<PublicFailure key={comments.errorUpdatedAt} error={comments.error} onRetry={()=>comments.refetch()} compact what="comments" resetLabel="Back to feed"/>:comments.isPending?<LoadingRegion label="Loading comments"><TextSkeleton lines={2}/></LoadingRegion>:<>{items.length?items.map(comment=><PublicComment key={comment.id} comment={comment} highlighted={comment.id===focus}/>):<EmptyPanel compact icon="message" title="No comments yet" description="Be the first to share your thoughts."/>}{comments.hasNextPage&&<button type="button" className="btn sm" disabled={comments.isFetchingNextPage} onClick={()=>{void comments.fetchNextPage();}}>More comments</button>}</>}<PublicCommentComposer entryId={entryId}/></section>;
}
/** Same structure and classes as the signed-in FeedCard, fed by the public projection. */
export function PublicEntryCard({entry,details=false,focus}:{entry:PublicFeedEntry;details?:boolean;focus?:string}){
  const [expanded,setExpanded]=useState(details),[commentsOpen,setCommentsOpen]=useState(details),[counts,setCounts]=useState<{source:PublicFeedEntry;likes:number;reposts:number}>(),commentsId=useId();
  const jobs=useJobActions(),gate=useAuthAction();
  const actions=usePublicEntryActions({entry,onCounts:(likes,reposts)=>setCounts({source:entry,likes,reposts})});
  const job=entry.kind==="job"&&entry.job?entry.job:null;
  const name=entry.author?.name??entry.company?.name??"Skillora",picture=entry.author?.picture??entry.company?.logo;
  const href=entry.author?.profilePath??entry.company?.profilePath,media=publicEntryMedia(entry),followId=entry.author?.id??entry.company?.id;
  const pictureUrl=picture?publicMediaUrl(picture.downloadPath):"";
  const avatar=job?<CompanyAvatar company={{id:entry.company?.id??entry.id,name,logoUrl:pictureUrl||undefined,confidential:entry.company?.confidential}}/>:<Avatar person={{id:entry.author?.id??entry.company?.id??entry.id,name,picture:pictureUrl}}/>;
  const long=entry.body.length>420&&!expanded,text=long?entry.body.slice(0,420):entry.body;
  const likes=counts?.source===entry?counts.likes:entry.counts.likes,comments=entry.counts.comments;
  const toggleComments=()=>{
    setCommentsOpen(open=>!open);
    if(commentsOpen)return;
    // Bring the opened comments into view once they render.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const smooth=!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(commentsId)?.scrollIntoView?.({behavior:smooth?"smooth":"auto",block:"start"});
    }));
  };
  const contextLine=job?"An opportunity to do meaningful work":entry.kind==="update"?"Work update":"From the community";
  return <article className={`card feed-post public-entry-card${job?" feed-job-post":""}`} id={`feed-${entry.id}`} data-public-entry={entry.id}>
    <div className="feed-post-context"><Icon name={job?"briefcase":entry.kind==="update"?"pulse":"users"}/><span>{contextLine}</span></div>
    <header className="feed-post-header">
      <div className="row">{href?<Link href={href} aria-label={`View ${name} profile`}>{avatar}</Link>:avatar}<div className="grow"><h2><span className="feed-org-name">{href?<Link href={href}>{name}</Link>:name}{job?<VerifiedCompanyMark company={entry.company}/>:null}</span></h2>{entry.author?.headline&&<p className="feed-post-byline" title={entry.author.headline}>{entry.author.headline}</p>}<p className="feed-post-meta"><Link href={entry.path}><time dateTime={entry.publishedAt} title={entry.publishedAt}>{timeAgo(entry.publishedAt)}</time></Link></p></div></div>
      <div className="feed-post-header-tools">{followId&&<PublicFollowButton feed id={followId} name={name} company={!entry.author} returnTo={href??undefined}/>}<PublicEntryMenu entry={entry} actions={actions}/></div>
    </header>
    <div className="feed-post-body">{!job&&entry.title.trim()?<h3><Link href={entry.path}>{entry.title}</Link></h3>:null}{text?<p className="public-entry-text">{job?text:<LinkifiedText text={text}/>}{long&&<>…{" "}<button className="feed-read-more" type="button" onClick={()=>setExpanded(true)}>see more</button></>}</p>:null}</div>
    {!!media.length&&<PostCarousel id={`public-${entry.id}`} items={media}/>}
    {job&&<div className="feed-job-summary">
      <div className="row between wrap"><div><h3><button type="button" className="public-job-title" onClick={()=>jobs.view(job.id,"public-feed")}>{job.title}</button></h3>{(job.location.trim()||job.arrangement)&&<p>{job.location.trim()&&<><Icon name="location"/>{job.location}</>}{job.location.trim()&&job.arrangement&&<b>·</b>}{job.arrangement}</p>}</div>{job.employment&&<Badge tone="purple">{job.employment}</Badge>}</div>
      <div className="row between wrap feed-job-bottom"><div><strong>{job.compensationLabel}</strong><span className="feed-job-pay-note">{job.acceptingApplications?"Salary range":"Applications closed"}</span></div><Button variant={job.acceptingApplications?"primary":""} icon="arrowUp" onClick={()=>jobs.view(job.id,"public-feed")}>View opportunity</Button></div>
    </div>}
    <div className="feed-social-counts"><button type="button" aria-haspopup="dialog" aria-label="Like post" onClick={event=>actions.interact("liked",event.currentTarget)}><span className="reaction-dot"><FeedActionIcon name="like"/></span>{likes}</button><button type="button" onClick={toggleComments} aria-expanded={commentsOpen} aria-controls={commentsId}>{comments} {comments===1?"comment":"comments"}</button></div>
    <PublicEntryActions entry={entry} actions={actions} commentsOpen={commentsOpen} onReadComments={toggleComments} onShare={anchor=>void gate.run("copy_link",()=>modal.show("Share",<PublicShareControls path={entry.path} entryId={entry.id}/>,"sheet"),{anchor,target:{kind:"entry",id:entry.id}})}/>
    {commentsOpen&&<div id={commentsId} className="public-comments-region"><PublicComments entryId={entry.id} focus={focus}/></div>}
  </article>;
}
