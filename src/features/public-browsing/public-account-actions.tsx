"use client";

import {useEffect,useRef,useState} from "react";
import {useDismissableDetails} from "@/hooks/use-dismissable";
import {useRouter} from "next/navigation";
import {useQueryClient} from "@tanstack/react-query";
import {useObservedSession} from "@/features/auth/use-observed-session";
import {useAuthAction, type ActionContext} from "@/features/auth/use-auth-action";
import {useServices} from "@/hooks/use-services";
import {FeedActionIcon,Icon} from "@/components/ui/icon";
import type {AuthSession} from "@/services/auth/auth.service";
import type {PublicFeedEntry} from "@/services/public-browsing/public-browsing.service";
import {ApiError} from "@/services/api/client";
import {useShareSheet} from "@/features/feed/share-sheet";
import {workspaceDialogs} from "@/features/workspace/dialogs";
import {useContactCandidate} from "@/features/talent/dialogs";
import {toast} from "@/stores/toast-store";
import {useUiStore} from "@/stores/ui-store";

export const actionActor = (context:ActionContext) => `${context.userId}:${context.identityId}`;

/** Observe resolved account state; public rendering must never start an account query. */
export function useBrowseSession(){
  return useObservedSession();
}
function actorOf(session:AuthSession|null|undefined){return session?`${session.user.id}:${session.selected_identity_id}`:"";}
export function useRefreshPublic(){
  const cache=useQueryClient();
  return ()=>{void cache.invalidateQueries({predicate:query=>["public-browsing","feed","feed-entry","network","feed-comments","organization","candidate","recruiter"].includes(String(query.queryKey[0]))});};
}

export function PublicFollowButton({id,company=false,returnTo,feed=false,name,initialFollowing,onChange}:{id:string;company?:boolean;returnTo?:string;feed?:boolean;name?:string;initialFollowing?:boolean;onChange?:(following:boolean)=>void}){
  const gate=useAuthAction(),services=useServices(),refresh=useRefreshPublic(),session=useBrowseSession();
  const [state,setState]=useState<{actor:string;following:boolean}>();
  const actor=actorOf(session);
  useEffect(()=>{
    if(!session||initialFollowing===undefined)return;
    // Re-seed when the server viewer relationship changes (e.g. block unfollows the account).
    setState({actor:actorOf(session),following:!!initialFollowing});
  },[session,actor,id,initialFollowing]);
  const following=state?.actor===actor?state.following:!!(session&&initialFollowing);
  return <button type="button" className={feed?"feed-follow"+(following?" following":""):"btn text sm public-follow"} aria-label={name?(following?"Unfollow ":"Follow ")+name:undefined} aria-pressed={!!following} aria-haspopup="dialog" onClick={event=>void gate.run(company?"follow_company":"follow_person",async context=>{
    const current=state?.actor===actionActor(context)?state.following:!!initialFollowing;
    const desired=!current;
    const next=await (company?services.feed.toggleFollowCompany(context.role,id,desired):services.feed.toggleFollow(context.role,id,desired));
    setState({actor:actionActor(context),following:next});onChange?.(next);refresh();
  },{anchor:event.currentTarget,returnTo,target:{kind:company?"company":"person",id}})}><Icon name={following?"check":"plus"}/>{following?"Following":"Follow"}</button>;
}

export function usePublicEntryActions({entry,onCounts}:{entry:PublicFeedEntry;onCounts:(likes:number,reposts:number)=>void}){
  const gate=useAuthAction(),services=useServices(),refresh=useRefreshPublic(),session=useBrowseSession();
  const [state,setState]=useState<{actor:string;liked?:boolean;reposted?:boolean;saved?:boolean}>();
  const current=state?.actor===actorOf(session)?state:undefined;
  const interact=(kind:"liked"|"reposted"|"saved",anchor:HTMLElement)=>void gate.run(kind==="liked"?"like":kind==="reposted"?"repost":"save_post",async context=>{
    const source=await services.feed.getEntry(context.role,entry.id);
    if(!source)throw new ApiError("This content is unavailable.",404);
    if(kind==="reposted"&&!source.viewer.canRepost)throw new ApiError("Reposting is unavailable.",403);
    const previous=state?.actor===actionActor(context)?state:undefined;
    // An unresolved button means an explicit positive intent, never an accidental undo.
    const desired=previous?.[kind]===undefined?true:!previous[kind];
    const before={actor:actionActor(context),liked:source.viewer.liked,reposted:source.viewer.reposted,saved:source.viewer.saved};
    setState({...before,[kind]:desired});
    if(kind==="liked")onCounts(source.likes+Number(desired),entry.counts.reposts);
    try{
      const next=kind==="liked"?await services.feed.toggleLike(context.role,entry.id,desired):kind==="reposted"?await services.feed.setReposted(context.role,entry.id,desired):(await services.feed.toggleSave(context.role,entry.id,desired)).saved;
      setState({...before,[kind]:next});
      if(kind==="liked")onCounts(source.likes+Number(next),entry.counts.reposts);
      if(kind==="reposted")toast(next?"Reposted to your feed.":"Repost removed.");
      refresh();
    }catch(error){setState(before);onCounts(source.likes+Number(source.viewer.liked),entry.counts.reposts);throw error;}
  },{anchor,target:{kind:"entry",id:entry.id}});
  const saveJob=(anchor:HTMLElement)=>void gate.run("save_job",async context=>{
    const job=await services.jobs.getJob(entry.job!.id,context.role);
    if(!job||!services.jobs.toggleSave)throw new ApiError("This job is unavailable.",404);
    const desired=state?.actor===actionActor(context)&&state.saved!==undefined?!state.saved:true;
    const result=job.saved===desired?{saved:job.saved}:await services.jobs.toggleSave(entry.job!.id);
    setState({actor:actionActor(context),saved:result.saved});refresh();
  },{anchor,target:{kind:"job",id:entry.job!.id}});
  return {current,interact,saveJob};
}
export type PublicEntryActionState=ReturnType<typeof usePublicEntryActions>;

