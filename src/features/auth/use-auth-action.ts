"use client";
import {useCallback,useEffect,useRef} from "react";
import {useQueryClient,type QueryClient} from "@tanstack/react-query";
import {z} from "zod";
import {useServices} from "@/hooks/use-services";
import {ApiError} from "@/services/api/client";
import {apiConfig} from "@/services/api/config";
import type {AuthSession} from "@/services/auth/auth.service";
import type {Role} from "@/types/domain";
import {guestActionDecision,guestActionSchema,type GuestAction} from "@/lib/domain/guest-access";
import policy from "../../../contracts/validation/public-browsing.json";
import {closeAuthAction,nextActionId,useAuthActionStore,type ActionRequest} from "./auth-action-store";
import {actionContinuation} from "./auth-continuation";

export type ActionContext={role:Role;identityId:string;userId:string;session?:AuthSession};
type ActionOptions={anchor?:HTMLElement|null;workspace?:Role;permissions?:string[];returnTo?:string;target?:{kind:"entry"|"person"|"company"|"job"|"comment";id:string}};
type RunAction=(action:GuestAction,allowed:(context:ActionContext)=>unknown|Promise<unknown>,options?:ActionOptions)=>Promise<boolean>;
const sessionShape=z.object({user:z.object({id:z.uuid(),email_verified:z.boolean()}),workspaces:z.array(z.object({id:z.uuid(),kind:z.enum(["professional","recruiter"])})),selected_identity_id:z.uuid().nullable()});
const pending=new WeakMap<QueryClient,Promise<AuthSession>>(),blockedUntil=new WeakMap<QueryClient,number>();
const requiredRole=(action:GuestAction)=>policy.professionalActions.includes(action)?"professional":policy.recruiterActions.includes(action)?"recruiter":(policy.permissionWorkspaces as Record<string,Role>)[action];

