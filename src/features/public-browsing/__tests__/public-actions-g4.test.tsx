import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";
import {ServicesContext} from "@/hooks/use-services";
import type {Services} from "@/services";
import type {AuthSession} from "@/services/auth/auth.service";
import {ApiError} from "@/services/api/client";
import {apiConfig} from "@/services/api/config";
import {AuthActionHost} from "@/features/auth/auth-action-host";
import {useAuthActionStore} from "@/features/auth/auth-action-store";
import {useModalStore} from "@/stores/modal-store";
import exampleData from "../../../../contracts/examples/public-browsing.json";
import {publicEntrySchema,publicCommentSchema} from "@/lib/validation/public-browsing";
import {PublicEntryCard,PublicShareControls} from "../public-entry-card";
import {PublicCommentComposer,PublicCommentMenu} from "../public-comment-actions";
import {PublicPersonalActions,PublicFollowButton} from "../public-account-actions";
import {useJobActions} from "@/features/feed/job-dialogs";

const nav=vi.hoisted(()=>({path:"/feed",push:vi.fn()}));
const examples={entry:publicEntrySchema.parse(exampleData.entry),comment:publicCommentSchema.parse(exampleData.comment)};
vi.mock("next/navigation",()=>({usePathname:()=>nav.path,useRouter:()=>nav}));
vi.mock("next/link",()=>({default:({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a href={String(href)} {...props}>{children}</a>}));
const user="10000000-0000-4000-8000-000000000011",identity="10000000-0000-4000-8000-000000000012";
const session:AuthSession={user:{id:user,name:"Synthetic",email:"test@example.test",email_verified:true},selected_identity_id:identity,workspaces:[{id:identity,kind:"professional",membership_id:null,organization:null,role:null}],email_challenge:null};
const original=apiConfig.dataSource,clients:QueryClient[]=[];
beforeEach(()=>{apiConfig.dataSource="http";useAuthActionStore.setState({request:null});useModalStore.setState({open:false});nav.push.mockReset();vi.stubEnv("NEXT_PUBLIC_APPLICATION_WIZARD_ENABLED","true");});
afterEach(()=>{cleanup();clients.splice(0).forEach(client=>client.clear());useAuthActionStore.setState({request:null});useModalStore.setState({open:false});apiConfig.dataSource=original;vi.restoreAllMocks();vi.unstubAllEnvs();});
function fixture(guest=true){return {
  auth:{inspect:vi.fn(async()=>{if(guest)throw new ApiError("Guest",401);return session;}),me:vi.fn(async()=>session)},
  feed:{getEntry:vi.fn(async()=>({id:examples.entry.id,type:"post",likes:3,viewer:{liked:false,reposted:false,saved:false,canRepost:true}})),toggleLike:vi.fn(async(_role:string,_id:string,enabled:boolean)=>enabled),setReposted:vi.fn(async(_role:string,_id:string,enabled:boolean)=>enabled),toggleSave:vi.fn(async(_role:string,_id:string,enabled:boolean)=>({saved:enabled,persisted:true})),toggleFollow:vi.fn(async()=>true),toggleFollowCompany:vi.fn(async()=>true),addComment:vi.fn(async()=>{}),setHidden:vi.fn(async()=>true),reportComment:vi.fn(async()=>{}),blockCommentAuthor:vi.fn(async()=>{}),getNetwork:vi.fn(async()=>({following:[],followers:[],companies:[]}))},
  publicBrowsing:{comments:vi.fn(async()=>({items:[examples.comment],total:1,nextCursor:null}))},
  profile:{getMyProfile:vi.fn()},jobs:{getJob:vi.fn(),listAlerts:vi.fn()},recommendations:{similarJobs:vi.fn()},messaging:{start:vi.fn()},notifications:{counts:vi.fn()},
};}
function mount(children:ReactNode,services=fixture()){
  const cache=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});clients.push(cache);
  return {...render(<QueryClientProvider client={cache}><ServicesContext.Provider value={services as unknown as Services}>{children}<AuthActionHost/></ServicesContext.Provider></QueryClientProvider>),services,cache};
}
it.each(["Like","Repost","Save","Follow"])("gates guest %s before state changes, private context or a mutation",async name=>{
  const {services}=mount(<PublicEntryCard entry={examples.entry}/>);if(name==="Save")fireEvent.click(screen.getByLabelText("More post actions"));fireEvent.click(screen.getByRole("button",{name:name==="Follow"?/^Follow /:name}));const prompt=await screen.findByRole("dialog");expect(within(prompt).getAllByRole("link")).toHaveLength(1);expect(within(prompt).getByRole("link",{name:"Sign in"})).toHaveAttribute("href",expect.stringMatching(/^\/login(?:\?|$)/));
  expect(services.auth.inspect).toHaveBeenCalledOnce();expect(services.auth.me).not.toHaveBeenCalled();expect(services.feed.getEntry).not.toHaveBeenCalled();for(const key of ["toggleLike","setReposted","toggleSave","setHidden","toggleFollow"] as const)expect(services.feed[key]).not.toHaveBeenCalled();expect(screen.getByRole("button",{name:"Like"})).toHaveAttribute("aria-pressed","false");
});
it("lets guests read comments but gates writing and replies without mounting text inputs",async()=>{
  const {services}=mount(<PublicEntryCard entry={examples.entry}/>);fireEvent.click(screen.getByRole("button",{name:"Comment 1"}));await screen.findByText(examples.comment.text);expect(services.auth.inspect).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Write a comment"}));await screen.findByRole("link",{name:"Sign in"});expect(screen.queryByRole("textbox",{name:"Your comment"})).not.toBeInTheDocument();expect(services.feed.addComment).not.toHaveBeenCalled();
  fireEvent.keyDown(document,{key:"Escape"});fireEvent.click(screen.getByRole("button",{name:"Reply"}));await screen.findByRole("link",{name:"Sign in"});expect(screen.queryByRole("textbox",{name:"Your reply"})).not.toBeInTheDocument();
});
it("offers no Not interested action on public posts",()=>{
  mount(<PublicEntryCard entry={examples.entry}/>);fireEvent.click(screen.getByLabelText("More post actions"));expect(screen.queryByRole("button",{name:"Not interested"})).not.toBeInTheDocument();
});
it("offers no block or report actions on public comments",()=>{
  const comment={...examples.comment,author:{...examples.comment.author,name:"Synthetic Public Member"}};mount(<PublicCommentMenu comment={comment}/>);fireEvent.click(screen.getByLabelText("Comment actions for Synthetic Public Member"));
  expect(screen.queryByRole("button",{name:/^Block/})).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Report comment"})).not.toBeInTheDocument();
});
it.each(["Message Synthetic Public Member"])("gates the guest comment action %s",async name=>{
  const comment={...examples.comment,author:{...examples.comment.author,name:"Synthetic Public Member"}};const {services}=mount(<PublicCommentMenu comment={comment}/>);fireEvent.click(screen.getByLabelText("Comment actions for Synthetic Public Member"));fireEvent.click(screen.getByRole("button",{name}));await screen.findByRole("link",{name:"Sign in"});expect(services.messaging.start).not.toHaveBeenCalled();expect(services.feed.blockCommentAuthor).not.toHaveBeenCalled();expect(useModalStore.getState().open).toBe(false);
});
it("does not mount followers or start native sharing when the guest chooses follower sharing",async()=>{
  const {services}=mount(<PublicShareControls path={examples.entry.path} entryId={examples.entry.id}/>);fireEvent.click(screen.getByRole("button",{name:"Share with followers"}));await screen.findByRole("link",{name:"Sign in"});expect(services.feed.getNetwork).not.toHaveBeenCalled();expect(useModalStore.getState().open).toBe(false);
});
it.each(["Create post","Following","Saved","Your applications","Messages","Notifications","Settings","Post a job"])("gates personal shortcut %s before navigation or a private sheet",async name=>{
  const {services}=mount(<PublicPersonalActions/>);fireEvent.click(screen.getByRole("button",{name}));await screen.findByRole("link",{name:"Sign in"});expect(nav.push).not.toHaveBeenCalled();expect(services.notifications.counts).not.toHaveBeenCalled();expect(useModalStore.getState().open).toBe(false);expect(screen.getByRole("link",{name:"Sign in"})).toHaveAttribute("href",expect.stringMatching(name==="Post a job"?/^\/employer\/login(?:\?|$)/:/^\/login(?:\?|$)/));
});
it("resolves the selected actor before liking, then supports explicit undo without a spinner",async()=>{
  const services=fixture(false);mount(<PublicEntryCard entry={examples.entry}/>,services);const button=screen.getByRole("button",{name:"Like"});fireEvent.click(button);await waitFor(()=>expect(services.feed.toggleLike).toHaveBeenCalledWith("professional",examples.entry.id,true));await waitFor(()=>expect(button).toHaveAttribute("aria-pressed","true"));expect(screen.getByRole("button",{name:"Like post"})).toHaveTextContent("4");fireEvent.click(button);await waitFor(()=>expect(services.feed.toggleLike).toHaveBeenLastCalledWith("professional",examples.entry.id,false));expect(screen.queryByText(/Loading your/)).not.toBeInTheDocument();
});
it("does not accidentally unlike an existing like on the first unresolved click",async()=>{
  const services=fixture(false);services.feed.getEntry.mockResolvedValue({id:examples.entry.id,type:"post",likes:3,viewer:{liked:true,reposted:false,saved:false,canRepost:true}});mount(<PublicEntryCard entry={examples.entry}/>,services);fireEvent.click(screen.getByRole("button",{name:"Like"}));await waitFor(()=>expect(services.feed.toggleLike).toHaveBeenCalledWith("professional",examples.entry.id,true));expect(screen.getByRole("button",{name:"Like post"})).toHaveTextContent("4");
});
it("rolls back an optimistic like when the backend refuses it",async()=>{
  const services=fixture(false);services.feed.toggleLike.mockRejectedValue(new ApiError("Forbidden",403));mount(<PublicEntryCard entry={examples.entry}/>,services);fireEvent.click(screen.getByRole("button",{name:"Like"}));await screen.findByText("You don’t have permission to perform this action.");expect(screen.getByRole("button",{name:"Like"})).toHaveAttribute("aria-pressed","false");expect(screen.getByRole("button",{name:"Like post"})).toHaveTextContent("3");
});
it("validates comments before even checking the session, then submits with the server-selected role",async()=>{
  const services=fixture(false);mount(<PublicCommentComposer entryId={examples.entry.id}/>,services);fireEvent.click(screen.getByRole("button",{name:"Write a comment"}));const input=await screen.findByRole("textbox",{name:"Your comment"});services.auth.inspect.mockClear();fireEvent.submit(input.closest("form")!);expect(screen.getByRole("alert")).toHaveTextContent("Write a comment.");expect(services.auth.inspect).not.toHaveBeenCalled();expect(services.feed.addComment).not.toHaveBeenCalled();fireEvent.change(input,{target:{value:"A useful synthetic test."}});fireEvent.submit(input.closest("form")!);await waitFor(()=>expect(services.feed.addComment).toHaveBeenCalledWith("professional",examples.entry.id,"A useful synthetic test.",undefined));expect(input).toHaveValue("");
});
it("rechecks a composer session at submission and hides its input if that session expired",async()=>{
  const services=fixture(false);mount(<PublicCommentComposer entryId={examples.entry.id}/>,services);fireEvent.click(screen.getByRole("button",{name:"Write a comment"}));const input=await screen.findByRole("textbox",{name:"Your comment"});fireEvent.change(input,{target:{value:"Should never be sent"}});services.auth.inspect.mockRejectedValue(new ApiError("Expired",401));fireEvent.submit(input.closest("form")!);await screen.findByRole("link",{name:"Sign in"});expect(services.feed.addComment).not.toHaveBeenCalled();expect(screen.queryByRole("textbox",{name:"Your comment"})).not.toBeInTheDocument();
});
it("uses explicit follow intent and the selected recruiter workspace without logging out",async()=>{
  const services=fixture(false);services.auth.inspect.mockResolvedValue({...session,workspaces:[{...session.workspaces[0],kind:"recruiter"}]});mount(<PublicFollowButton id={examples.entry.author!.id}/>,services);fireEvent.click(screen.getByRole("button",{name:"Follow"}));await waitFor(()=>expect(services.feed.toggleFollow).toHaveBeenCalledWith("recruiter",examples.entry.author!.id,true));
});
it("does not preload private profile data when a guest opens a public job sheet",()=>{
  function Open(){const jobs=useJobActions();return <button onClick={()=>jobs.view(examples.entry.id)}>View test job</button>;}
  const {services}=mount(<Open/>);fireEvent.click(screen.getByRole("button",{name:"View test job"}));expect(services.profile.getMyProfile).not.toHaveBeenCalled();expect(services.auth.inspect).not.toHaveBeenCalled();expect(services.jobs.listAlerts).not.toHaveBeenCalled();
});
