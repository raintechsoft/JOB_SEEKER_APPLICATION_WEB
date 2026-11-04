"use client";
import {useEffect,useId,useLayoutEffect,useRef,useState,type ButtonHTMLAttributes,type ReactNode} from "react";
import {createPortal} from "react-dom";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useQueryClient} from "@tanstack/react-query";
import {useServices} from "@/hooks/use-services";
import {guestPrompt,type GuestAction} from "@/lib/domain/guest-access";
import {Icon} from "@/components/ui/icon";
import {authDestination} from "./auth-navigation";
import {clearIdentityState} from "./clear-identity-state";
import {useAuthActionStore,closeAuthAction,type ActionRequest} from "./auth-action-store";
import {useAuthAction,type ActionContext} from "./use-auth-action";
import {authEntryHref} from "./auth-continuation";
import "./auth-action.css";

export function AuthActionButton({action,onAllowed,children,...props}:Omit<ButtonHTMLAttributes<HTMLButtonElement>,"onClick">&{action:GuestAction;onAllowed:(context:ActionContext)=>unknown;children:ReactNode}){
  const gate=useAuthAction();
  return <button {...props} type={props.type??"button"} aria-haspopup="dialog" onClick={event=>{void gate.run(action,onAllowed,{anchor:event.currentTarget});}}>{children}</button>;
}
export function AuthActionHost(){
  const request=useAuthActionStore(state=>state.request),path=usePathname(),previous=useRef(path);
  useEffect(()=>{if(previous.current!==path){previous.current=path;closeAuthAction();}},[path]);
  useEffect(()=>{if(!request)return;const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();closeAuthAction(true);}};document.addEventListener("keydown",escape,true);return()=>document.removeEventListener("keydown",escape,true);},[request]);
  return request&&request.decision!=="pending"?<ActionPopover key={request.id} request={request}/>:null;
}
function ActionPopover({request}:{request:ActionRequest}){
  const panel=useRef<HTMLDivElement>(null),id=useId(),services=useServices(),cache=useQueryClient();
  const [position,setPosition]=useState({left:12,top:100,width:300}),[now,setNow]=useState(Date.now),[switching,setSwitching]=useState(false),[switchError,setSwitchError]=useState("");
  const copy=guestPrompt(request.action),remaining=Math.max(0,Math.ceil(((request.retryAt??0)-now)/1000));
  useEffect(()=>{if(!remaining)return;const timer=setTimeout(()=>setNow(Date.now()),1000);return()=>clearTimeout(timer);},[remaining]);
  const portal=request.anchor?.closest('dialog[open]')??document.body;
  useLayoutEffect(()=>{
    const place=()=>{
      const view=window.visualViewport,width=Math.min(320,(view?.width??innerWidth)-24),height=panel.current?.offsetHeight??190,leftEdge=view?.offsetLeft??0,topEdge=view?.offsetTop??0,bottom=topEdge+(view?.height??innerHeight);
      const fresh=request.anchor?.getClientRects().length?request.anchor.getBoundingClientRect():request.rect;
      const left=Math.max(leftEdge+12,Math.min(fresh.left,leftEdge+(view?.width??innerWidth)-width-12));
      const below=fresh.bottom+10,top=below+height<=bottom-12?below:Math.max(topEdge+12,Math.min(fresh.top-height-10,bottom-height-12));
      setPosition(current=>current.left===left&&current.top===top&&current.width===width?current:{left,top,width});
    };
    place();const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(place);if(panel.current)observer?.observe(panel.current);window.addEventListener("resize",place);window.addEventListener("scroll",place,true);window.visualViewport?.addEventListener("resize",place);window.visualViewport?.addEventListener("scroll",place);
    panel.current?.querySelector<HTMLElement>('a,button:not([aria-label="Close account prompt"])')?.focus();
    return()=>{observer?.disconnect();window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);window.visualViewport?.removeEventListener("resize",place);window.visualViewport?.removeEventListener("scroll",place);};
  },[request]);
  useEffect(()=>{const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!request.anchor?.contains(event.target as Node))closeAuthAction();};document.addEventListener("pointerdown",outside,true);return()=>document.removeEventListener("pointerdown",outside,true);},[request]);
  const required=request.workspace??"professional";
  const messages={sign_in:copy?.message??"Sign in to continue.",verify_email:"Verify your email address before using this action.",switch_workspace:`Switch to your ${required==="recruiter"?"recruiter":"job seeker"} workspace to continue.`,workspace_required:`A ${required==="recruiter"?"recruiter":"job seeker"} workspace is needed for this action.`,choose_workspace:"Choose an available workspace before continuing.",unavailable:"Something interrupted the request. Please try again.",denied:"You don’t have permission to perform this action.",hidden:"This action is unavailable.",pending:"",allow:""};
  const title=request.decision==="sign_in"?copy?.title??"Sign in to continue":request.decision==="verify_email"?"Verify your account":request.decision.includes("workspace")?"Choose the right workspace":request.decision==="unavailable"?"We couldn’t check your account":"Action unavailable";
  const switchWorkspace=async()=>{
    const workspace=request.session?.workspaces.find(item=>item.kind===required);if(!workspace||switching)return;setSwitching(true);setSwitchError("");
    try{const session=await services.auth.selectWorkspace(workspace.id);closeAuthAction();clearIdentityState();cache.clear();cache.setQueryData(["auth","session"],session);}catch{setSwitchError("The workspace could not be switched. Please try again.");}finally{setSwitching(false);}
  };
  return createPortal(<div ref={panel} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} className="auth-action-popover" style={position} onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node)&&!request.anchor?.contains(event.relatedTarget as Node))closeAuthAction();}}>
    <button type="button" className="auth-action-close" aria-label="Close account prompt" onClick={()=>closeAuthAction(true)}><Icon name="close"/></button><h2 id={`${id}-title`}>{title}</h2><p id={`${id}-description`}>{request.message??messages[request.decision]}</p>
    {request.decision==="sign_in"&&<Link href={authEntryHref(copy?.signInPath??"/login",request.intent??null)} className="auth-action-primary" onClick={()=>closeAuthAction()}>Sign in</Link>}
    {request.decision==="verify_email"&&<Link href={authEntryHref("/verify-email",request.intent??null)} className="auth-action-primary" onClick={()=>closeAuthAction()}>Verify email</Link>}
    {request.decision==="switch_workspace"&&<button type="button" className="auth-action-primary" disabled={switching} onClick={()=>{void switchWorkspace();}}>Switch to {required==="recruiter"?"recruiter":"job seeker"}</button>}
    {["workspace_required","choose_workspace"].includes(request.decision)&&request.session&&<Link className="auth-action-primary" href={authDestination(request.session)} onClick={()=>closeAuthAction()}>Your workspace</Link>}
    {request.decision==="unavailable"&&<button className="auth-action-primary" type="button" disabled={remaining>0} onClick={()=>request.reload?window.location.reload():request.retry()}>{request.reload?"Reload page":remaining?`Try again in ${remaining}s`:"Try again"}</button>}
    {switchError&&<p role="alert">{switchError}</p>}
  </div>,portal);
}
