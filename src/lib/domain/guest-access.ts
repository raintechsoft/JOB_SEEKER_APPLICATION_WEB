import {z} from "zod";
import policy from "../../../contracts/validation/public-browsing.json";
import {publicFeedQuerySchema,publicSearchQuerySchema} from "@/lib/validation/public-browsing";
import {jobSearchSchema} from "@/lib/validation/search";
import type {components} from "@/types/generated/public-browsing-v1";

export type GuestAction=components["schemas"]["GuestAction"];
export const GUEST_ACTIONS=[...policy.publicActions,...policy.accountActions,...policy.professionalActions,...policy.recruiterActions,...Object.keys(policy.permissionActions)] as [GuestAction,...GuestAction[]];
export const guestActionSchema=z.enum(GUEST_ACTIONS);
type Workspace="professional"|"recruiter";
export type GuestViewer={state:"loading"}|{state:"guest"}|{state:"unavailable"}|{state:"restricted"}|{state:"authenticated";emailVerified:boolean;workspace:Workspace|null;availableWorkspaces:readonly Workspace[];permissions:readonly string[]};
export type GuestAccessDecision="allow"|"sign_in"|"verify_email"|"switch_workspace"|"workspace_required"|"choose_workspace"|"hidden"|"pending"|"unavailable"|"denied";

/** UI guidance only. G2/G4 must retain Laravel's independent authorization on every request. */
export function guestActionDecision(action:GuestAction,viewer:GuestViewer):GuestAccessDecision {
  guestActionSchema.parse(action);
  if(policy.publicActions.includes(action))return "allow";
  const permission=(policy.permissionActions as Record<string,string>)[action];
  if(permission&&(viewer.state!=="authenticated"||!viewer.permissions.includes(permission)))return "hidden";
  if(viewer.state==="loading")return "pending";
  if(viewer.state==="unavailable")return "unavailable";
  if(viewer.state==="restricted")return "denied";
  if(viewer.state==="guest")return "sign_in";
  if(!viewer.emailVerified)return "verify_email";
  const required=(policy.permissionWorkspaces as Record<string,Workspace|undefined>)[action]??(policy.professionalActions.includes(action)?"professional":policy.recruiterActions.includes(action)?"recruiter":null);
  if(viewer.workspace&&!viewer.availableWorkspaces.includes(viewer.workspace))return "choose_workspace";
  if(required&&viewer.workspace!==required)return viewer.availableWorkspaces.includes(required)?"switch_workspace":"workspace_required";
  return viewer.workspace?"allow":"choose_workspace";
}
export function guestPrompt(action:GuestAction){
  guestActionSchema.parse(action);
  if(policy.publicActions.includes(action)||action in policy.permissionActions)return null;
  const copy=(policy.promptCopy as Record<string,string[]>)[action]??policy.promptCopy.default;
  const employer=policy.recruiterActions.includes(action);
  return {title:copy[0],message:copy[1],signInPath:employer?"/employer/login":"/login"};
}

