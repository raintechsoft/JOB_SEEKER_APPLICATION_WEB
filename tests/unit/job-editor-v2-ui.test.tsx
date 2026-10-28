import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServicesContext } from "@/hooks/use-services";
import { createServices } from "@/services";
import { Wizard } from "@/features/job-wizard/job-wizard-screen";
import { jobValuesToV2 } from "@/lib/domain/job-v2-compatibility";
import { jobEditorValues } from "@/lib/domain/job-editor";
import { validJob } from "../fixtures/job";
import type { JobDraftContext } from "@/services/job-posts/job-posts.service";
import { ApiError } from "@/services/api/client";
const nav = vi.hoisted(()=>({push:vi.fn(),replace:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>nav,useSearchParams:()=>new URLSearchParams()}));

function mount(step=0) {
  Element.prototype.scrollIntoView=vi.fn();
  vi.stubGlobal("matchMedia",vi.fn(()=>({matches:false})));
  vi.spyOn(window,"scrollTo").mockImplementation(()=>{});
  const services=createServices();
  const store=vi.fn().mockResolvedValue(true),publish=vi.fn().mockResolvedValue(true),save=vi.fn().mockResolvedValue({ok:true});
  Object.assign(services.jobPosts,{storeJobDraft:store,publishJob:publish,saveJobAsDraft:save});
  const v=jobValuesToV2(validJob,"legacy-draft");v.experienceMax=null;v.vacancies=null;
  const ctx:JobDraftContext={key:"test",companyId:"test",companyName:"Test",editingPublished:false,draft:{id:"test",existingId:"",step,reached:step,values:jobEditorValues(v),savedAt:"",version:1,jobVersion:1}};
  render(<ServicesContext.Provider value={services}><QueryClientProvider client={new QueryClient()}><Wizard ctx={ctx}/></QueryClientProvider></ServicesContext.Provider>);
  return {store,publish,save};
}
it("retains values and stays on the current stage when the server rejects a valid local input",async()=>{
  const {store}=mount();
  store.mockRejectedValueOnce(new ApiError("invalid",422,{message:"Check the entered pay.",errors:{"compensation.maxAmount":["Please confirm this amount."]}}));
  fireEvent.submit(document.getElementById("job-wizard-form")!);
  expect((await screen.findAllByText("Please confirm this amount."))[0]).toBeVisible();
  expect(document.getElementById("job-wizard-form")).toHaveAttribute("data-step","0");
  expect(screen.getByRole("textbox",{name:/Maximum amount/})).toHaveValue("2000000.00");
});
it("uses conditional pay controls and blocks invalid advancing and autosave before services", async()=>{
  const {store,publish}=mount();
  fireEvent.change(screen.getByRole("combobox",{name:/Compensation format/}),{target:{value:"fixed"}});
  expect(screen.queryByRole("textbox",{name:/Maximum amount/})).not.toBeInTheDocument();
  fireEvent.submit(document.getElementById("job-wizard-form")!);
  expect(await screen.findAllByText("This field is required.")).not.toHaveLength(0);
  fireEvent.change(screen.getByRole("textbox",{name:/^Amount/}),{target:{value:"-1"}});
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,800));});
  expect(store).not.toHaveBeenCalled();expect(publish).not.toHaveBeenCalled();
});
it("advances a valid minimum-only job with unknown vacancy count",async()=>{
  const {store}=mount();
  fireEvent.submit(document.getElementById("job-wizard-form")!);
  expect(await screen.findByRole("heading",{name:"Preferred candidate details"})).toBeVisible();
  expect(store).toHaveBeenCalledTimes(1);
  expect(store.mock.calls[0][1].values).toMatchObject({experienceMax:"",vacancies:""});
});
it("validates malformed precise deadlines before draft saving",async()=>{
  const {store,save}=mount(4);
  fireEvent.change(screen.getByLabelText(/Closing date/),{target:{value:"2027-03-14"}});
  fireEvent.change(screen.getByLabelText(/Closing timezone/),{target:{value:"America/New_York"}});
  fireEvent.change(screen.getByLabelText(/Closing time\b/),{target:{value:"02:30"}});
  fireEvent.click(screen.getByRole("button",{name:"Save draft & exit"}));
  expect(await screen.findAllByText(/ambiguous closing time/)).not.toHaveLength(0);
  expect(store).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();
});
