import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {keepPreviousData,QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {StrictMode} from "react";
import {ServicesContext} from "@/hooks/use-services";
import type {Services} from "@/services";
import {ApplicationEditor,ApplicationWizardScreen} from "@/features/applications/application-wizard-screen";
import type {ApplicationContext,ApplicationDraft,DocumentContext} from "@/features/applications/application-wizard-policy";
import {emptyApplicationWizardValues,applicationSteps} from "@/lib/domain/application-wizard";
import type {ApplicationDraftSave} from "@/services/applications/application-wizard.service";
import {ApiError} from "@/services/api/client";
import {apiConfig} from "@/services/api/config";
import {useModalStore} from "@/stores/modal-store";

const navigation=vi.hoisted(()=>({push:vi.fn(),replace:vi.fn(),params:new URLSearchParams()}));
vi.mock("next/navigation",()=>({useRouter:()=>navigation,useSearchParams:()=>navigation.params,usePathname:()=>window.location.pathname}));
vi.mock("next/link",()=>({default:({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a href={String(href)} {...props}>{children}</a>}));
const jobId="10000000-0000-4000-8000-000000000001",draftId="10000000-0000-4000-8000-000000000002",questionId="10000000-0000-4000-8000-000000000003";
const oldSource=apiConfig.dataSource;

function fixture(questions=false) {
  const values=emptyApplicationWizardValues();values.contact={name:"Candidate",email:"candidate@example.test",phone:null};
  const draft:ApplicationDraft={id:draftId,jobId,version:1,requirementsVersion:1,questionsVersion:1,jobVersion:1,step:"contact",reachedStep:"contact",state:"active",values:values as ApplicationDraft["values"],savedAt:"2026-10-28T10:00:00Z",expiresAt:"2099-01-01T00:00:00Z",submittedApplicationId:null};
  const context:ApplicationContext={jobId,title:"Frontend Developer",companyName:"Synthetic Team",acceptingApplications:true,closesAt:null,requirements:{version:1,questionsVersion:1,jobVersion:1,requireResume:false,requirePhone:false,requirePortfolio:false,questions:questions?[{id:questionId,text:"Can you work remotely?",type:"yesno",required:true}]:[]},draft,application:null,contactStatus:{email:{value:values.contact.email,verified:true},phone:null},profilePhone:null,resume:null,portfolioReady:false,locations:["Bengaluru","Kochi"]};
  const documents:DocumentContext={draftId,version:1,requirements:{requireResume:false,requirePortfolio:false},resume:null,savedResume:null,library:[],resumeIssue:null,includePortfolio:false,portfolio:{title:"",ready:false,sections:[],items:[],totalItems:0}};
  const state={context,draft,documents};
  const defaultSave=async(_id:string,input:ApplicationDraftSave)=>{
    const steps=applicationSteps(state.context.requirements),target=steps.indexOf(input.step);
    const next=input.intent==="advance"?Math.min(target+1,steps.length-1):target;
    const reached=Math.max(steps.indexOf(state.draft.reachedStep),next);
    state.draft={...state.draft,version:state.draft.version+1,values:structuredClone(input.values) as ApplicationDraft["values"],step:steps[next],reachedStep:steps[reached]};
    state.context={...state.context,draft:state.draft,contactStatus:{email:{value:input.values.contact.email,verified:input.values.contact.email==="candidate@example.test"},phone:null}};
    state.documents={...state.documents,version:state.draft.version,includePortfolio:input.values.documents.includePortfolio,resume:input.values.documents.resumeAssetId?{id:input.values.documents.resumeAssetId,name:"saved.pdf",mime:"application/pdf",bytes:10,state:"accepted"}:null};
    return structuredClone(state.draft);
  };
  const api={context:vi.fn(async()=>structuredClone(state.context)),create:vi.fn(async()=>structuredClone(state.draft)),save:vi.fn(defaultSave),read:vi.fn(async()=>structuredClone(state.draft)),challenge:vi.fn(async()=>({id:questionId,kind:"email" as const,maskedDestination:"a•••@example.test",status:"pending" as const,sentAt:"2026-10-28T10:00:00Z",serverTime:"2026-10-28T10:00:00Z",expiresAt:"2026-10-28T10:05:00Z",resendAt:"2026-10-28T10:01:00Z"})),verify:vi.fn(),discard:vi.fn(),list:vi.fn()};
  const profileSnapshot={id:jobId,slug:"candidate",name:"Candidate",headline:"Engineer",category:"Engineering",location:"",summary:"Public profile summary",experience:"",education:"",arrangement:"",website:"",picture:"",color:"#315ef4",lastActive:"",years:0,skills:[],available:false,public:true,complete:0,interests:"",credentials:{groups:[],breaks:[],contact:{}}};
  const fullApi=Object.assign(api,{
    review:vi.fn(async()=>({draftId:state.draft.id,version:state.draft.version,requirementsVersion:state.draft.requirementsVersion,questionsVersion:state.draft.questionsVersion,jobVersion:state.draft.jobVersion,reviewHash:"a".repeat(64),values:structuredClone(state.draft.values),questions:state.context.requirements.questions,contactStatus:state.context.contactStatus,resume:state.documents.resume,profile:profileSnapshot,portfolio:null})),
    submit:vi.fn(async(...input:unknown[])=>{void input;return {id:questionId,jobId,schemaVersion:2 as const,submittedAt:"2026-10-28T10:00:00Z",attachments:[],contactVerification:"recorded" as const};}),
    receipt:vi.fn(),
  });
  const docs={context:vi.fn(async()=>structuredClone(state.documents)),uploadResume:vi.fn(),previewResume:vi.fn()};
  const session={user:{id:jobId,name:"Candidate",email:values.contact.email,email_verified:true},workspaces:[{id:draftId,kind:"professional"}],selected_identity_id:draftId};
  const services={applicationWizard:api,applicationDocuments:docs,media:{policy:vi.fn().mockResolvedValue({})},auth:{me:vi.fn(async()=>structuredClone(session))}} as unknown as Services;
  return {state,api:fullApi,docs,defaultSave,session,services,initial:{context:structuredClone(context),draft:structuredClone(draft),documents:structuredClone(documents),accountEmail:values.contact.email,requested:null as string|null}};
}
function mount(f:ReturnType<typeof fixture>,page=false) {
  const client=new QueryClient({defaultOptions:{queries:{retry:false,placeholderData:keepPreviousData}}});
  return render(<QueryClientProvider client={client}><ServicesContext.Provider value={f.services}>{page?<ApplicationWizardScreen jobId={jobId}/>:<ApplicationEditor initial={f.initial} returnTo="/app/search?q=frontend"/>}</ServicesContext.Provider></QueryClientProvider>);
}
beforeEach(()=>{vi.stubEnv("NEXT_PUBLIC_APPLICATION_WIZARD_ENABLED","true");apiConfig.dataSource="http";window.history.replaceState(null,"",`/app/jobs/${jobId}/apply`);navigation.params=new URLSearchParams();navigation.push.mockReset();navigation.replace.mockReset();});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllEnvs();apiConfig.dataSource=oldSource;useModalStore.setState({open:false});});
const next=()=>fireEvent.click(screen.getByRole("button",{name:"Next"}));

it("loads the exact server review and requires acknowledgement before one final submission",async()=>{
  const f=fixture();f.initial.draft.step="review";f.initial.draft.reachedStep="review";mount(f);
  expect(screen.getByRole("button",{name:"Submit application"})).toBeDisabled();
  const consent=await screen.findByRole("checkbox",{name:/I confirm that I have reviewed and verified the details above/});
  expect(screen.getByText("Public profile summary")).toBeInTheDocument();expect(f.api.submit).not.toHaveBeenCalled();
  fireEvent.click(consent);fireEvent.click(screen.getByRole("button",{name:"Submit application"}));
  await waitFor(()=>expect(navigation.replace).toHaveBeenCalledWith("/app/applications"));
  expect(f.api.submit).toHaveBeenCalledTimes(1);
  expect(f.api.review).toHaveBeenCalledTimes(1);
  expect(f.api.submit.mock.calls[0][1]).toMatchObject({schemaVersion:2,draftId,version:1,sharingAcknowledged:true,reviewHash:"a".repeat(64)});
});

it("resolves a lost submission response through the owned receipt without replaying a mutation",async()=>{
  const f=fixture();f.initial.draft.step="review";f.initial.draft.reachedStep="review";
  f.api.submit.mockRejectedValueOnce(new ApiError("Timeout",503));mount(f);
  fireEvent.click(await screen.findByRole("checkbox",{name:/I confirm that I have reviewed and verified the details above/}));fireEvent.click(screen.getByRole("button",{name:"Submit application"}));
  await screen.findByRole("button",{name:"Check submission"});expect(f.api.submit).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Submission confirmation is pending. Check your receipt before retrying.")).toBeInTheDocument();
  expect(screen.queryByText("This application is saved as a draft and has not been submitted.")).toBeNull();
  f.state.context.application={id:questionId,jobId,schemaVersion:2,submittedAt:"2026-10-28T10:00:00Z",attachments:[],contactVerification:"recorded"};
  fireEvent.click(screen.getByRole("button",{name:"Check submission"}));await waitFor(()=>expect(navigation.replace).toHaveBeenCalledWith("/app/applications"));
  expect(f.api.submit).toHaveBeenCalledTimes(1);
});

it("uses the original submission key and reviewed command on an explicit retry",async()=>{
  const f=fixture();f.initial.draft.step="review";f.initial.draft.reachedStep="review";f.api.submit.mockRejectedValueOnce(new ApiError("Timeout",503));mount(f);
  fireEvent.click(await screen.findByRole("checkbox",{name:/I confirm that I have reviewed and verified the details above/}));fireEvent.click(screen.getByRole("button",{name:"Submit application"}));
  await screen.findByRole("button",{name:"Retry same submission"});fireEvent.click(screen.getByRole("button",{name:"Retry same submission"}));
  await waitFor(()=>expect(navigation.replace).toHaveBeenCalledWith("/app/applications"));expect(f.api.submit).toHaveBeenCalledTimes(2);
  expect(f.api.submit.mock.calls[1][1]).toEqual(f.api.submit.mock.calls[0][1]);
});

it("keeps the draft and asks for current requirements after a server review conflict",async()=>{
  const f=fixture();f.initial.draft.step="review";f.initial.draft.reachedStep="review";f.api.review.mockRejectedValueOnce(new ApiError("Changed",409,{message:"The requirements changed."}));mount(f);
  await screen.findByRole("button",{name:"Reload saved draft"});expect(f.api.submit).not.toHaveBeenCalled();
  expect(screen.getByRole("button",{name:"Submit application"})).toBeDisabled();
  expect(f.state.draft.values.contact.email).toBe("candidate@example.test");
});

it("shows the contact step for a forged future-step URL and never advances malformed input",async()=>{
  const f=fixture();f.initial.requested="review";mount(f);
  expect(screen.getByRole("heading",{name:"Contact details"})).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox",{name:"Email"}),{target:{value:"not-an-email"}});
  next();
  await screen.findAllByText("Enter a valid email address.");
  expect(f.api.save).not.toHaveBeenCalled();
  expect(screen.getByRole("textbox",{name:"Email"})).toHaveAttribute("aria-invalid","true");
});

it("moves through four real steps without questions or an expected pay section",async()=>{
  const f=fixture();mount(f);next();
  await screen.findByRole("heading",{name:"Resume & portfolio"});next();
  await screen.findByRole("heading",{name:"Application details"});
  expect(screen.queryByRole("checkbox",{name:"Include expected pay"})).toBeNull();
  fireEvent.change(screen.getByRole("textbox",{name:"A short introduction"}),{target:{value:"My introduction"}});
  next();await screen.findByRole("heading",{name:"Review application"});
  expect(screen.queryByText("Expected pay")).toBeNull();
  expect(screen.getByRole("button",{name:"Submit application"})).toBeDisabled();
  expect(f.api.save.mock.calls.filter(([,input])=>input.intent==="advance")).toHaveLength(3);
  expect(f.state.draft.values.details).toMatchObject({noticeDays:null,joiningDays:null,expectedCompensation:null});
});

it("requires current screening answers and does not send an advance request for a missing answer",async()=>{
  const f=fixture(true);f.initial.draft.step="questions";f.initial.draft.reachedStep="questions";f.state.draft=structuredClone(f.initial.draft);mount(f);
  next();await screen.findAllByText("Answer this required question.");
  expect(f.api.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("radio",{name:"Yes"}));
  next();await screen.findByRole("heading",{name:"Review application"});
  expect(screen.getByText("Yes")).toBeInTheDocument();
  expect(f.api.save.mock.calls[0][1].values.answers[questionId]).toBe("Yes");
  expect(screen.queryByText("Answer this required question.")).toBeNull();
});

it("returns to an invalid earlier contact step without sending a request",async()=>{
  const f=fixture();f.initial.draft.step="details";f.initial.draft.reachedStep="details";f.initial.draft.values.contact.email="invalid";mount(f);
  next();await screen.findByRole("heading",{name:"Contact details"});
  expect(screen.getByRole("textbox",{name:"Email"})).toHaveAttribute("aria-invalid","true");
  expect(f.api.save).not.toHaveBeenCalled();
});

it("offers the job locations as badges and accepts the applicant's own location",async()=>{
  const f=fixture();f.initial.draft.step="details";f.initial.draft.reachedStep="details";f.state.draft=structuredClone(f.initial.draft);mount(f);
  await screen.findByRole("heading",{name:"Application details"});
  fireEvent.click(screen.getByRole("button",{name:"Kochi"}));
  expect(screen.getByRole("button",{name:"Kochi"})).toHaveAttribute("aria-pressed","true");
  fireEvent.change(screen.getByRole("textbox",{name:"Add another location"}),{target:{value:"Pune"}});
  fireEvent.click(screen.getByRole("button",{name:"Add"}));
  expect(screen.getByText("Pune")).toBeInTheDocument();
  next();await screen.findByRole("heading",{name:"Review application"});
  expect(f.api.save.mock.calls.at(-1)?.[1].values.details.preferredLocations).toEqual(["Kochi","Pune"]);
});

it("clears expected pay saved by an older draft and no longer asks for it",async()=>{
  const f=fixture();f.initial.draft.step="details";f.initial.draft.reachedStep="details";f.initial.draft.values.details.expectedCompensation={currency:"INR",period:"month",amount:"5"};f.state.draft=structuredClone(f.initial.draft);mount(f);
  await screen.findByRole("heading",{name:"Application details"});
  expect(screen.queryByRole("checkbox",{name:"Include expected pay"})).toBeNull();
  next();await screen.findByRole("heading",{name:"Review application"});
  expect(f.api.save.mock.calls.at(-1)?.[1].values.details.expectedCompensation).toBeNull();
});

it("connects a required resume error to the upload control without uploading or advancing",async()=>{
  const f=fixture();f.initial.draft.step="documents";f.initial.draft.reachedStep="documents";f.initial.context.requirements.requireResume=true;f.initial.documents.requirements.requireResume=true;mount(f);
  next();await screen.findAllByText("This job requires a resume.");
  const input=screen.getByLabelText("Choose a resume");
  expect(input).toHaveAttribute("aria-invalid","true");expect(input).toHaveAccessibleDescription("This job requires a resume.");
  expect(f.api.save).not.toHaveBeenCalled();expect(f.docs.uploadResume).not.toHaveBeenCalled();
});

it("validates hidden edited details before invoking the resume upload service",async()=>{
  const f=fixture();f.initial.draft.step="details";f.initial.draft.reachedStep="details";mount(f);
  fireEvent.change(screen.getByRole("spinbutton",{name:"Notice period (days)"}),{target:{value:"-1"}});
  fireEvent.click(screen.getByRole("button",{name:/Resume & portfolio/}));
  await screen.findByRole("heading",{name:"Resume & portfolio"});
  const file=new File(["%PDF-1.4 synthetic"],"synthetic.pdf",{type:"application/pdf"});
  // Choosing a file uploads at once, so invalid hidden details must stop it before the upload service runs.
  fireEvent.change(screen.getByLabelText("Choose a resume"),{target:{files:[file]}});
  await screen.findByRole("heading",{name:"Application details"});
  expect(f.docs.uploadResume).not.toHaveBeenCalled();expect(f.api.save).not.toHaveBeenCalled();
});

it("waits for a confirmed save before leaving and prevents double save/next while pending",async()=>{
  const f=fixture();let finish!:()=>void;
  f.api.save.mockImplementationOnce(async(...args)=>{await new Promise<void>(resolve=>{finish=resolve;});return f.defaultSave(...args);});
  mount(f);fireEvent.change(screen.getByRole("textbox",{name:"Name"}),{target:{value:"Changed Candidate"}});
  fireEvent.click(screen.getByRole("button",{name:"Save draft & exit"}));
  await waitFor(()=>expect(f.api.save).toHaveBeenCalledTimes(1));
  expect(navigation.push).not.toHaveBeenCalled();
  expect(screen.getByRole("button",{name:"Next"})).toBeDisabled();
  await act(async()=>finish());
  await waitFor(()=>expect(navigation.push).toHaveBeenCalledWith("/app/search?q=frontend"));
  expect(f.api.save).toHaveBeenCalledTimes(1);
});

it("retains input and pauses writes on a stale revision instead of rebasing another tab",async()=>{
  const f=fixture();f.api.save.mockRejectedValueOnce(new ApiError("Conflict",409,{message:"This draft changed in another tab."}));mount(f);
  fireEvent.change(screen.getByRole("textbox",{name:"Name"}),{target:{value:"Local input"}});next();
  await screen.findByText("This draft changed in another tab.");
  expect(screen.getByRole("textbox",{name:"Name"})).toHaveValue("Local input");
  expect(screen.getByRole("button",{name:"Next"})).toBeDisabled();
  expect(f.api.save).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button",{name:"Reload saved draft"}));
  await waitFor(()=>expect(screen.getByRole("textbox",{name:"Name"})).toHaveValue("Candidate"));
});

it("clears unsaved local values only after choosing leave without saving",async()=>{
  const f=fixture();mount(f);
  fireEvent.change(screen.getByRole("textbox",{name:"Email"}),{target:{value:"invalid-local-email"}});
  fireEvent.click(screen.getByRole("link",{name:"Back to opportunities"}));
  expect(useModalStore.getState().open).toBe(true);
  render(<>{useModalStore.getState().content}</>);
  fireEvent.click(screen.getByRole("button",{name:"Leave without saving"}));
  expect(screen.getByRole("textbox",{name:"Email"})).toHaveValue("candidate@example.test");
  expect(f.api.save).not.toHaveBeenCalled();expect(navigation.push).toHaveBeenCalledWith("/app/search?q=frontend");
});

it("advances with an alternate email without sending a verification challenge",async()=>{
  const f=fixture();mount(f);
  fireEvent.change(screen.getByRole("textbox",{name:"Email"}),{target:{value:"alternate@example.test"}});
  expect(screen.queryByRole("button",{name:"Send verification code"})).toBeNull();
  next();await screen.findByRole("heading",{name:"Resume & portfolio"});
  expect(f.api.save.mock.calls[0][1].values.contact.email).toBe("alternate@example.test");
  expect(f.api.challenge).not.toHaveBeenCalled();
});

it("persists explicit saved-resume selection and refreshes accepted document context",async()=>{
  const f=fixture();f.initial.draft.step="documents";f.initial.draft.reachedStep="documents";f.state.draft=structuredClone(f.initial.draft);
  f.initial.documents.savedResume={id:questionId,name:"saved.pdf",mime:"application/pdf",bytes:10,state:"accepted"};f.state.documents=structuredClone(f.initial.documents);
  mount(f);fireEvent.click(screen.getByRole("button",{name:"Use saved.pdf for this application"}));
  await waitFor(()=>expect(f.state.draft.values.documents.resumeAssetId).toBe(questionId));
  await screen.findByRole("button",{name:"Download saved.pdf"});
  expect(f.api.save.mock.calls[0][1].values.documents.resumeAssetId).toBe(questionId);
});

it("serializes autosaves while preserving edits typed during a pending save",async()=>{
  vi.useFakeTimers({toFake:["setTimeout","clearTimeout"]});
  const f=fixture();let finish!:()=>void;
  f.api.save.mockImplementationOnce(async(...args)=>{await new Promise<void>(resolve=>{finish=resolve;});return f.defaultSave(...args);});
  mount(f);fireEvent.change(screen.getByRole("textbox",{name:"Name"}),{target:{value:"First edit"}});
  await act(async()=>{vi.advanceTimersByTime(1000);});
  expect(f.api.save).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("textbox",{name:"Name"}),{target:{value:"Latest edit"}});
  await act(async()=>finish());
  expect(screen.getByRole("textbox",{name:"Name"})).toHaveValue("Latest edit");
  await act(async()=>{vi.advanceTimersByTime(1000);});
  expect(f.api.save).toHaveBeenCalledTimes(2);
  expect(f.api.save.mock.calls[1][1]).toMatchObject({version:2,values:{contact:{name:"Latest edit"}}});
});