export function useAuthAction(){
  const services=useServices(),cache=useQueryClient(),locked=useRef(false),activeRequest=useRef<number|null>(null);
  useEffect(()=>()=>{if(useAuthActionStore.getState().request?.id===activeRequest.current)closeAuthAction();},[]);
  const run=useCallback<RunAction>(async function runAction(action,allowed,options={}){
    guestActionSchema.parse(action);
    if(apiConfig.dataSource!=="http"){
      const role=options.workspace??requiredRole(action)??"professional";
      await allowed({role,identityId:`demo:${role}`,userId:"demo"});return true;
    }
    if(locked.current)return false;
    const anchor=options.anchor??(document.activeElement instanceof HTMLElement?document.activeElement:null),bounds=anchor?.getBoundingClientRect();
    const id=nextActionId();
    const request:ActionRequest={id,action,decision:"pending",anchor,workspace:options.workspace??requiredRole(action),rect:bounds?{left:bounds.left,right:bounds.right,top:bounds.top,bottom:bounds.bottom}:{left:24,right:24,top:100,bottom:100},retry:()=>{void runAction(action,allowed,options);}};
    if(options.target&&!z.uuid().safeParse(options.target.id).success){useAuthActionStore.getState().set({...request,decision:"denied",message:"This item is unavailable."});return false;}
    const permissions=options.permissions??[];
    if(action in policy.permissionActions&&!permissions.includes((policy.permissionActions as Record<string,string>)[action]))return false;
    const publish=(patch:Partial<ActionRequest>)=>{if(useAuthActionStore.getState().request?.id===id)useAuthActionStore.getState().set({...request,...patch});};
    request.intent=actionContinuation(action,options.returnTo??window.location.pathname+window.location.search+window.location.hash,options.target);
    useAuthActionStore.getState().set(request);locked.current=true;activeRequest.current=id;let invoked=false;
    try{
      const until=blockedUntil.get(cache)??0;if(until>Date.now()){publish({decision:"unavailable",retryAt:until,message:"Too many account checks. Please try again shortly."});return false;}
      // Inside a workspace the session was already verified by its access gate: act instantly
      // instead of a second round trip. Laravel still authorizes the action itself.
      const known=cache.getQueryData<AuthSession|null>(["auth","session"]),knownSelected=known?.workspaces.find(workspace=>workspace.id===known.selected_identity_id);
      if(options.workspace&&known?.user.email_verified&&knownSelected?.kind===options.workspace&&guestActionDecision(action,{state:"authenticated",emailVerified:true,workspace:knownSelected.kind,availableWorkspaces:known.workspaces.map(workspace=>workspace.kind),permissions})==="allow"){
        closeAuthAction();invoked=true;
        await allowed({role:knownSelected.kind,identityId:knownSelected.id,userId:known.user.id,session:known});return true;
      }
      const previous=cache.getQueryData<AuthSession|null>(["auth","session"]);
      let checking=pending.get(cache);
      if(!checking){checking=(services.auth.inspect?services.auth.inspect():services.auth.me());pending.set(cache,checking);}
      let session:AuthSession;
      try{session=await checking;}finally{if(pending.get(cache)===checking)pending.delete(cache);}
      sessionShape.parse(session);
      if(useAuthActionStore.getState().request?.id!==id)return false;
      await cache.cancelQueries({queryKey:["auth","session"],exact:true});
      cache.setQueryData(["auth","session"],session);
      if(previous&&(previous.user.id!==session.user.id||previous.selected_identity_id!==session.selected_identity_id)){
        publish({decision:"unavailable",reload:true,message:"Your account or workspace changed. Reload this page before continuing."});return false;
      }
      const selected=session.workspaces.find(workspace=>workspace.id===session.selected_identity_id);
      const viewer={state:"authenticated" as const,emailVerified:session.user.email_verified,workspace:selected?.kind??null,availableWorkspaces:session.workspaces.map(workspace=>workspace.kind),permissions};
      let decision=guestActionDecision(action,viewer);
      if(decision==="allow"&&options.workspace&&selected?.kind!==options.workspace)decision=viewer.availableWorkspaces.includes(options.workspace)?"switch_workspace":"workspace_required";
      if(decision!=="allow"||!selected){publish({decision:decision==="allow"?"choose_workspace":decision,session});return false;}
      closeAuthAction();
      invoked=true;
      await allowed({role:selected.kind,identityId:selected.id,userId:session.user.id,session});return true;
    }catch(error){
      // A completed business operation is never replayed. Only session checks can be retried here.
      if(invoked){
        const current=useAuthActionStore.getState().request;if(current&&current.id!==id)return false;
        if(error instanceof ApiError&&[401,419].includes(error.status)){cache.setQueryData(["auth","session"],null);useAuthActionStore.getState().set({...request,decision:"sign_in"});}
        else if(error instanceof ApiError&&[403,404].includes(error.status))useAuthActionStore.getState().set({...request,decision:"denied",message:error.status===404?"This content is no longer available.":"You don’t have permission to perform this action."});
        else useAuthActionStore.getState().set({...request,decision:"unavailable",reload:true,message:"This action could not be confirmed. Reload before trying again."});
        return false;
      }
      if(useAuthActionStore.getState().request?.id!==id)return false;
      if(error instanceof ApiError&&[401,419].includes(error.status)){
        await cache.cancelQueries({queryKey:["auth","session"],exact:true});cache.setQueryData(["auth","session"],null);publish({decision:"sign_in"});
      }else if(error instanceof ApiError&&error.status===403)publish({decision:"denied",message:"This account cannot use this action."});
      else{const retryAt=error instanceof ApiError&&error.status===429?Date.now()+(error.retryAfterSeconds??60)*1000:undefined;if(retryAt)blockedUntil.set(cache,retryAt);publish({decision:"unavailable",retryAt,message:"Your account could not be checked. Please try again."});}
      return false;
    }finally{locked.current=false;if(useAuthActionStore.getState().request?.id!==id)activeRequest.current=null;}
  },[cache,services]);
  return {run};
}