/** Card menu in the header tools, matching the signed-in card's activity menu. */
export function PublicEntryMenu({entry,actions}:{entry:PublicFeedEntry;actions:PublicEntryActionState}){
  const menu=useRef<HTMLDetailsElement>(null);
  useDismissableDetails(menu,{closeOnAction:true});
  const {current}=actions;
  return <details ref={menu} className="activity-post-menu public-entry-menu"><summary aria-label="More post actions"><Icon name="more"/></summary><div className="activity-post-menu-items">
    <button type="button" aria-pressed={!!current?.saved} aria-haspopup="dialog" onClick={event=>entry.kind==="job"?actions.saveJob(event.currentTarget):actions.interact("saved",event.currentTarget)}><Icon name="bookmark"/>{current?.saved?"Saved":"Save"}</button>
  </div></details>;
}

/** Like, Comment, Share, Repost: the signed-in card's action bar order and icons. */
export function PublicEntryActions({entry,actions,commentsOpen,onReadComments,onShare}:{entry:PublicFeedEntry;actions:PublicEntryActionState;commentsOpen:boolean;onReadComments:()=>void;onShare:(anchor:HTMLElement)=>void}){
  const {current,interact}=actions,comments=entry.counts.comments,job=entry.kind==="job";
  return <div className="feed-post-actions">
    <button type="button" className={current?.liked?"is-liked":""} aria-pressed={!!current?.liked} aria-haspopup="dialog" onClick={event=>interact("liked",event.currentTarget)}><FeedActionIcon name="like"/><span className="feed-action-label">Like</span></button>
    <button type="button" onClick={onReadComments} aria-expanded={commentsOpen}><FeedActionIcon name="comment"/><span className="feed-action-label">Comment{comments>0?` ${comments}`:""}</span></button>
    <button type="button" aria-haspopup="dialog" onClick={event=>onShare(event.currentTarget)}><FeedActionIcon name="share"/><span className="feed-action-label">Share</span></button>
    <button type="button" className={current?.reposted?"is-reposted":""} disabled={job} aria-pressed={!!current?.reposted} aria-haspopup={job?undefined:"dialog"} title={job?"Job listings cannot be reposted.":"Repost to your feed"} onClick={event=>interact("reposted",event.currentTarget)}><FeedActionIcon name="repost"/><span className="feed-action-label">{current?.reposted?"Reposted":"Repost"}</span></button>
  </div>;
}

export function PublicFollowersShare({entryId}:{entryId:string}){
  const share=useShareSheet();
  return <button type="button" className="btn sm" aria-haspopup="dialog" onClick={()=>share.open(undefined,entryId)}>Share with followers</button>;
}

export function PublicMessageButton({id}:{id:string}){
  const contact=useContactCandidate();
  return <button className="btn primary sm" type="button" aria-haspopup="dialog" onClick={()=>void contact(id)}><Icon name="message"/>Message</button>;
}

export function PublicApplicationsButton(){
  const gate=useAuthAction(),router=useRouter();
  return <button className="btn" type="button" aria-haspopup="dialog" onClick={event=>void gate.run("view_applications",()=>router.push("/app/applications"),{anchor:event.currentTarget})}>Your applications</button>;
}

export function PublicPersonalActions(){
  const gate=useAuthAction(),router=useRouter();
  return <nav className="public-personal-actions" aria-label="Your activity">{([
    ["create_post","Create post","edit","/posts/new"],
    ["view_following","Following","users","/dashboard"],
    ["view_saved","Saved","bookmark","/dashboard?view=saved"],
    ["view_applications","Your applications","briefcase","/applications"],
    ["view_messages","Messages","message","/messages"],
    ["view_notifications","Notifications","bell",""],
    ["view_settings","Settings","settings","/settings"],
    ["post_job","Post a job","plus","/jobs/new"],
  ] as const).map(([action,label,icon,path])=><button key={action} className="btn text" type="button" aria-haspopup="dialog" onClick={event=>void gate.run(action,context=>{
    if(action==="view_notifications"){workspaceDialogs.notifications();return;}
    if(action==="view_following")useUiStore.getState().setFeed({filter:"following",query:"",visible:12});
    router.push((context.role==="recruiter"?"/recruiter":"/app")+path);
  },{anchor:event.currentTarget})}><Icon name={icon}/>{label}</button>)}</nav>;
}
