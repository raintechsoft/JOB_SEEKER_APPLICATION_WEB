import { afterEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { CompensationFilter, withoutCompensation } from "@/features/search/compensation-filter";
import { SearchSubFilterBar } from "@/features/search/search-filter-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServicesContext } from "@/hooks/use-services";
import type { Services } from "@/services";
import { ApplyButton } from "@/features/feed/job-details-sheet";
import { scopedSearchSchema, searchOptionsFromUrl, searchPageUrl } from "@/lib/search/scopes";
import { jobSearchSchema, recommendationQuerySchema } from "@/lib/validation/search";
import { managedJobsSchema } from "@/lib/validation/recruiting";
import { createHttpClient } from "@/services/api/client";
import { createHttpJobsService } from "@/services/jobs/jobs.http";
import { createHttpSearchService } from "@/services/search/search.http";
import type { AuthService } from "@/services/auth/auth.service";
import { getDb } from "@/mocks/store/demo-db";
import { isOpenJob, matchesAlert } from "@/lib/domain/jobs";
import { matchesJobDiscovery, jobPayReference } from "@/lib/domain/job-discovery";
import { jobValuesToV2 } from "@/lib/domain/job-v2-compatibility";
import { validJob } from "../fixtures/job";
import { filterPopoverPosition } from "@/lib/search/popover-position";
import { publicCompensationV2 } from "@/lib/validation/job-v2";
import { JobValueSummary } from "@/components/jobs/job-value-summary";

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
const query={role:"professional" as const,scope:"jobs" as const,q:"Engineer"};
const pay={salaryMin:18000.25,salaryMax:22000.50,currency:"INR",compensationPeriod:"month"};

it("renders the actual public specified-pay projection and still hides private components",()=>{
  const compensation=jobValuesToV2(validJob,"legacy-draft").compensation;
  Object.assign(compensation,{kind:"stipend",period:"month",minAmount:"18000.25",maxAmount:"22000.50",notes:"Travel reimbursement",allowances:[{label:"Travel",amount:"120.25",percent:null}]});
  const shown=render(<JobValueSummary compensation={publicCompensationV2(compensation)}/>);
  expect(screen.getByText("Stipend: INR 18000.25–22000.50 per month + allowances")).toBeVisible();
  expect(screen.getByText("Travel: INR 120.25")).toBeVisible();
  expect(screen.getByText("Travel reimbursement")).toBeVisible();
  shown.rerender(<JobValueSummary compensation={publicCompensationV2({...compensation,hidden:true})}/>);
  expect(screen.getByText("Compensation not disclosed")).toBeVisible();
  expect(screen.queryByText(/18000|120.25|reimbursement/)).not.toBeInTheDocument();
});

it("accepts new classifications, exact pay context and legacy annual filters while rejecting ambiguous or malformed numeric filters",()=>{
  expect(jobSearchSchema.safeParse({q:"",page:1,employment:"Apprenticeship",education:"ITI",...pay}).success).toBe(true);
  expect(jobSearchSchema.safeParse({q:"",page:1,salaryMin:1,currency:"INR"}).success).toBe(true);
  for(const invalid of [{...pay,salaryMin:1.001},{...pay,compensationPeriod:"fortnight"},{...pay,currency:undefined},{sort:"salary_asc"},{sort:"salary_desc",currency:"INR"}]){
    expect(jobSearchSchema.safeParse({q:"",page:1,...invalid}).success).toBe(false);
    expect(scopedSearchSchema.safeParse({...query,...invalid}).success).toBe(false);
  }
  expect(scopedSearchSchema.safeParse({...query,...pay,sort:"salary_asc",education:"Class 10 / SSLC"}).success).toBe(true);
  expect(scopedSearchSchema.safeParse({...query,scope:"people",...pay}).success).toBe(false);
  expect(scopedSearchSchema.safeParse({...query,scope:"people",sort:"salary_desc",currency:"INR",compensationPeriod:"month"}).success).toBe(false);
  expect(recommendationQuerySchema.safeParse({identity:crypto.randomUUID(),surface:"jobs",limit:21}).success).toBe(false);
  expect(managedJobsSchema.safeParse({drafts:false,q:"",statuses:[],categories:["Full-time","Part-time","Contract","Internship","Apprenticeship","Consultancy","Deputation","Empanelment"],location:"",days:0,sort:"newest",page:1,pageSize:10}).success).toBe(true);
});

it("round trips compensation URL state and removes comparison context as a unit",()=>{
  const options={...pay,sort:"salary_desc" as const,education:"ITI",experienceMin:2};
  const url=searchPageUrl("professional","Engineer","jobs",options);
  expect(searchOptionsFromUrl(new URL(url,"https://example.test").searchParams)).toEqual(options);
  expect(scopedSearchSchema.safeParse({...query,...searchOptionsFromUrl(new URLSearchParams("salaryMin=&currency=INR&compensationPeriod=month"))}).success).toBe(false);
  expect(withoutCompensation(options)).toEqual({education:"ITI",experienceMin:2});
});

it("clears numeric sort together with its compensation context",()=>{
  const apply=vi.fn(()=>true),services={auth:{me:vi.fn().mockResolvedValue({selected_identity_id:null})}} as unknown as Services;
  render(<ServicesContext.Provider value={services}><QueryClientProvider client={new QueryClient()}><SearchSubFilterBar role="professional" scope="jobs" options={{...pay,sort:"salary_desc"}} onApply={apply}/></QueryClientProvider></ServicesContext.Provider>);
  fireEvent.click(screen.getByRole("button",{name:"Clear all filters"}));
  expect(apply).toHaveBeenCalledExactlyOnceWith({});
});

it("invalid direct/contextual pay queries cause no session reads or transport",async()=>{
  const http=createHttpClient("http://localhost:8000/api/v1"),get=vi.spyOn(http,"get");
  const auth={me:vi.fn()} as unknown as AuthService;
  await expect(createHttpJobsService(http).listOpportunities({q:"",page:1,salaryMin:1})).rejects.toThrow();
  await expect(createHttpSearchService(http,auth).query({...query,sort:"salary_desc"})).rejects.toThrow();
  expect(auth.me).not.toHaveBeenCalled();expect(get).not.toHaveBeenCalled();
});

it("sends the explicit payment period, currency and classifications through typed job transport",async()=>{
  const http=createHttpClient("http://localhost:8000/api/v1"),get=vi.spyOn(http,"get").mockResolvedValue({data:[],meta:{total:0}});
  await createHttpJobsService(http).listOpportunities({q:"Engineer",page:1,...pay,education:"ITI",employment:"Apprenticeship",sort:"salary_asc"});
  expect(get).toHaveBeenCalledWith("jobs",expect.objectContaining({...pay,education:"ITI",employment:"Apprenticeship",sort:"salary_asc"}));
});

it("the compensation menu blocks reversed values and applies complete context once",()=>{
  const apply=vi.fn(()=>true);
  render(<CompensationFilter options={{}} onApply={apply}/>);
  fireEvent.click(screen.getByRole("button",{name:"Compensation filter"}));
  fireEvent.change(screen.getByRole("combobox",{name:/Currency/}),{target:{value:"INR"}});
  fireEvent.change(screen.getByRole("combobox",{name:/Payment period/}),{target:{value:"month"}});
  fireEvent.change(screen.getByRole("spinbutton",{name:/Minimum pay/}),{target:{value:"22000"}});
  fireEvent.change(screen.getByRole("spinbutton",{name:/Maximum pay/}),{target:{value:"18000"}});
  fireEvent.click(screen.getByRole("button",{name:"Apply compensation"}));
  expect(apply).not.toHaveBeenCalled();expect(screen.getByText("Maximum pay must be at least the minimum.")).toBeVisible();
  fireEvent.change(screen.getByRole("spinbutton",{name:/Maximum pay/}),{target:{value:"24000.25"}});
  fireEvent.click(screen.getByRole("button",{name:"Apply compensation"}));
  expect(apply).toHaveBeenCalledExactlyOnceWith({currency:"INR",compensationPeriod:"month",salaryMin:22000,salaryMax:24000.25});
});

it("Escape restores compensation trigger focus while outside-pointer dismissal preserves the clicked control",()=>{
  render(<><CompensationFilter options={{}} onApply={()=>true}/><button type="button">Another filter</button></>);
  const trigger=screen.getByRole("button",{name:"Compensation filter"});
  fireEvent.click(trigger);expect(screen.getByRole("combobox",{name:/Currency/})).toHaveFocus();
  fireEvent.keyDown(document,{key:"Escape"});
  expect(screen.queryByRole("dialog",{name:"Compensation filters"})).not.toBeInTheDocument();expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  const another=screen.getByRole("button",{name:"Another filter"});another.focus();fireEvent.pointerDown(another);
  expect(screen.queryByRole("dialog",{name:"Compensation filters"})).not.toBeInTheDocument();expect(another).toHaveFocus();
});

it("a mounted Apply button and alert match expire at the precise cutoff",()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-28T11:29:59Z"));
  const job={...structuredClone(getDb().social.jobs[0]),closed:false,draft:false,closesAt:"2026-10-28T11:30:00Z",expiresAt:"2026-10-28"};
  render(<ApplyButton job={job} applied={false} onApply={vi.fn()}/>);
  expect(screen.getByRole("button",{name:"Apply"})).toBeEnabled();
  act(()=>vi.advanceTimersByTime(1000));
  expect(screen.getByRole("button",{name:"Applications closed"})).toBeDisabled();expect(isOpenJob(job)).toBe(false);
  expect(matchesAlert(job,{id:"alert",name:"A",keywords:job.title,location:"",arrangement:"Any",days:90,enabled:true})).toBe(false);
});