it("returns an existing application to My applications without creating a duplicate draft",async()=>{
  const f=fixture();f.state.context.application={id:questionId,jobId,schemaVersion:1,submittedAt:"2026-10-28T10:00:00Z",attachments:[],contactVerification:"not_recorded"};f.state.context.acceptingApplications=false;f.state.context.draft=null;mount(f,true);
  await waitFor(()=>expect(navigation.replace).toHaveBeenCalledWith("/app/applications"));
  expect(f.api.create).not.toHaveBeenCalled();expect(f.api.save).not.toHaveBeenCalled();
});

it("blocks a closed job and a selected recruiter workspace before opening an editor",async()=>{
  const f=fixture();f.state.context.acceptingApplications=false;const view=mount(f,true);
  await screen.findByRole("heading",{name:"Application unavailable"});expect(f.api.create).not.toHaveBeenCalled();view.unmount();
  const other=fixture();other.session.workspaces[0].kind="recruiter";mount(other,true);
  await screen.findByText("Use your verified professional workspace to apply.");expect(other.api.context).not.toHaveBeenCalled();
});

it("accepts a valid required phone without sending verification requests",async()=>{
  const f=fixture();f.initial.context.requirements.requirePhone=true;f.state.context.requirements.requirePhone=true;mount(f);
  expect(screen.getByRole("textbox",{name:"Phone number"})).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox",{name:"Phone number"}),{target:{value:"9876543210"}});next();
  await screen.findByRole("heading",{name:"Resume & portfolio"});
  expect(f.api.save).toHaveBeenCalledTimes(1);expect(f.api.verify).not.toHaveBeenCalled();expect(f.api.challenge).not.toHaveBeenCalled();
});

