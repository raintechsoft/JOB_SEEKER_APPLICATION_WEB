import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";
import type {AuthSession} from "@/services/auth/auth.service";
import type {Services} from "@/services";
import {ServicesContext} from "@/hooks/use-services";
import {apiConfig} from "@/services/api/config";
import {SignInForm,SignUpForm,AuthScreen} from "../auth-screen";
import {VerifyEmailScreen} from "../account-screens";
import {GoogleReturnNotice} from "../google-sign-in";
import {EmployerMenu} from "@/components/layout/public-chrome";
import {PublicEntryCard} from "@/features/public-browsing/public-entry-card";
import {ShareDestinations} from "@/features/feed/share-destinations";
import {AuthActionHost} from "../auth-action-host";
import {AccountEntryBoundary} from "../account-entry-boundary";
import {PlatformHomeScreen} from "@/features/public-browsing/platform-home";
import {actionContinuation,authEntryHref,continuationFromParams,rememberAuthContinuation} from "../auth-continuation";
import {publicEntrySchema} from "@/lib/validation/public-browsing";
import exampleData from "../../../../contracts/examples/public-browsing.json";
import {ApiError} from "@/services/api/client";
import {useAuthActionStore} from "../auth-action-store";

const nav=vi.hoisted(()=>({push:vi.fn(),replace:vi.fn(),hard:vi.fn(),params:new URLSearchParams()}));
vi.mock("next/navigation",()=>({usePathname:()=>window.location.pathname,useSearchParams:()=>nav.params,useRouter:()=>nav}));
vi.mock("next/link",()=>({default:({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a href={String(href)} {...props}>{children}</a>}));
vi.mock("../auth-continuation",async original=>{const actual=await original<typeof import("../auth-continuation")>();return {...actual,navigateToAuthContinuation:vi.fn((intent,session,navigate)=>actual.navigateToAuthContinuation(intent,session,navigate,nav.hard))};});
const entry=publicEntrySchema.parse(exampleData.entry),id=entry.id,identity="10000000-0000-4000-8000-000000000012";
const verified:AuthSession={user:{id,name:"Synthetic User",email:"test@example.test",email_verified:true},workspaces:[{id:identity,kind:"professional",organization:null,membership_id:null,role:null}],selected_identity_id:identity,email_challenge:null};
const original=apiConfig.dataSource,clients:QueryClient[]=[];
beforeEach(()=>{apiConfig.dataSource="http";nav.push.mockReset();nav.replace.mockReset();nav.hard.mockReset();sessionStorage.clear();useAuthActionStore.setState({request:null});enter("/login");});
afterEach(()=>{cleanup();clients.splice(0).forEach(client=>client.clear());apiConfig.dataSource=original;vi.restoreAllMocks();vi.unstubAllGlobals();sessionStorage.clear();useAuthActionStore.setState({request:null});});
function enter(path:string){window.history.replaceState(null,"",path);nav.params=new URLSearchParams(window.location.search);}
function intent(){return actionContinuation("like","/",{kind:"entry",id})!;}
function fixture(session=verified){return {auth:{inspect:vi.fn(async()=>{throw new ApiError("Guest",401);}),login:vi.fn(async()=>session),register:vi.fn(async()=>session),me:vi.fn(async()=>session),verifyEmail:vi.fn(async()=>verified),requestEmailCode:vi.fn(),completeExternalSignIn:vi.fn(async()=>session)},feed:{toggleLike:vi.fn(),setReposted:vi.fn(),getNetwork:vi.fn()},publicBrowsing:{entry:vi.fn(async()=>entry)}};}
function mount(children:ReactNode,services=fixture(),knownSession?:AuthSession){
  const cache=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});if(knownSession)cache.setQueryData(["auth","session"],knownSession);clients.push(cache);return {...render(<QueryClientProvider client={cache}><ServicesContext.Provider value={services as unknown as Services}>{children}</ServicesContext.Provider></QueryClientProvider>),services,cache};
}
function credentials(){fireEvent.change(screen.getByRole("textbox",{name:"Email address"}),{target:{value:"test@example.test"}});fireEvent.change(document.querySelector<HTMLInputElement>('input[name="password"]')!,{target:{value:"password123"}});}
it("keeps Sign in as the sole guest CTA and includes the exact source intent",async()=>{
  enter("/");const {services}=mount(<><PublicEntryCard entry={entry}/><AuthActionHost/></>);fireEvent.click(screen.getByRole("button",{name:"Like"}));const link=await screen.findByRole("link",{name:"Sign in"});const context=continuationFromParams(new URL(link.getAttribute("href")!,window.location.origin).searchParams);expect(context).toMatchObject({action:"like",returnTo:`/feed/${id}`,target:{kind:"entry",id}});expect(screen.queryByRole("link",{name:"Create account"})).not.toBeInTheDocument();expect(services.feed.toggleLike).not.toHaveBeenCalled();
});
it("returns password sign-in to the public post without replaying its like",async()=>{
  enter(authEntryHref("/login",intent()));const {services,cache}=mount(<SignInForm role="professional"/>);credentials();fireEvent.submit(document.getElementById("auth-form")!);await waitFor(()=>expect(nav.push).toHaveBeenCalledWith(`/feed/${id}`));expect(services.auth.login).toHaveBeenCalledWith({email:"test@example.test",password:"password123"},"professional");expect(services.feed.toggleLike).not.toHaveBeenCalled();expect(cache.getQueryData(["auth","session"])).toEqual(verified);
});
it("blocks invalid local credentials before the login request even with a valid return",async()=>{
  enter(authEntryHref("/login",intent()));const {services}=mount(<SignInForm role="professional"/>);fireEvent.submit(document.getElementById("auth-form")!);await screen.findByText("Enter a valid email address.");expect(services.auth.login).not.toHaveBeenCalled();expect(nav.push).not.toHaveBeenCalled();
});
it("preserves the original intent when moving between login, signup and employer access",()=>{
  const context=intent();enter(authEntryHref("/login",context));mount(<AuthScreen/>);for(const name of ["Create a profile","Employer Login"]){const link=screen.getByRole("link",{name});expect(continuationFromParams(new URL(link.getAttribute("href")!,window.location.origin).searchParams)).toEqual(context);}
});
it("preserves the intent when moving from employer access back to professional login",()=>{
  const context=intent();enter(authEntryHref("/employer/login",context));mount(<EmployerMenu variant="auth"/>);const link=screen.getByRole("link",{name:"Job seeker login"});expect(continuationFromParams(new URL(link.getAttribute("href")!,window.location.origin).searchParams)).toEqual(context);
});
it("takes a newly registered account through email verification before restoring context",async()=>{
  enter(authEntryHref("/signup",intent()));const session={...verified,user:{...verified.user,email_verified:false}},services=fixture(session);mount(<SignUpForm role="professional"/>,services);fireEvent.change(screen.getByRole("textbox",{name:"Full name"}),{target:{value:"Synthetic User"}});credentials();fireEvent.submit(document.getElementById("auth-form")!);await waitFor(()=>expect(nav.hard).toHaveBeenCalledWith(expect.stringMatching(/^\/verify-email\?continue=/)));const target=new URL(nav.hard.mock.calls[0][0],window.location.origin);expect(continuationFromParams(target.searchParams)?.returnTo).toBe(`/feed/${id}`);expect(services.feed.toggleLike).not.toHaveBeenCalled();
});
it("returns from backend-confirmed email verification without sending an invalid local code",async()=>{
  enter(authEntryHref("/verify-email",intent()));const session={...verified,user:{...verified.user,email_verified:false},email_challenge:{id:identity,kind:"email" as const,sent_at:new Date().toISOString(),expires_at:new Date(Date.now()+300000).toISOString()}},services=fixture(session);mount(<VerifyEmailScreen/>,services);await screen.findByRole("textbox",{name:"Code digit 1"});fireEvent.submit(document.getElementById("auth-form")!);expect(services.auth.verifyEmail).not.toHaveBeenCalled();for(let i=1;i<=6;i++)fireEvent.change(screen.getByRole("textbox",{name:`Code digit ${i}`}),{target:{value:"1"}});fireEvent.submit(document.getElementById("auth-form")!);await waitFor(()=>expect(nav.push).toHaveBeenCalledWith(`/feed/${id}`));expect(services.auth.verifyEmail).toHaveBeenCalledWith({challenge_id:identity,code:"111111"});expect(services.feed.toggleLike).not.toHaveBeenCalled();
});
it("consumes Google return context once and restores the post using the actual server session",async()=>{
  rememberAuthContinuation(intent());enter("/login?google=success");const {services}=mount(<GoogleReturnNotice/>);await waitFor(()=>expect(nav.replace).toHaveBeenCalledWith(`/feed/${id}`));expect(services.auth.completeExternalSignIn).toHaveBeenCalledOnce();expect(services.feed.toggleLike).not.toHaveBeenCalled();expect(sessionStorage.length).toBe(0);
});
it("keeps a cancelled Google flow on login and strips unapproved query values",async()=>{
  const context=intent();rememberAuthContinuation(context);enter("/login?google_error=cancelled&code=private&next=https://evil.test");const {services}=mount(<GoogleReturnNotice/>);await waitFor(()=>expect(nav.replace).toHaveBeenCalled());const destination=new URL(nav.replace.mock.calls[0][0],window.location.origin);expect(destination.pathname).toBe("/login");expect(destination.searchParams.has("code")).toBe(false);expect(destination.searchParams.has("next")).toBe(false);expect(continuationFromParams(destination.searchParams)).toEqual(context);expect(services.auth.completeExternalSignIn).not.toHaveBeenCalled();
});
it("cannot use an admin next parameter to turn employer login into professional login",async()=>{
  enter("/employer/login?next=/admin/dashboard");const session={...verified,workspaces:[{...verified.workspaces[0],kind:"recruiter" as const}]},services=fixture(session);mount(<SignInForm role="recruiter"/>,services);credentials();fireEvent.submit(document.getElementById("auth-form")!);await waitFor(()=>expect(services.auth.login).toHaveBeenCalled());expect(services.auth.login).toHaveBeenCalledWith({email:"test@example.test",password:"password123"},"employer");expect(nav.push).toHaveBeenCalledWith("/recruiter/dashboard");
});
it("uses a canonical external share link only after public eligibility succeeds",async()=>{
  const services=fixture();mount(<ShareDestinations role="professional" postId={id}/>,services);await waitFor(()=>expect(screen.getByRole("textbox",{name:"Post link"})).toHaveValue(`${window.location.origin}/feed/${id}`));expect(services.feed.getNetwork).not.toHaveBeenCalled();
});
it("keeps a private or release-disabled source on its protected legacy permalink",async()=>{
  const services=fixture();services.publicBrowsing.entry.mockRejectedValue(new ApiError("Private",404));mount(<ShareDestinations role="recruiter" postId={id}/>,services);await waitFor(()=>expect(services.publicBrowsing.entry).toHaveBeenCalled());expect(screen.getByRole("textbox",{name:"Post link"})).toHaveValue(`${window.location.origin}/recruiter/dashboard?post=${id}`);
});

