import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";
import {ServicesContext} from "@/hooks/use-services";
import type {Services} from "@/services";
import {apiConfig} from "@/services/api/config";
import {ApiError,type HttpClient} from "@/services/api/client";
import type {AuthSession} from "@/services/auth/auth.service";
import {createHttpAuthService} from "@/services/auth/auth.http";
import {AuthActionHost,AuthActionButton} from "../auth-action-host";
import {useAuthAction} from "../use-auth-action";
import {useAuthActionStore} from "../auth-action-store";
import {guestPrompt} from "@/lib/domain/guest-access";

const nav=vi.hoisted(()=>({path:"/feed",push:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>nav.path,useRouter:()=>nav}));
vi.mock("next/link",()=>({default:({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a href={String(href)} {...props}>{children}</a>}));
const id="10000000-0000-4000-8000-000000000001",identity="10000000-0000-4000-8000-000000000002",recruiter="10000000-0000-4000-8000-000000000003";
const verified:AuthSession={user:{id,name:"Synthetic User",email:"test@example.test",email_verified:true},workspaces:[{id:identity,kind:"professional",membership_id:null,role:null,organization:null}],selected_identity_id:identity,email_challenge:null};
const original=apiConfig.dataSource,clients:QueryClient[]=[];
beforeEach(()=>{apiConfig.dataSource="http";useAuthActionStore.setState({request:null});nav.path="/feed";});
afterEach(()=>{cleanup();clients.splice(0).forEach(client=>client.clear());useAuthActionStore.setState({request:null});apiConfig.dataSource=original;vi.restoreAllMocks();});
function mount(children:ReactNode,inspect=vi.fn(async()=>verified),client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})){
  const services={auth:{inspect,me:vi.fn(async()=>verified),logout:vi.fn(),selectWorkspace:vi.fn(async()=>verified)},feed:{getEntry:vi.fn()}};clients.push(client);
  return {...render(<QueryClientProvider client={client}><ServicesContext.Provider value={services as unknown as Services}>{children}<AuthActionHost/></ServicesContext.Provider></QueryClientProvider>),services,client};
}
it("shows Sign in only after a guest check and never invokes the protected action",async()=>{
  const write=vi.fn(),inspect=vi.fn(async()=>{throw new ApiError("Guest",401);});const {services}=mount(<AuthActionButton action="like" onAllowed={write}>Like</AuthActionButton>,inspect);
  fireEvent.click(screen.getByRole("button",{name:"Like"}));const dialog=await screen.findByRole("dialog");expect(dialog).toHaveTextContent("Like this post?");expect(screen.getByRole("link",{name:"Sign in"})).toHaveAttribute("href",expect.stringMatching(/^\/login(?:\?|$)/));expect(screen.queryByRole("link",{name:"Create account"})).not.toBeInTheDocument();expect(write).not.toHaveBeenCalled();expect(services.auth.me).not.toHaveBeenCalled();expect(services.feed.getEntry).not.toHaveBeenCalled();expect(guestPrompt("like")).not.toHaveProperty("registerPath");
});
it("waits for an unresolved session and Escape cancels the original action",async()=>{
  let resolve!:(value:AuthSession)=>void;const inspect=vi.fn(()=>new Promise<AuthSession>(done=>{resolve=done;})),write=vi.fn();mount(<AuthActionButton action="like" onAllowed={write}>Like</AuthActionButton>,inspect);fireEvent.click(screen.getByRole("button",{name:"Like"}));expect(write).not.toHaveBeenCalled();expect(screen.queryByRole("dialog")).not.toBeInTheDocument();fireEvent.keyDown(document,{key:"Escape"});resolve(verified);await waitFor(()=>expect(inspect).toHaveBeenCalledOnce());await Promise.resolve();expect(write).not.toHaveBeenCalled();
});
it("rechecks cached sessions before optimistic changes and handles explicit expiry as signed out",async()=>{
  const cache=new QueryClient();cache.setQueryData(["auth","session"],verified);const write=vi.fn();mount(<AuthActionButton action="repost" onAllowed={write}>Repost</AuthActionButton>,vi.fn(async()=>{throw new ApiError("Expired",401);}),cache);fireEvent.click(screen.getByRole("button",{name:"Repost"}));await screen.findByRole("link",{name:"Sign in"});expect(write).not.toHaveBeenCalled();expect(cache.getQueryData(["auth","session"])).toBeNull();
});
it("uses the verified selected workspace without logout or automatic workspace changes",async()=>{
  const write=vi.fn();const {services}=mount(<AuthActionButton action="like" onAllowed={write}>Like</AuthActionButton>);fireEvent.click(screen.getByRole("button",{name:"Like"}));await waitFor(()=>expect(write).toHaveBeenCalledWith(expect.objectContaining({role:"professional",identityId:identity,userId:id})));expect(services.auth.logout).not.toHaveBeenCalled();expect(services.auth.selectWorkspace).not.toHaveBeenCalled();expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("guides unverified accounts to email verification without private reads or another login",async()=>{
  const write=vi.fn();const {services}=mount(<AuthActionButton action="comment" onAllowed={write}>Comment</AuthActionButton>,vi.fn(async()=>({...verified,user:{...verified.user,email_verified:false}})));fireEvent.click(screen.getByRole("button",{name:"Comment"}));expect(await screen.findByRole("link",{name:"Verify email"})).toHaveAttribute("href",expect.stringMatching(/^\/verify-email(?:\?|$)/));expect(screen.queryByRole("link",{name:"Sign in"})).not.toBeInTheDocument();expect(write).not.toHaveBeenCalled();expect(services.feed.getEntry).not.toHaveBeenCalled();
});
it("requires explicit workspace switching and never replays the application action",async()=>{
  const dual:AuthSession={...verified,workspaces:[...verified.workspaces,{id:recruiter,kind:"recruiter",membership_id:id,organization:{id,name:"Test"},role:"organization_admin"}],selected_identity_id:recruiter};const write=vi.fn();const {services}=mount(<AuthActionButton action="apply" onAllowed={write}>Apply</AuthActionButton>,vi.fn(async()=>dual));fireEvent.click(screen.getByRole("button",{name:"Apply"}));fireEvent.click(await screen.findByRole("button",{name:"Switch to job seeker"}));await waitFor(()=>expect(services.auth.selectWorkspace).toHaveBeenCalledWith(identity));expect(write).not.toHaveBeenCalled();expect(screen.queryByRole("link",{name:"Sign in"})).not.toBeInTheDocument();
});
it("shows workspace eligibility guidance when the account lacks an employer workspace",async()=>{
  const write=vi.fn();mount(<AuthActionButton action="shortlist" onAllowed={write}>Shortlist</AuthActionButton>);fireEvent.click(screen.getByRole("button",{name:"Shortlist"}));expect(await screen.findByRole("link",{name:"Your workspace"})).toHaveAttribute("href","/app/dashboard");expect(screen.getByRole("dialog")).toHaveTextContent("recruiter workspace is needed");expect(write).not.toHaveBeenCalled();
});
it("treats outages and restrictions as retry/denial, not guest login",async()=>{
  const write=vi.fn();const view=mount(<AuthActionButton action="message" onAllowed={write}>Message</AuthActionButton>,vi.fn(async()=>{throw new ApiError("Offline",503);}));fireEvent.click(screen.getByRole("button",{name:"Message"}));await screen.findByRole("button",{name:"Try again"});expect(screen.queryByRole("link",{name:"Sign in"})).not.toBeInTheDocument();view.unmount();mount(<AuthActionButton action="message" onAllowed={write}>Message</AuthActionButton>,vi.fn(async()=>{throw new ApiError("Restricted",403);}));fireEvent.click(screen.getByRole("button",{name:"Message"}));expect(await screen.findByRole("dialog")).toHaveTextContent("This account cannot use this action");expect(write).not.toHaveBeenCalled();
});
it("honors a server retry interval instead of repeatedly checking the account",async()=>{
  const inspect=vi.fn(async()=>{throw new ApiError("Limited",429,undefined,2);});mount(<AuthActionButton action="like" onAllowed={vi.fn()}>Like</AuthActionButton>,inspect);fireEvent.click(screen.getByRole("button",{name:"Like"}));expect(await screen.findByRole("button",{name:/Try again in/})).toBeDisabled();fireEvent.click(screen.getByRole("button",{name:"Like"}));await screen.findByRole("dialog");expect(inspect).toHaveBeenCalledOnce();
});
it("keeps one popover and restores the trigger on Escape while allowing outside dismissal",async()=>{
  mount(<><AuthActionButton action="like" onAllowed={vi.fn()}>Like</AuthActionButton><AuthActionButton action="repost" onAllowed={vi.fn()}>Repost</AuthActionButton></>,vi.fn(async()=>{throw new ApiError("Guest",401);}));const first=screen.getByRole("button",{name:"Like"});fireEvent.click(first);await screen.findByRole("dialog");expect(screen.getByRole("link",{name:"Sign in"})).toHaveFocus();fireEvent.keyDown(document,{key:"Escape"});expect(first).toHaveFocus();expect(screen.queryByRole("dialog")).not.toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"Repost"}));await screen.findByRole("dialog");fireEvent.pointerDown(document.body);expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("does not replay an uncertain business mutation through the session retry button",async()=>{
  const write=vi.fn(async()=>{throw new ApiError("Lost response",503);});mount(<AuthActionButton action="like" onAllowed={write}>Like</AuthActionButton>);fireEvent.click(screen.getByRole("button",{name:"Like"}));await screen.findByRole("button",{name:"Reload page"});expect(screen.queryByRole("button",{name:"Try again"})).not.toBeInTheDocument();expect(write).toHaveBeenCalledOnce();
});
function InvalidTarget(){const gate=useAuthAction();return <button onClick={()=>{void gate.run("apply",vi.fn(),{target:{kind:"job",id:"../private"}});}}>Invalid target</button>;}
it("validates target IDs before the account check",async()=>{const {services}=mount(<InvalidTarget/>);fireEvent.click(screen.getByRole("button",{name:"Invalid target"}));expect(await screen.findByRole("dialog")).toHaveTextContent("This item is unavailable");expect(services.auth.inspect).not.toHaveBeenCalled();});
it("probes auth/me without binding analytics or changing the selected identity",async()=>{
  const get=vi.fn(async()=>({data:verified})),bind=vi.fn(),context=vi.fn();const auth=createHttpAuthService({get,setUserContext:context} as unknown as HttpClient,vi.fn(),bind);expect(await auth.inspect!()).toBe(verified);expect(get).toHaveBeenCalledWith("auth/me");expect(bind).not.toHaveBeenCalled();expect(context).not.toHaveBeenCalled();
});
