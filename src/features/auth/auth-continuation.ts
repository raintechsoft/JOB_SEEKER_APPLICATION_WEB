import {readGuestIntent,safeGuestReturnPath,type GuestAction,type GuestIntent} from "@/lib/domain/guest-access";
import policy from "../../../../../contracts/validation/public-browsing.json";
import type {AuthSession} from "@/services/auth/auth.service";
import {authDestination} from "./auth-navigation";

const maxLength=6200,storageKey="skillora.auth.continuation";
const supported=new Set([...policy.accountActions,...policy.professionalActions,...policy.recruiterActions]);
export type ContinuationTarget=NonNullable<GuestIntent["target"]>;

/** Only navigation context is encoded. A continuation never authorizes or invokes a business action. */
export function decodeAuthContinuation(raw:unknown,now=Date.now()):GuestIntent|null{
  if(typeof raw!=="string"||raw.length>maxLength)return null;
  try{const value=readGuestIntent(JSON.parse(raw),now);return value&&supported.has(value.action)?value:null;}catch{return null;}
}
export function continuationFromParams(params:Pick<URLSearchParams,"getAll">,now=Date.now()){
  const values=params.getAll("continue");return values.length===1?decodeAuthContinuation(values[0],now):null;
}
export function encodeAuthContinuation(intent:GuestIntent):string|null{
  const raw=JSON.stringify(intent);return decodeAuthContinuation(raw)?raw:null;
}
export function actionContinuation(action:GuestAction,source:string,target?:ContinuationTarget,now=Date.now()):GuestIntent|null{
  let returnTo=safeGuestReturnPath(source);
  if(target?.kind==="job")returnTo=safeGuestReturnPath(`/jobs/${target.id}`);
  else if(target?.kind==="entry"&&!/^\/(?:app|recruiter)\//.test(source)&&!source.startsWith(`/feed/${target.id}`))returnTo=safeGuestReturnPath(`/feed/${target.id}`);
  if(!returnTo)return null;
  return readGuestIntent({action,returnTo,...(target?{target}:{}),createdAt:now,expiresAt:now+policy.intentTtlSeconds*1000},now);
}
export function authEntryHref(path:string,intent:GuestIntent|null){
  if(!["/login","/signup","/employer/login","/employer/register","/verify-email"].includes(path))throw new Error("Unsupported authentication entry.");
  const raw=intent&&encodeAuthContinuation(intent);return path+(raw?"?"+new URLSearchParams({continue:raw}):"");
}
export function continuationDestination(intent:GuestIntent|null,session:AuthSession):string{
  if(!session.user.email_verified)return authEntryHref("/verify-email",intent);
  const selected=session.workspaces.find(workspace=>workspace.id===session.selected_identity_id);
  if(!intent||!readGuestIntent(intent)||!selected)return authDestination(session);
  const root=selected.kind==="recruiter"?"/recruiter":"/app";
  const personal:Partial<Record<GuestAction,string>>={create_post:root+"/posts/new",view_following:root+"/dashboard?view=following",view_saved:root+"/dashboard?view=saved",view_messages:root+"/messages",view_settings:root+"/settings",view_notifications:root+"/dashboard"};
  if(intent.action==="view_applications")return selected.kind==="professional"?"/app/applications":authDestination(session);
  if(intent.action==="post_job")return selected.kind==="recruiter"?"/recruiter/jobs/new":authDestination(session);
  if(personal[intent.action])return personal[intent.action]!;
  const path=safeGuestReturnPath(intent.returnTo);
  if(!path||path.startsWith("/app/")&&selected.kind!=="professional"||path.startsWith("/recruiter/")&&selected.kind!=="recruiter")return authDestination(session);
  return path.startsWith("/feed?")?path.replace(/^\/feed/,"/"):path==="/feed"?"/":path;
}

/** OAuth alone needs tab storage to survive the external round trip; it expires and is consumed once. */
export function rememberAuthContinuation(intent:GuestIntent|null){
  try{const raw=intent&&encodeAuthContinuation(intent);if(raw)sessionStorage.setItem(storageKey,raw);else sessionStorage.removeItem(storageKey);}catch{ /* Ordinary workspace navigation is safe without browser storage. */ }
}
export function takeAuthContinuation():GuestIntent|null{
  try{const raw=sessionStorage.getItem(storageKey);sessionStorage.removeItem(storageKey);return decodeAuthContinuation(raw);}catch{return null;}
}

/** Cookie authentication may have changed outside Next's prefetched protected route cache. */
export function navigateToAuthContinuation(intent:GuestIntent,session:AuthSession,navigate:(path:string)=>void,hardNavigate:(path:string)=>void=path=>window.location.assign(path)){
  const target=continuationDestination(intent,session);
  if(/^\/(?:app|recruiter)(?:\/|$)/.test(target)||target.startsWith("/verify-email"))hardNavigate(target);
  else navigate(target);
}

/** Existing protected URLs remain compatible, without accepting arbitrary redirect targets. */
export function legacyAuthReturn(value:unknown,session:AuthSession):string|null{
  const path=safeGuestReturnPath(value),selected=session.workspaces.find(workspace=>workspace.id===session.selected_identity_id);
  if(!path||!selected||path.startsWith("/app/")&&selected.kind!=="professional"||path.startsWith("/recruiter/")&&selected.kind!=="recruiter")return null;
  return path==="/feed"?"/":path.startsWith("/feed?")?path.replace(/^\/feed/,"/"):path;
}
export function navigateToLegacyReturn(path:string,navigate:(path:string)=>void){
  if(!safeGuestReturnPath(path))throw new Error("Invalid return destination.");
  if(/^\/(?:app|recruiter)(?:\/|$)/.test(path))window.location.assign(path);else navigate(path);
}

export function legacyPublicEntry(path:string,params:URLSearchParams):string|null{
  if(!["/app/dashboard","/recruiter/dashboard"].includes(path)||[...params.keys()].some(key=>!["post","comment"].includes(key))||params.getAll("post").length!==1||params.getAll("comment").length>1)return null;
  const post=params.get("post"),comment=params.get("comment");
  if(params.has("comment")&&!comment)return null;
  return safeGuestReturnPath(`/feed/${post}${comment?`?comment=${comment}#comment-${comment}`:""}`,false);
}
