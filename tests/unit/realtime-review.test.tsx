import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {ReviewEditor} from "@/features/recruiting/review-dialog";
import {ServicesContext} from "@/hooks/use-services";
import type {Services} from "@/services";
import type {ReviewView} from "@/services/recruiting/recruiting.service";

afterEach(cleanup);
it("preserves a reviewer's notes on another reviewer's change and requires explicit reload",()=>{
  const save=vi.fn(),cache=new QueryClient(),services={recruiting:{saveReview:save}} as unknown as Services;
  const initial={application:{id:"a",version:1,status:"New",recruiterNote:"Stored note",followUp:"",note:"",withdrawnAt:null},person:{id:"p",name:"Synthetic candidate",headline:"Engineer",picture:""},jobTitle:"Synthetic role"} as ReviewView;
  const wrapper=(data:ReviewView)=><QueryClientProvider client={cache}><ServicesContext.Provider value={services}><ReviewEditor initialData={data}/></ServicesContext.Provider></QueryClientProvider>;
  const view=render(wrapper(initial));fireEvent.change(screen.getByRole("textbox",{name:"Private hiring notes"}),{target:{value:"My unsaved review"}});
  view.rerender(wrapper({...initial,application:{...initial.application,version:2,recruiterNote:"Remote review",status:"Reviewing"}}));
  expect(screen.getByRole("textbox",{name:"Private hiring notes"})).toHaveValue("My unsaved review");expect(screen.getByRole("button",{name:"Save review"})).toBeDisabled();
  fireEvent.submit(document.querySelector("#recruiter-review-form")!);expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Reload current review"}));
  expect(screen.getByRole("textbox",{name:"Private hiring notes"})).toHaveValue("Remote review");expect(screen.getByRole("combobox",{name:/Hiring status/})).toHaveValue("Reviewing");expect(screen.getByRole("button",{name:"Save review"})).toBeEnabled();
  cache.clear();
});
