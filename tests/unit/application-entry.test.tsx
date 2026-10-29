import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {ServicesContext} from "@/hooks/use-services";
import type {Services} from "@/services";
import {useJobActions} from "@/features/feed/job-dialogs";
import {SignInForm} from "@/features/auth/auth-screen";
import {applicationSignInReturn,applicationWizardEnabled,isApplicationWizardRoute} from "@/features/applications/application-wizard-policy";
import {rememberApplicationSignInReturn,takeApplicationSignInReturn,navigateToApplication} from "@/features/applications/application-signin-return";
import {bodyClassesFor,bodyClassScript} from "@/lib/routing/body-classes";
import {workspaceTitle} from "@/lib/routing/titles";
import {apiConfig} from "@/services/api/config";
import {useModalStore} from "@/stores/modal-store";

const navigation=vi.hoisted(()=>({push:vi.fn(),replace:vi.fn(),params:new URLSearchParams()}));
vi.mock("next/navigation",()=>({useRouter:()=>navigation,useSearchParams:()=>navigation.params,usePathname:()=>window.location.pathname}));
vi.mock("next/link",()=>({default:({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a href={String(href)} {...props}>{children}</a>}));
vi.mock("@/lib/analytics",()=>({track:vi.fn()}));
vi.mock("@/features/applications/application-signin-return",async original=>({...await original<typeof import("@/features/applications/application-signin-return")>(),navigateToApplication:vi.fn()}));
const id="10000000-0000-4000-8000-000000000001";
const target=`/app/jobs/${id}/apply?returnTo=%2Fapp%2Fsearch%3Fq%3Dfrontend`;
const original=apiConfig.dataSource;
beforeEach(()=>{apiConfig.dataSource="http";vi.stubEnv("NEXT_PUBLIC_APPLICATION_WIZARD_ENABLED","true");navigation.push.mockReset();navigation.replace.mockReset();vi.mocked(navigateToApplication).mockClear();window.history.replaceState(null,"","/app/search?q=frontend");sessionStorage.clear();localStorage.clear();useModalStore.setState({open:false});});
afterEach(()=>{cleanup();apiConfig.dataSource=original;vi.unstubAllEnvs();sessionStorage.clear();});

function Wrap({children,role="professional"}:{children:React.ReactNode;role?:"professional"|"recruiter"}) {
  const session={user:{id,name:"Candidate",email:"candidate@example.test",email_verified:true},workspaces:[{id,kind:role}],selected_identity_id:id};
  const services={auth:{login:vi.fn(async()=>session),me:vi.fn(async()=>session)}} as unknown as Services;
  return <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ServicesContext.Provider value={services}>{children}</ServicesContext.Provider></QueryClientProvider>;
}
function Apply({job=id}:{job?:string}) {const actions=useJobActions();return <button onClick={()=>actions.apply(job)}>Apply test job</button>;}

it("routes the shared Apply action to the same typed page with its search return context",()=>{
  render(<Wrap><Apply/></Wrap>);fireEvent.click(screen.getByRole("button",{name:"Apply test job"}));
  expect(navigation.push).toHaveBeenCalledWith(target);
  expect(useModalStore.getState().open).toBe(false);
});
it("keeps the existing application modal while the live-entry switch is disabled",()=>{
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_WIZARD_ENABLED","false");
  render(<Wrap><Apply/></Wrap>);fireEvent.click(screen.getByRole("button",{name:"Apply test job"}));
  expect(navigation.push).not.toHaveBeenCalled();expect(useModalStore.getState().open).toBe(true);
});
it("rejects malformed Apply identifiers before navigation",()=>{
  render(<Wrap><Apply job="../login"/></Wrap>);fireEvent.click(screen.getByRole("button",{name:"Apply test job"}));
  expect(navigation.push).not.toHaveBeenCalled();
});
it("accepts only local job return destinations and removes unsafe nested returns and unknown parameters",()=>{
  for(const value of ["https://evil.test","//evil.test","/app/jobs/not-a-uuid/apply","/app/jobs/"+id+"/apply\\evil","/app/jobs/"+id+"/apply#private"])expect(applicationSignInReturn(value)).toBeNull();
  expect(applicationSignInReturn(`/app/jobs/${id}/apply?returnTo=https%3A%2F%2Fevil.test&code=123456&step=review`)).toBe(`/app/jobs/${id}/apply?returnTo=%2Fapp%2Fjobs&step=review`);
  expect(applicationSignInReturn(`/jobs/${id}?unsafe=1`)).toBe(`/jobs/${id}`);
  expect(isApplicationWizardRoute(`/app/jobs/${id}/apply`)).toBe(true);
  expect(isApplicationWizardRoute(`/app/jobs/${id}/apply/other`)).toBe(false);
  apiConfig.dataSource="mock";expect(applicationWizardEnabled()).toBe(false);
});
it("applies the correct first-paint body class and accessible workspace title",()=>{
  const path=`/app/jobs/${id}/apply`;
  expect(bodyClassesFor(path)).toContain("job-wizard-page");
  document.body.className="";
  new Function("location","document",bodyClassScript)({pathname:path},document);
  expect(document.body).toHaveClass("job-wizard-page");
  expect(workspaceTitle(path)).toBe("Apply for a job");
});
it("keeps only a short-lived allowlisted Google return path, consumes it once and stores no form data",()=>{
  rememberApplicationSignInReturn(target);
  expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(1);
  expect(takeApplicationSignInReturn()).toBe(target);expect(takeApplicationSignInReturn()).toBeNull();
  rememberApplicationSignInReturn("//evil.test");expect(sessionStorage.length).toBe(0);
  rememberApplicationSignInReturn(target);vi.spyOn(Date,"now").mockReturnValue(Date.now()+16*60*1000);
  expect(takeApplicationSignInReturn()).toBeNull();vi.restoreAllMocks();
});
it("returns professional password sign-in to the intended job without changing the employer destination",async()=>{
  window.history.replaceState(null,"","/login?next="+encodeURIComponent(target));
  const view=render(<Wrap><SignInForm role="professional"/></Wrap>);
  fireEvent.change(screen.getByRole("textbox",{name:"Email address"}),{target:{value:"candidate@example.test"}});
  fireEvent.change(document.querySelector<HTMLInputElement>("input[name=password]")!,{target:{value:"password"}});
  fireEvent.submit(document.getElementById("auth-form")!);
  await waitFor(()=>expect(navigateToApplication).toHaveBeenCalledWith(target));view.unmount();navigation.push.mockReset();
  render(<Wrap role="recruiter"><SignInForm role="recruiter"/></Wrap>);
  fireEvent.change(screen.getByRole("textbox",{name:"Email address"}),{target:{value:"recruiter@example.test"}});
  fireEvent.change(document.querySelector<HTMLInputElement>("input[name=password]")!,{target:{value:"password"}});
  fireEvent.submit(document.getElementById("auth-form")!);
  await waitFor(()=>expect(navigation.push).toHaveBeenCalledWith("/recruiter/dashboard"));
});