it("legacy date-only jobs close at the following UTC midnight",()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-28T23:59:59Z"));
  const job={...structuredClone(getDb().social.jobs[0]),closed:false,draft:false,closesAt:null,expiresAt:"2026-10-28"};
  render(<ApplyButton job={job} applied={false} onApply={vi.fn()}/>);
  expect(screen.getByRole("button",{name:"Apply"})).toBeEnabled();act(()=>vi.advanceTimersByTime(1000));
  expect(screen.getByRole("button",{name:"Applications closed"})).toBeDisabled();
});

it("prototype matching preserves open-ended experience and excludes hidden/incompatible compensation",()=>{
  const values=jobValuesToV2(validJob,"legacy-draft");values.experienceMin=2;values.experienceMax=null;values.compensation.period="month";values.compensation.minAmount="18000.25";values.compensation.maxAmount="22000.50";
  const job={...structuredClone(getDb().social.jobs[0]),wizardValues:{education:["ITI"],experienceMin:2,experienceMax:""},employment:"Apprenticeship",compensation:values.compensation};
  expect(matchesJobDiscovery(job,{...pay,experience:20,education:"ITI"})).toBe(true);
  expect(matchesJobDiscovery(job,{...pay,compensationPeriod:"year"})).toBe(false);
  expect(jobPayReference({...job,compensation:{...values.compensation,hidden:true}},pay)).toBeNull();
  expect(matchesJobDiscovery({...job,compensation:{...values.compensation,format:"up_to",minAmount:null}}, {...pay,salaryMin:undefined,salaryMax:1000})).toBe(true);
});

