import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";
import {ServicesContext} from "@/hooks/use-services";
import type {Services} from "@/services";
import examples from "../../../../contracts/examples/public-browsing.json";
import {apiConfig} from "@/services/api/config";
import {publicEntrySchema} from "@/lib/validation/public-browsing";
import {createHttpClient,ApiError} from "@/services/api/client";
import {createHttpPublicBrowsingService} from "@/services/public-browsing/public-browsing.http";
import {PublicFeedScreen,PublicEntryScreen} from "../public-feed-screen";
import {PublicSearchScreen} from "../public-search-screen";
import {PublicHeaderSearch} from "../public-header-search";
import {BrowseShell} from "../browse-shell";
import {PublicEntryCard,PublicShareControls} from "../public-entry-card";
import {publicEntryMedia,publicParams,publicSearchHref,readPublicSearch,publicShareUrl} from "../public-routing";
import {bodyClassesFor,bodyClassScript} from "@/lib/routing/body-classes";
import {useModalStore} from "@/stores/modal-store";

const nav=vi.hoisted(()=>({push:vi.fn(),params:new URLSearchParams(),path:"/feed"}));
vi.mock("next/navigation",()=>({useRouter:()=>nav,useSearchParams:()=>nav.params,usePathname:()=>nav.path}));
vi.mock("next/link",()=>({default:({href,children,prefetch:_prefetch,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>&{prefetch?:boolean})=>{void _prefetch;return <a href={String(href)} {...props}>{children}</a>;}}));
const original={...apiConfig},clients:QueryClient[]=[];
const id=examples.entry.id,other="10000000-0000-4000-8000-000000000007";
beforeEach(()=>{vi.stubGlobal("matchMedia",()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}));apiConfig.dataSource="http";apiConfig.baseUrl="http://localhost:8107/api/v1";nav.params=new URLSearchParams();nav.path="/feed";nav.push.mockReset();useModalStore.setState({open:false});});
afterEach(()=>{cleanup();clients.splice(0).forEach(client=>client.clear());Object.assign(apiConfig,original);vi.unstubAllGlobals();vi.restoreAllMocks();useModalStore.setState({open:false});});
function fixture(){return {publicBrowsing:{feed:vi.fn(async(_query?:unknown,_options?:unknown)=>({items:[examples.entry],nextCursor:null as string|null,total:1})),entry:vi.fn(async()=>examples.entry),comments:vi.fn(async()=>({items:[examples.comment],nextCursor:null,total:1})),search:vi.fn(async(_query?:unknown,_options?:unknown)=>({items:[{id,kind:"company" as const,title:"Northstar Labs",subtitle:"Software",path:"/organizations/northstar-labs",picture:null}],nextCursor:null,total:1,scope:"companies"}))},auth:{me:vi.fn()},feed:{getNetwork:vi.fn()},notifications:{counts:vi.fn()},messaging:{getUnreadCount:vi.fn()}};}
function mount(children:ReactNode,services=fixture(),client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})){
  clients.push(client);return {...render(<QueryClientProvider client={client}><ServicesContext.Provider value={services as unknown as Services}>{children}</ServicesContext.Provider></QueryClientProvider>),services,client};
}
it("makes only public GET requests with validated inputs, signals and strict response projections",async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({data:{items:[examples.entry],nextCursor:null,total:1}}),{status:200,headers:{"Content-Type":"application/json"}}));vi.stubGlobal("fetch",fetcher);
  const api=createHttpPublicBrowsingService(createHttpClient(apiConfig.baseUrl));
  await expect(api.feed({identity:id})).rejects.toThrow();await expect(api.search({q:"x"})).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
  const controller=new AbortController();await api.feed({filter:"posts"},{signal:controller.signal});
  expect(fetcher).toHaveBeenCalledTimes(1);const [url,options]=fetcher.mock.calls[0] as unknown as [URL,RequestInit];expect(url.pathname).toBe("/api/v1/public/feed");expect(url.searchParams.get("filter")).toBe("posts");expect(options.method).toBe("GET");expect(options.credentials).toBe("include");controller.abort();expect(options.signal?.aborted).toBe(true);
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({data:{items:[{...examples.entry,email:"private@example.test"}],total:1,nextCursor:null}}),{status:200}));await expect(api.feed()).rejects.toThrow();
});
it("rejects duplicate/private/invalid route input before any public transport",()=>{
  const services=fixture();const view=mount(<PublicFeedScreen input={{filter:"following"}}/>,services);expect(screen.getByRole("alert")).toBeVisible();// Only the open-jobs rail may read; the rejected filter never reaches transport.
  expect(services.publicBrowsing.feed.mock.calls.every(([query])=>(query as {filter:string}).filter==="jobs")).toBe(true);view.unmount();
  mount(<PublicSearchScreen input={{q:["Public","Private"],scope:"companies"}}/>,services);expect(services.publicBrowsing.search).not.toHaveBeenCalled();
  mount(<PublicEntryScreen id={id} input={{token:"private"}}/>,services);expect(services.publicBrowsing.entry).not.toHaveBeenCalled();
  expect(readPublicSearch(publicParams(new URLSearchParams("q=Public&q=Private"))).success).toBe(false);
  expect(readPublicSearch({q:"Public",cursor:"expired-token"}).success).toBe(false);
  expect(publicSearchHref({q:"Public",cursor:"expired-token"})).not.toContain("cursor=");
});
it("loads the guest feed and comments without any private account, count or network requests",async()=>{
  const {services}=mount(<PublicFeedScreen input={{}}/>);await screen.findByText(examples.entry.title);
  expect(services.auth.me).not.toHaveBeenCalled();expect(services.notifications.counts).not.toHaveBeenCalled();expect(services.messaging.getUnreadCount).not.toHaveBeenCalled();
  expect(services.publicBrowsing.comments).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Comment 1"}));await screen.findByText(examples.comment.text);expect(services.feed.getNetwork).not.toHaveBeenCalled();
  expect(screen.getByRole("button",{name:"Like"})).toBeVisible();expect(screen.queryByRole("button",{name:"Delete"})).not.toBeInTheDocument();
});
it("paginates once per request and does not display duplicate feed entries",async()=>{
  const services=fixture();// The open-jobs rail reads separately; pages are answered by cursor.
  services.publicBrowsing.feed.mockImplementation(async query=>{const values=query as {filter:string;cursor?:string};if(values.filter==="jobs")return {items:[],nextCursor:null,total:0};return values.cursor?{items:[examples.entry,{...examples.entry,id:other,path:`/feed/${other}`,title:"Second public post"}],nextCursor:null,total:2}:{items:[examples.entry],nextCursor:"opaque-next",total:2};});
  mount(<PublicFeedScreen input={{filter:"posts"}}/>,services);await screen.findByText(examples.entry.title);fireEvent.click(screen.getByRole("button",{name:"See more posts"}));await screen.findByText("Second public post");expect(screen.getAllByText(examples.entry.title)).toHaveLength(1);expect(services.publicBrowsing.feed.mock.calls.filter(([query])=>(query as {filter:string}).filter==="posts")[1][0]).toMatchObject({filter:"posts",cursor:"opaque-next"});
});
it("uses only the header input, keeps a selected result first and never resolves an account for public filters",async()=>{
  const services=fixture();services.publicBrowsing.search.mockResolvedValue({items:[{id,kind:"company",title:"Northstar Labs",subtitle:"Software",path:"/organizations/northstar-labs",picture:null},{id:other,kind:"company",title:"Northstar Design",subtitle:"Design",path:"/organizations/northstar-design",picture:null}],nextCursor:null,total:2,scope:"companies"});
  const {container}=mount(<PublicSearchScreen input={{q:"Northstar",scope:"companies",selected:`company:${other}`}}/>,services);await screen.findByRole("link",{name:"Northstar Design"});expect(container.querySelector(".workspace-search-results li strong")?.textContent).toBe("Northstar Design");expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();expect(services.auth.me).not.toHaveBeenCalled();expect(services.publicBrowsing.search.mock.calls[0][0]).toMatchObject({scope:"companies",q:"Northstar"});
});
it("keeps header suggestions public, validates short input and routes a clicked company through results",async()=>{
  const services=fixture();mount(<PublicHeaderSearch/>,services);const input=screen.getByRole("combobox",{name:"Search Skillora"});fireEvent.focus(input);expect(screen.getByText("Recent searches")).toBeVisible();expect(services.publicBrowsing.search).not.toHaveBeenCalled();fireEvent.change(input,{target:{value:"a"}});fireEvent.submit(input.closest("form")!);expect(services.publicBrowsing.search).not.toHaveBeenCalled();
  fireEvent.change(input,{target:{value:"Northstar"}});fireEvent.click(screen.getByRole("button",{name:"Companies"}));const option=await screen.findByRole("option",{name:/Northstar Labs/});fireEvent.click(option);expect(nav.push).toHaveBeenCalledWith(expect.stringMatching(/^\/search\?q=Northstar&scope=companies&selected=company/));expect(services.auth.me).not.toHaveBeenCalled();expect(services.feed.getNetwork).not.toHaveBeenCalled();
});
it("reuses the known recruiter destination without a new session request",()=>{
  const client=new QueryClient();client.setQueryData(["auth","session"],{user:{id,name:"Recruiter",email_verified:true},workspaces:[{id,kind:"recruiter"}],selected_identity_id:id});const {services}=mount(<BrowseShell><p>Public content</p></BrowseShell>,fixture(),client);expect(screen.getAllByRole("link",{name:"Your workspace"})[0]).toHaveAttribute("href","/recruiter/dashboard");expect(services.auth.me).not.toHaveBeenCalled();
});
it("keeps guest search in the header and does not add a duplicate Search nav destination",()=>{
  mount(<BrowseShell><p>Public content</p></BrowseShell>);
  expect(screen.getByRole("combobox",{name:"Search Skillora"})).toBeInTheDocument();
  expect(screen.queryByRole("link",{name:/^Search$/})).not.toBeInTheDocument();
});
it("selects the last suggestion on the first Up key and opens matching filtered results on Enter",async()=>{
  const services=fixture();services.publicBrowsing.search.mockResolvedValue({items:[{id,kind:"company",title:"Northstar Labs",subtitle:"Software",path:"/organizations/northstar-labs",picture:null},{id:other,kind:"company",title:"Northstar Design",subtitle:"Design",path:"/organizations/northstar-design",picture:null}],nextCursor:null,total:2,scope:"companies"});
  mount(<PublicHeaderSearch/>,services);const input=screen.getByRole("combobox",{name:"Search Skillora"});fireEvent.change(input,{target:{value:"Northstar"}});fireEvent.click(screen.getByRole("button",{name:"Companies"}));const last=await screen.findByRole("option",{name:/Northstar Design/});fireEvent.keyDown(input,{key:"ArrowUp"});expect(input).toHaveAttribute("aria-activedescendant",last.id);fireEvent.keyDown(input,{key:"Enter"});expect(nav.push).toHaveBeenCalledWith(expect.stringContaining(`selected=company%3A${other}`));
});
it("offers public copy and native sharing without loading followers",async()=>{
  const writeText=vi.fn(async()=>{}),share=vi.fn(async()=>{});vi.stubGlobal("navigator",{clipboard:{writeText},share});const {services}=mount(<PublicShareControls path={`/feed/${id}`}/>);fireEvent.click(screen.getByRole("button",{name:"Copy"}));await screen.findByText("Copied");expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/feed/${id}`);fireEvent.click(screen.getByRole("button",{name:"More sharing options"}));expect(share).toHaveBeenCalledWith({title:"On Skillora",url:`${window.location.origin}/feed/${id}`});expect(services.feed.getNetwork).not.toHaveBeenCalled();
});
it("keeps a single media slide visible and orders accepted media with legacy public videos",()=>{
  const entry={...examples.entry,media:[{id,kind:"image" as const,mime:"image/png",name:"first.png",alt:"First public picture",downloadPath:`/api/v1/media/${id}/download`,position:0},{id:other,kind:"image" as const,mime:"image/png",name:"second.png",alt:"Second public picture",downloadPath:`/api/v1/media/${other}/download`,position:2}],externalVideos:[{position:1,url:"https://media.example.org/clip.mp4",name:"Public clip",alt:""}]};
  const checked=publicEntrySchema.parse(entry);expect(publicEntryMedia(checked).map(item=>item.type)).toEqual(["image","video","image"]);mount(<PublicEntryCard entry={checked}/>);const region=screen.getByRole("region",{name:/Post media/});expect(within(region).getByRole("img",{name:"First public picture"})).toBeVisible();expect(within(region).queryByRole("img",{name:"Second public picture"})).not.toBeInTheDocument();fireEvent.click(within(region).getByRole("button",{name:"Show media 3"}));expect(within(region).getByRole("img",{name:"Second public picture"})).toBeVisible();
});
it("shows release-disabled failures as unavailable instead of empty results or a login redirect",async()=>{
  const services=fixture();services.publicBrowsing.feed.mockRejectedValue(new ApiError("Unavailable",503));mount(<PublicFeedScreen input={{}}/>,services);await screen.findByRole("heading",{name:"Public browsing is unavailable"});expect(screen.queryByText("No posts yet")).not.toBeInTheDocument();expect(nav.push).not.toHaveBeenCalled();
});
it("uses the same first-paint theme for guest routes and rejects private share/query destinations",()=>{
  for(const path of ["/feed",`/feed/${id}`,"/search","/jobs"]){expect(bodyClassesFor(path)).toContain("professional-theme");document.body.className="";new Function("location","document",bodyClassScript)({pathname:path},document);expect(document.body).toHaveClass("professional-theme");}
  expect(()=>publicShareUrl("/app/messages",window.location.origin)).toThrow();expect(()=>publicSearchHref({q:"Northstar",scope:"talent"})).toThrow();
});