it("reuses a verified profile phone for an existing draft with no number",async()=>{
  const f=fixture();f.initial.context.profilePhone={country:"IN",nationalNumber:"9876543210"};mount(f);
  expect(screen.getByRole("textbox",{name:"Phone number"})).toHaveValue("+91 9876543210");
  expect(screen.getByRole("textbox",{name:"Phone number"})).toHaveAttribute("readonly");
  expect(screen.getByText("This phone number is already verified.")).toBeInTheDocument();
  next();await screen.findByRole("heading",{name:"Resume & portfolio"});
  expect(f.api.save.mock.calls[0][1].values.contact.phone).toEqual({country:"IN",nationalNumber:"9876543210"});
  expect(f.api.challenge).not.toHaveBeenCalled();expect(f.api.verify).not.toHaveBeenCalled();
});

it("blocks missing required and malformed supplied phones before sending a save",async()=>{
  const f=fixture();f.initial.context.requirements.requirePhone=true;mount(f);
  next();await screen.findAllByText("Enter a phone number for this application.");
  expect(f.api.save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox",{name:"Phone number"}),{target:{value:"invalid"}});next();
  await screen.findAllByText("Enter a valid national phone number using digits only.");
  expect(f.api.save).not.toHaveBeenCalled();expect(f.api.challenge).not.toHaveBeenCalled();
});

it("allows clearing an optional phone and shows no phone verification action",async()=>{
  const f=fixture();mount(f);
  const phone=screen.getByRole("textbox",{name:"Phone number"});
  fireEvent.change(phone,{target:{value:"9876543210"}});fireEvent.change(phone,{target:{value:""}});next();
  await screen.findByRole("heading",{name:"Resume & portfolio"});
  expect(f.api.save.mock.calls[0][1].values.contact.phone).toBeNull();expect(f.api.challenge).not.toHaveBeenCalled();
});

it("requires renewed confirmation after reviewing a changed application",async()=>{
  const f=fixture();f.initial.draft.step="review";f.initial.draft.reachedStep="review";mount(f);
  const consent=await screen.findByRole("checkbox",{name:/reviewed and verified the details above/});
  fireEvent.click(consent);expect(screen.getByRole("button",{name:"Submit application"})).toBeEnabled();
  fireEvent.click(screen.getByRole("button",{name:"Edit contact details"}));
  await screen.findByRole("heading",{name:"Contact details"});
  fireEvent.change(screen.getByRole("textbox",{name:"Name"}),{target:{value:"Reviewed updated name"}});
  next();await screen.findByRole("heading",{name:"Resume & portfolio"});
  next();await screen.findByRole("heading",{name:"Application details"});
  const realReview=f.api.review.getMockImplementation()!;
  let releaseReview!:()=>void;
  f.api.review.mockImplementationOnce(async()=>{await new Promise<void>(resolve=>{releaseReview=resolve;});return realReview();});
  next();await screen.findByRole("heading",{name:"Review application"});
  await waitFor(()=>expect(f.api.review).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("checkbox",{name:/reviewed and verified the details above/})).toBeNull();
  expect(screen.getByRole("button",{name:"Submit application"})).toBeDisabled();
  await act(async()=>releaseReview());
  await screen.findByRole("checkbox",{name:/reviewed and verified the details above/});
  expect(screen.getByRole("button",{name:"Submit application"})).toBeDisabled();expect(f.api.submit).not.toHaveBeenCalled();
});

it("pauses after session expiry, keeps local input and never automatically replays the mutation",async()=>{
  const f=fixture();f.api.save.mockRejectedValueOnce(new ApiError("Expired",401,{message:"Sign in again."}));mount(f);
  fireEvent.change(screen.getByRole("textbox",{name:"Name"}),{target:{value:"Local unsaved name"}});next();
  await screen.findByText(/Sign in to continue with your last saved draft/);
  expect(screen.getByRole("textbox",{name:"Name"})).toHaveValue("Local unsaved name");
  expect(screen.getByRole("button",{name:"Next"})).toBeDisabled();
  expect(f.api.save).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link",{name:"Sign in"}).getAttribute("href")).toContain("next=%2Fapp%2Fjobs%2F");
});

it("opens one owned draft under Strict Mode without duplicating the creation request",async()=>{
  const f=fixture();f.state.context.draft=null;
  f.api.create.mockImplementation(async()=>{f.state.context.draft=f.state.draft;return structuredClone(f.state.draft);});
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<StrictMode><QueryClientProvider client={client}><ServicesContext.Provider value={f.services}><ApplicationWizardScreen jobId={jobId}/></ServicesContext.Provider></QueryClientProvider></StrictMode>);
  await screen.findByRole("heading",{name:"Contact details"});
  expect(f.api.create).toHaveBeenCalledTimes(1);
});