it("does not revive a cached guest login form and rechecks the entry through server routing",()=>{
  enter("/login");const replace=vi.fn();vi.stubGlobal("location",{...window.location,replace});const {services}=mount(<AccountEntryBoundary><p>Guest sign-in form</p></AccountEntryBoundary>,fixture(),verified);expect(screen.queryByText("Guest sign-in form")).not.toBeInTheDocument();expect(replace).toHaveBeenCalledWith("/login");expect(services.auth.inspect).not.toHaveBeenCalled();
});
it("leaves authenticated inner-page navigation unchanged",()=>{
  enter("/app/messages");const replace=vi.fn();vi.stubGlobal("location",{...window.location,replace});mount(<AccountEntryBoundary><p>Your messages</p></AccountEntryBoundary>,fixture(),verified);expect(screen.getByText("Your messages")).toBeVisible();expect(replace).not.toHaveBeenCalled();
});
it("rechecks a cached guest homepage without mounting its public reads for a known account",()=>{
  enter("/");const replace=vi.fn();vi.stubGlobal("location",{...window.location,replace});const {services}=mount(<PlatformHomeScreen input={{}}/>,fixture(),verified);expect(replace).toHaveBeenCalledWith("/");expect(services.auth.inspect).not.toHaveBeenCalled();expect(services.feed.getNetwork).not.toHaveBeenCalled();
});