it("legacy incomplete compensation stays unknown instead of becoming a fixed amount",()=>{
  const job={...structuredClone(getDb().social.jobs[0]),hideSalary:false,compensation:undefined,wizardValues:{currency:"INR" as const,salaryMin:"10",salaryMax:"",hideSalary:false}};
  const context={currency:"INR",compensationPeriod:"year"};
  expect(jobPayReference(job,context)).toBeNull();
  expect(matchesJobDiscovery(job,{...context,salaryMin:1})).toBe(false);
  expect(jobPayReference({...job,wizardValues:{...job.wizardValues,salaryMin:"",salaryMax:"20"}},context)).toBeNull();
});

it("keeps a compensation popup inside the mobile viewport when its trigger is near the right or bottom edge",()=>{
  const position=filterPopoverPosition({left:178.109,bottom:731.56},561,{width:390,height:844});
  expect(position).toEqual({left:34,top:267,width:340,maxHeight:812});
  expect(position.left+position.width).toBeLessThanOrEqual(390-16);
  expect(position.top+561).toBeLessThanOrEqual(844-16);
  const keyboard=filterPopoverPosition({left:178,bottom:731},561,{width:320,height:320,top:40});
  expect(keyboard.width).toBe(288);expect(keyboard.top).toBe(56);expect(keyboard.maxHeight).toBe(288);
});
