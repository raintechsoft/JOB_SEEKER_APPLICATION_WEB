import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {ServicesContext} from "@/hooks/use-services";
import type {Services} from "@/services";
import {ApplicationSharingDetails,sharedPayLabel} from "@/features/applications/application-sharing-details";
import {ApplicationDraftList} from "@/features/applications/application-draft-list";
import {downloadBlob} from "@/lib/utils/files";
import {ApiError} from "@/services/api/client";
vi.mock("@/lib/utils/files",()=>({downloadBlob:vi.fn()}));
vi.mock("next/link",()=>({default:({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a href={String(href)} {...props}>{children}</a>}));
const id="10000000-0000-4000-8000-000000000001",attachment="10000000-0000-4000-8000-000000000002";
const sharing={schemaVersion:2 as const,expectedCompensation:{currency:"INR" as const,period:"month" as const,amount:"29000.50"},verification:{email:{verifiedAt:"2026-10-28T10:00:00Z",source:"account" as const},phone:null},attachments:[{id:attachment,name:"resume.pdf",mime:"application/pdf",bytes:100,kind:"resume" as const}],portfolio:null};
afterEach(()=>{cleanup();vi.clearAllMocks();});
function wrap(content:React.ReactNode,overrides:Partial<Services>) {
  return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ServicesContext.Provider value={overrides as Services}>{content}</ServicesContext.Provider></QueryClientProvider>);
}
it("keeps the selected payment basis and downloads only through the scoped reviewer service",async()=>{
  const reviewerDownload=vi.fn().mockResolvedValue(new Blob(["synthetic"]));
  const auth={me:vi.fn().mockResolvedValue({selected_identity_id:id,workspaces:[{id,kind:"recruiter",organization:{id}}]})};
  wrap(<ApplicationSharingDetails sharing={sharing} applicationId={id} reviewer/>,{auth,applicationDocuments:{reviewerDownload}} as unknown as Partial<Services>);
  expect(screen.getByText("Expected pay: INR 29000.50 / month")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Download submitted resume: resume.pdf"}));
  await waitFor(()=>expect(reviewerDownload).toHaveBeenCalledWith(id,id,attachment));await waitFor(()=>expect(downloadBlob).toHaveBeenCalledTimes(1));
  expect(sharedPayLabel(null)).toBe("Not shared");
});
it("surfaces lost reviewer access without claiming a successful download",async()=>{
  const reviewerDownload=vi.fn().mockRejectedValue(new ApiError("Denied",404,{message:"This document is unavailable."}));
  wrap(<ApplicationSharingDetails sharing={sharing} applicationId={id} reviewer/>,{auth:{me:vi.fn().mockResolvedValue({selected_identity_id:id,workspaces:[{id,kind:"recruiter",organization:{id}}]})},applicationDocuments:{reviewerDownload}} as unknown as Partial<Services>);
  fireEvent.click(screen.getByRole("button",{name:"Download submitted resume: resume.pdf"}));await screen.findByText("This document is unavailable.");expect(downloadBlob).not.toHaveBeenCalled();
});
it("lists private drafts separately with a typed resume link and no applied-count mutation",async()=>{
  const list=vi.fn().mockResolvedValue({items:[{id,jobId:id,title:"Draft role",companyName:"Synthetic Team",step:"contact",state:"active",version:1,savedAt:"2026-10-28T10:00:00Z",expiresAt:"2026-11-28T10:00:00Z"}],total:1,page:1,pageSize:20});
  wrap(<ApplicationDraftList/>,{applicationWizard:{list}} as unknown as Partial<Services>);
  await screen.findByRole("table",{name:"Draft applications"});expect(screen.getByText("Synthetic Team · Next step: Contact details")).toBeInTheDocument();expect(screen.getByRole("link",{name:"Resume application for Draft role"}).getAttribute("href")).toContain(`/app/jobs/${id}/apply?returnTo=`);expect(list).toHaveBeenCalledWith({page:1,pageSize:20});
});
