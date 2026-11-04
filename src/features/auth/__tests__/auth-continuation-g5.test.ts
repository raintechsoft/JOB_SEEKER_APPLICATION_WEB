import {afterEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import type {AuthSession} from "@/services/auth/auth.service";
import {proxy} from "@/proxy";
import {bodyClassesFor,bodyClassScript} from "@/lib/routing/body-classes";
import {safeGuestReturnPath} from "@/lib/domain/guest-access";
import {actionContinuation,authEntryHref,continuationDestination,continuationFromParams,decodeAuthContinuation,encodeAuthContinuation,legacyAuthReturn,legacyPublicEntry,navigateToAuthContinuation,rememberAuthContinuation,takeAuthContinuation} from "../auth-continuation";
import examples from "../../../../../../contracts/examples/public-browsing.json";

const id=examples.entry.id,comment=examples.comment.id;
const professional:AuthSession={user:{id,name:"Synthetic",email:"test@example.test",email_verified:true},workspaces:[{id,kind:"professional",organization:null,membership_id:null,role:null}],selected_identity_id:id,email_challenge:null};
const recruiter:AuthSession={...professional,workspaces:[{...professional.workspaces[0],kind:"recruiter"}]};
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();sessionStorage.clear();});
const request=(path:string,cookie=true)=>new NextRequest(`http://localhost:3000${path}`,{headers:{...(cookie?{Cookie:"skillora_session=synthetic"}:{}),"next-router-prefetch":"1"}});
function setup(response=Response.json({data:professional})){
  vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE","http");vi.stubEnv("NEXT_PUBLIC_API_BASE_URL","http://localhost:8000/api/v1");vi.stubEnv("API_SESSION_COOKIE","skillora_session");
  const fetcher=vi.fn(async(_input?:RequestInfo|URL,_init?:RequestInit)=>{void _input;void _init;return response.clone();});vi.stubGlobal("fetch",fetcher);return fetcher;
}
it("encodes only bounded navigation context with the original fifteen-minute deadline",()=>{
  const intent=actionContinuation("like","/",{kind:"entry",id})!;
  expect(intent.returnTo).toBe(`/feed/${id}`);expect(intent.expiresAt-intent.createdAt).toBe(900000);
  const link=authEntryHref("/login",intent),parsed=new URL(link,"https://skillora.invalid");expect(continuationFromParams(parsed.searchParams)).toEqual(intent);
  for(const word of ["password","email","code","token","commentText","resume"])expect(parsed.searchParams.get("continue")).not.toContain(`"${word}"`);
});
it("preserves focused comments and public search context without persisting form fields",()=>{
  const path=`/feed/${id}?comment=${comment}#comment-${comment}`;
  expect(actionContinuation("reply",path,{kind:"comment",id:comment})?.returnTo).toBe(path);
  expect(actionContinuation("follow_company","/search?q=Northstar&scope=companies",{kind:"company",id})?.returnTo).toBe("/search?q=Northstar&scope=companies");
});
it.each(["https://evil.test","//evil.test","/\\evil.test","/feed/../admin","/%2f%2fevil.test","/login?next=/","/?password=secret","/search?q=xx&scope=talent","/app/messages?conversation=secret","/portfolio/synthetic?share=token","/?cursor=opaque","/search?q=xx&cursor=opaque"])("rejects unsafe or sensitive continuation %s",returnTo=>{
  const intent=actionContinuation("like","/")!;expect(decodeAuthContinuation(JSON.stringify({...intent,returnTo}))).toBeNull();
});
it("rejects expired/future/extended, oversized, unknown-field, duplicate and permission-bearing intents",()=>{
  const now=Date.now(),intent=actionContinuation("like","/",undefined,now)!;
  expect(decodeAuthContinuation(JSON.stringify(intent),intent.expiresAt)).toBeNull();expect(decodeAuthContinuation(JSON.stringify(intent),now-1)).toBeNull();
  for(const extra of [{expiresAt:now+900001},{password:"secret"},{code:"123456"},{commentText:"private"},{action:"delete_post"},{action:"browse"},{target:{kind:"entry",id:"invalid"}}])expect(decodeAuthContinuation(JSON.stringify({...intent,...extra}))).toBeNull();
  expect(decodeAuthContinuation("x".repeat(6201))).toBeNull();expect(decodeAuthContinuation("{broken")).toBeNull();
  const raw=encodeAuthContinuation(intent)!;expect(continuationFromParams(new URLSearchParams({continue:raw}))).toEqual(intent);const params=new URLSearchParams();params.append("continue",raw);params.append("continue",raw);expect(continuationFromParams(params)).toBeNull();
});
it("retains the intent across email verification without changing verification evidence",()=>{
  const intent=actionContinuation("like","/",{kind:"entry",id})!,unverified={...professional,user:{...professional.user,email_verified:false}};
  const destination=new URL(continuationDestination(intent,unverified),"https://skillora.invalid");expect(destination.pathname).toBe("/verify-email");expect(continuationFromParams(destination.searchParams)).toEqual(intent);expect(unverified.user.email_verified).toBe(false);
});
it.each([
  ["like",`/feed/${id}`],["message",`/feed/${id}`],["apply",`/jobs/${id}`],["create_post","/app/posts/new"],["view_messages","/app/messages"],["view_applications","/app/applications"],["view_following","/app/dashboard?view=following"],["view_saved","/app/dashboard?view=saved"],
] as const)("restores %s context without replaying a command",(action,path)=>{
  const intent=actionContinuation(action,`/feed/${id}`,action==="apply"?{kind:"job",id}:undefined)!;expect(continuationDestination(intent,professional)).toBe(path);
});
it("uses the actual selected workspace and refuses another workspace's private return",()=>{
  expect(continuationDestination(actionContinuation("create_post","/")!,recruiter)).toBe("/recruiter/posts/new");
  expect(continuationDestination(actionContinuation("view_applications","/")!,recruiter)).toBe("/recruiter/dashboard");
  expect(continuationDestination(actionContinuation("post_job","/")!,professional)).toBe("/app/dashboard");
  expect(legacyAuthReturn("/recruiter/dashboard?post="+id,professional)).toBeNull();expect(legacyAuthReturn("/app/dashboard?post="+id,professional)).toBe("/app/dashboard?post="+id);
});
it("consumes OAuth context once, validates tampered storage and respects expiry",()=>{
  const intent=actionContinuation("like","/",{kind:"entry",id})!;rememberAuthContinuation(intent);expect(localStorage.length).toBe(0);expect(takeAuthContinuation()).toEqual(intent);expect(takeAuthContinuation()).toBeNull();
  rememberAuthContinuation(intent);vi.spyOn(Date,"now").mockReturnValue(intent.expiresAt);expect(takeAuthContinuation()).toBeNull();vi.restoreAllMocks();
  sessionStorage.setItem("skillora.auth.continuation",JSON.stringify({...intent,password:"private"}));expect(takeAuthContinuation()).toBeNull();expect(sessionStorage.length).toBe(0);
});
it("uses fresh navigation for protected returns and client navigation for public context",()=>{
  const navigate=vi.fn(),hard=vi.fn();navigateToAuthContinuation(actionContinuation("like","/",{kind:"entry",id})!,professional,navigate,hard);expect(navigate).toHaveBeenCalledWith(`/feed/${id}`);expect(hard).not.toHaveBeenCalled();
  navigateToAuthContinuation(actionContinuation("view_messages","/")!,professional,navigate,hard);expect(hard).toHaveBeenCalledWith("/app/messages");
});
it("gives the domain homepage the platform theme on its first paint",()=>{
  expect(bodyClassesFor("/")).toEqual(["professional-theme"]);document.body.className="";new Function("location","document",bodyClassScript)({pathname:"/"},document);expect(document.body).toHaveClass("professional-theme");expect(document.body).not.toHaveClass("messaging-page");
});
it("renders the guest domain entry without an account request when there is no session cookie",async()=>{
  const fetcher=setup();const response=await proxy(request("/",false));expect(response.headers.get("location")).toBeNull();expect(response.headers.get("cache-control")).toContain("no-store");expect(fetcher).not.toHaveBeenCalled();
});
it.each([professional,recruiter])("routes the domain and old feed entry to the current selected workspace",async session=>{
  const fetcher=setup(Response.json({data:session}));for(const path of ["/","/feed?filter=jobs"]){const response=await proxy(request(path));expect(new URL(response.headers.get("location")!).pathname).toBe(session===professional?"/app/dashboard":"/recruiter/dashboard");}expect(fetcher.mock.calls.every(call=>String(call[0]).endsWith("/auth/me"))).toBe(true);
});
it("treats expired home cookies as guest, routes unverified accounts correctly and fails closed on outages",async()=>{
  const fetcher=setup(new Response(null,{status:401}));expect((await proxy(request("/"))).headers.get("location")).toBeNull();
  fetcher.mockResolvedValueOnce(Response.json({data:{...professional,user:{...professional.user,email_verified:false}}}));expect(new URL((await proxy(request("/"))).headers.get("location")!).pathname).toBe("/verify-email");fetcher.mockRejectedValueOnce(new Error("Unavailable"));expect((await proxy(request("/"))).headers.get("location")).toBeNull();fetcher.mockRejectedValueOnce(new Error("Unavailable"));expect(new URL((await proxy(request("/app/dashboard"))).headers.get("location")!).pathname).toBe("/service-unavailable");fetcher.mockRejectedValueOnce(new Error("Unavailable"));expect((await proxy(request("/login"))).headers.get("location")).toBeNull();
});
it("retains safe context through already-signed-in account entry and verification redirects",async()=>{
  setup();const intent=actionContinuation("like","/",{kind:"entry",id})!;for(const path of ["/login","/signup","/verify-email"]){const response=await proxy(request(authEntryHref(path,intent)));expect(new URL(response.headers.get("location")!).pathname).toBe(`/feed/${id}`);}
});
it("hides /onboarding for guests and signed-in workspaces until the live signup path uses it",async()=>{
  setup();expect(new URL((await proxy(request("/onboarding"))).headers.get("location")!).pathname).toBe("/app/dashboard");
  setup(Response.json({data:recruiter}));expect(new URL((await proxy(request("/onboarding"))).headers.get("location")!).pathname).toBe("/recruiter/dashboard");
  setup(new Response(null,{status:401}));const guest=await proxy(request("/onboarding",false));expect(new URL(guest.headers.get("location")!).pathname).toBe("/login");expect(guest.headers.get("location")).not.toContain("onboarding");
});
it("allows the Google completion screen to consume its tab context without trusting a role query",async()=>{
  setup(Response.json({data:recruiter}));const response=await proxy(request("/login?google=success&role=professional"));expect(response.headers.get("location")).toBeNull();expect(recruiter.workspaces[0].kind).toBe("recruiter");
});
it("redirects old shared links only after an independently validated public projection",async()=>{
  const fetcher=setup(new Response(null,{status:401}));fetcher.mockResolvedValueOnce(new Response(null,{status:401})).mockResolvedValueOnce(Response.json({data:examples.entry}));
  const response=await proxy(request(`/recruiter/dashboard?post=${id}&comment=${comment}`,false));expect(new URL(response.headers.get("location")!).pathname).toBe(`/feed/${id}`);expect(new URL(response.headers.get("location")!).hash).toBe(`#comment-${comment}`);expect(fetcher.mock.calls[1][1]?.headers).not.toHaveProperty("Cookie");
});
it.each([404,503])("keeps private/disabled legacy sources protected after public eligibility status %s",async status=>{
  const fetcher=setup();fetcher.mockResolvedValueOnce(new Response(null,{status:401})).mockResolvedValueOnce(new Response(null,{status}));const response=await proxy(request(`/app/dashboard?post=${id}`,false));expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
});
it("does not resolve malformed/duplicate legacy identifiers or accept private continuation query fields",()=>{
  expect(legacyPublicEntry("/app/dashboard",new URLSearchParams("post=invalid"))).toBeNull();expect(legacyPublicEntry("/app/dashboard",new URLSearchParams(`post=${id}&post=${id}`))).toBeNull();expect(legacyPublicEntry("/app/dashboard",new URLSearchParams(`post=${id}&token=secret`))).toBeNull();expect(safeGuestReturnPath(`/app/dashboard?post=${id}&comment=bad`)).toBeNull();
});