const uuid=z.uuid(),slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const privateDestinations=new Set(["/app/messages","/app/applications","/app/settings","/app/posts/new","/app/updates","/app/projects","/app/portfolio","/app/profile","/recruiter/messages","/recruiter/settings","/recruiter/posts/new","/recruiter/shortlists","/recruiter/compare","/recruiter/jobs/new"]);
const nestedSettings=/^\/(app|recruiter)\/settings\/(account|privacy|notifications|personalisation|data|career|organization|hiring)$/;
/** Pure navigation validation; Laravel independently authorizes the destination. */
export function safeGuestReturnPath(value:unknown,includePrivate=true):string|null {
  if(typeof value!=="string"||value.length>policy.limits.returnPath||!value.startsWith("/")||value.startsWith("//")||/[\\\x00-\x20\x7f]/.test(value))return null;
  const url=new URL(value,"https://skillora.invalid");
  if(url.origin!=="https://skillora.invalid"||url.pathname!==value.split(/[?#]/)[0]||/%/.test(url.pathname))return null;
  const params=url.searchParams,query=Object.fromEntries(params);
  for(const key of params.keys())if(params.getAll(key).length!==1)return null;
  const path=url.pathname,parts=path.split("/").filter(Boolean);
  const noParams=()=>params.size===0&&!url.hash;
  if(path==="/how-it-works"){if(!noParams())return null;
  }else if(path==="/talent"){
    if(url.hash||params.size&&!publicSearchQuerySchema.safeParse({...query,scope:"people"}).success)return null;
  }else if(path==="/feed"||path==="/"){
    if(url.hash||params.has("cursor")||!publicFeedQuerySchema.safeParse(query).success)return null;
  }else if(parts.length===2&&parts[0]==="feed"&&uuid.safeParse(parts[1]).success){
    if(Object.keys(query).some(key=>key!=="comment")||query.comment&&!uuid.safeParse(query.comment).success)return null;
    if(url.hash&&url.hash!==`#comment-${query.comment??""}`)return null;
  }else if(path==="/search"){
    if(url.hash||params.has("cursor")||!publicSearchQuerySchema.safeParse(query).success)return null;
  }else if(path==="/jobs"){
    const numericKeys=new Set(["page","pageSize","experience","salaryMin","salaryMax"]);
    const jobs=Object.fromEntries(Object.entries(query).map(([key,item])=>[key,numericKeys.has(key)&&/^\d+(?:\.\d+)?$/.test(item)?Number(item):item]));
    if(url.hash||!jobSearchSchema.strict().safeParse({q:"",page:1,...jobs}).success)return null;
  }else if(parts.length===2&&["jobs","recruiters"].includes(parts[0])&&uuid.safeParse(parts[1]).success){if(!noParams())return null;
  }else if(parts.length===2&&["professionals","organizations","portfolio"].includes(parts[0])&&slug.test(parts[1])){if(!noParams())return null;
  }else if(includePrivate&&/^\/(?:app|recruiter)\/dashboard$/.test(path)){
    if(Object.keys(query).some(key=>!["view","post","comment"].includes(key))||query.view&&!["all","following","saved","jobs","reposts"].includes(query.view)||query.post&&!uuid.safeParse(query.post).success||query.comment&&(!query.post||!uuid.safeParse(query.comment).success))return null;
    if(url.hash&&url.hash!==`#comment-${query.comment??""}`)return null;
  }else if(includePrivate&&(privateDestinations.has(path)||nestedSettings.test(path))){if(!noParams())return null;
  }else if(includePrivate&&/^\/app\/jobs\/[^/]+\/apply$/.test(path)&&uuid.safeParse(parts[2]).success){
    if(url.hash||Object.keys(query).some(key=>!["returnTo","step"].includes(key))||query.step&&!["contact","documents","details","questions","review"].includes(query.step))return null;
    if(query.returnTo&&!safeGuestReturnPath(query.returnTo,false))return null;
  }else return null;
  return path+(params.size?`?${params}`:"")+url.hash;
}
const intentSchema=z.object({action:guestActionSchema,returnTo:z.string().refine(value=>safeGuestReturnPath(value)!==null),createdAt:z.number().int().nonnegative(),expiresAt:z.number().int().positive(),target:z.object({kind:z.enum(["entry","person","company","job","comment"]),id:z.uuid()}).strict().optional()}).strict();
export type GuestIntent=z.infer<typeof intentSchema>;
export function readGuestIntent(input:unknown,now=Date.now()):GuestIntent|null {
  const parsed=intentSchema.safeParse(input);if(!parsed.success)return null;
  const value=parsed.data;
  if(value.createdAt>now||value.expiresAt<=now||value.expiresAt-value.createdAt!==policy.intentTtlSeconds*1000)return null;
  return {...value,returnTo:safeGuestReturnPath(value.returnTo)!};
}
