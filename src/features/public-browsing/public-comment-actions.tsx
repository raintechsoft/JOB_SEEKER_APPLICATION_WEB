"use client";

import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import type {z} from "zod";
import type {publicCommentSchema} from "@/lib/validation/public-browsing";
import {commentSchema} from "@/lib/validation/social";
import {useAuthAction,type ActionContext} from "@/features/auth/use-auth-action";
import {useServices} from "@/hooks/use-services";
import {useDismissableDetails} from "@/hooks/use-dismissable";
import {Icon} from "@/components/ui/icon";
import {toast} from "@/stores/toast-store";
import {publicShareUrl} from "./public-routing";
import {actionActor,PublicFollowButton,useBrowseSession,useRefreshPublic} from "./public-account-actions";

type Comment=z.output<typeof publicCommentSchema>;
export function PublicCommentComposer({entryId,parentId}:{entryId:string;parentId?:string}){
  const gate=useAuthAction(),services=useServices(),refresh=useRefreshPublic(),session=useBrowseSession();
  const [actor,setActor]=useState(""),[text,setText]=useState(""),[error,setError]=useState(""),[pending,setPending]=useState(false);
  const lock=useRef(false),input=useRef<HTMLTextAreaElement>(null);
  const open=!!session?.user.email_verified&&actor===`${session.user.id}:${session.selected_identity_id}`;
  return <div className="public-comment-composer">{open?<form noValidate onSubmit={async event=>{
    event.preventDefault();setError("");
    const value=commentSchema.safeParse(text);
    if(!value.success){setError(value.error.issues[0].message);input.current?.focus();return;}
    if(lock.current)return;lock.current=true;setPending(true);
    try{await gate.run(parentId?"reply":"comment",async context=>{
      if(actionActor(context)!==actor)return;
      await services.feed.addComment(context.role,entryId,value.data,parentId);
      setText("");refresh();toast(parentId?"Reply added.":"Comment added.");
    },{anchor:input.current,returnTo:`/feed/${entryId}${parentId?`?comment=${parentId}#comment-${parentId}`:""}`,target:{kind:parentId?"comment":"entry",id:parentId??entryId}});}finally{lock.current=false;setPending(false);}
  }}><label htmlFor={`public-comment-input-${parentId??entryId}`} className="sr-only">{parentId?"Your reply":"Your comment"}</label><textarea ref={input} id={`public-comment-input-${parentId??entryId}`} value={text} onChange={event=>setText(event.target.value)} placeholder={parentId?"Write a reply":"Write a comment"} maxLength={1000} aria-invalid={!!error} aria-describedby={error?`comment-error-${parentId??entryId}`:undefined} disabled={pending}/>{error&&<p id={`comment-error-${parentId??entryId}`} className="error" role="alert">{error}</p>}<button className="btn primary sm" type="submit" disabled={pending}>{parentId?"Reply":"Post comment"}</button></form>:<button className="btn text sm" type="button" aria-haspopup="dialog" onClick={event=>void gate.run(parentId?"reply":"comment",context=>{setActor(actionActor(context));setText("");requestAnimationFrame(()=>input.current?.focus());},{anchor:event.currentTarget,returnTo:`/feed/${entryId}${parentId?`?comment=${parentId}#comment-${parentId}`:""}`,target:{kind:parentId?"comment":"entry",id:parentId??entryId}})}><Icon name="message"/>{parentId?"Reply":"Write a comment"}</button>}</div>;
}

export function PublicCommentMenu({comment}:{comment:Comment}){
  const gate=useAuthAction(),services=useServices(),router=useRouter(),ref=useRef<HTMLDetailsElement>(null);
  useDismissableDetails(ref,{closeOnAction:true});
  // Public pages offer no block/report actions; those stay inside the signed-in workspace.
  const run=(action:"message"|"copy_link",anchor:HTMLElement,allowed:(context:ActionContext)=>unknown)=>void gate.run(action,allowed,{anchor,returnTo:`/feed/${comment.entryId}?comment=${comment.id}#comment-${comment.id}`,target:{kind:"comment",id:comment.id}});
  return <details ref={ref} className="activity-post-menu feed-comment-menu"><summary aria-label={`Comment actions for ${comment.author.name}`}><Icon name="more"/></summary><div className="activity-post-menu-items">
    <button type="button" className="btn text sm" onClick={event=>run("message",event.currentTarget,async context=>{const id=await services.messaging.start(context.role,comment.author.id,{anyCompany:true});if(!id)throw new Error("Messaging unavailable.");router.push((context.role==="recruiter"?"/recruiter/messages":"/app/messages")+"?conversation="+encodeURIComponent(id));})}>Message {comment.author.name}</button>
    <button type="button" className="btn text sm" aria-haspopup="dialog" onClick={event=>run("copy_link",event.currentTarget,async()=>{try{const url=new URL(publicShareUrl(`/feed/${comment.entryId}`,window.location.origin));url.searchParams.set("comment",comment.id);url.hash=`comment-${comment.id}`;await navigator.clipboard.writeText(url.toString());toast("Comment link copied.");}catch{toast("The link could not be copied.","error");}})}>Copy link to comment</button>
    <PublicFollowButton id={comment.author.id}/>
  </div></details>;
}
