import {describe, expect, it} from "vitest";
import examples from "../../contracts/examples/job-module-v2.json";
import rules from "../../contracts/validation/job-v2.json";
import oldRules from "../../contracts/validation/job.json";
import spec from "../../contracts/openapi/job-module-v2.json";
import {EMPTY_NOTICE, compensationV2Schema, jobV2DraftSchema, jobV2Errors, jobV2StageAdvanceSchema, jobV2PublishRequestSchema, moneyMinor, publicCompensationV2, type JobValuesV2} from "@/lib/validation/job-v2";
import {jobValuesToLegacy, jobValuesToV2} from "@/lib/domain/job-v2-compatibility";
import {jobV2FormToApi} from "@/lib/domain/job-v2-form";
import {importCancelSchema, importDraftSelectionSchema, importFileSchema, importMappingSchema, importPositionReviewSchema, importSplitsSchema, importStartSchema} from "@/lib/validation/job-import";
import {jobPublishSchema} from "@/lib/validation/job";
import type {JobWizardValues} from "@/types/domain";

function merge(base: Record<string,unknown>, patch: Record<string,unknown>): Record<string,unknown> {
  const result = structuredClone(base);
  for(const [key,value] of Object.entries(patch)) result[key] = value !== null && !Array.isArray(value) && typeof value === "object" ? merge((result[key] ?? {}) as Record<string,unknown>,value as Record<string,unknown>) : structuredClone(value);
  return result;
}
const base = () => structuredClone(examples.base) as JobValuesV2;
describe("shared J1 examples",()=>{
  it.each(examples.cases)("$name", test=>{
    const value = merge(examples.base, test.patch);
    const mode = test.mode === "stage" ? test.stage! : test.mode as "draft"|"publish";
    expect(Object.keys(jobV2Errors(value,mode)).length === 0).toBe(test.valid);
  });
});
it("uses the server timezone allowlist and accepts date-only deadlines on a skipped midnight",()=>{
  const deadline = (date: string, timezone: string, time: string | null = null) => jobV2Errors({...base(), deadline: {date, time, timezone, offset: null}}, "draft");
  expect(deadline("2027-01-15", "Asia/Kolkata")).toEqual({});
  for (const alias of ["Asia/Calcutta", "US/Eastern", "asia/kolkata"]) expect(deadline("2027-01-15", alias)).toHaveProperty(["deadline"]);
  expect(deadline("2027-09-05", "America/Santiago")).toEqual({});
  expect(deadline("2027-09-05", "America/Santiago", "00:30")).toHaveProperty(["deadline"]);
});
it("validates optional recruitment notice details and fills them for older drafts",()=>{
  const {notice: _omitted, ...older} = base();
  expect(jobV2DraftSchema.parse(older).notice).toEqual(EMPTY_NOTICE);
  const withNotice = (patch: Partial<JobValuesV2["notice"]>, deadline: JobValuesV2["deadline"] = null) => jobV2Errors({...base(), deadline, notice: {...EMPTY_NOTICE, ...patch}}, "draft");
  expect(withNotice({ageLimit: "18–32 years", noticeUrl: "https://example.gov.in/notice.pdf", opensOn: "2026-11-01"})).toEqual({});
  expect(withNotice({noticeUrl: "javascript:alert(1)"})).toHaveProperty(["notice.noticeUrl"]);
  expect(withNotice({opensOn: "2026-02-30"})).toHaveProperty(["notice.opensOn"]);
  expect(withNotice({opensOn: "2026-12-02"}, {date: "2026-12-01", time: null, timezone: "Asia/Kolkata", offset: null})).toHaveProperty(["notice.opensOn"]);
  expect(()=>jobValuesToLegacy({...base(), notice: {...EMPTY_NOTICE, ageLimit: "21–30"}},"legacy-draft")).toThrow();
});
it("converts INR LPA exactly once, leaves stored annual units unchanged and round trips",()=>{
  const legacy=structuredClone(examples.legacy) as JobWizardValues, before=structuredClone(legacy);
  const converted=jobValuesToV2(legacy,"legacy-draft");
  expect(converted).toEqual(examples.base);
  expect(jobValuesToV2(converted,"v2")).toEqual(converted);
  expect(()=>jobValuesToV2(converted,"legacy-draft")).toThrow();
  const roundTrip=jobValuesToLegacy(converted,"legacy-draft");
  expect(roundTrip).toEqual({...legacy,salaryMin:"10.00",salaryMax:"20.00"});
  expect(jobValuesToV2(roundTrip,"legacy-draft")).toEqual(converted);
  expect(jobValuesToV2({...legacy,salaryMin:"1000000",salaryMax:"2000000"},"legacy-stored")).toEqual(converted);
  expect(legacy).toEqual(before);
  expect(jobValuesToV2({...legacy,currency:"USD",salaryMin:"50000",salaryMax:"60000"},"legacy-draft").compensation.minAmount).toBe("50000.00");
});
it("preserves hidden values, blank bounds, variable pay and legacy deadline meaning",()=>{
  const input={...examples.legacy,experienceMax:"",vacancies:"",hideSalary:true,variableEnabled:true,variablePercent:"10.25",expiresAt:"2026-11-06"} as JobWizardValues;
  const value=jobValuesToV2(input,"legacy-draft");
  expect(value.experienceMax).toBeNull(); expect(value.vacancies).toBeNull();
  expect(value.compensation).toMatchObject({hidden:true,variableEnabled:true,variablePercent:"10.25"});
  expect(value.deadline).toEqual({date:"2026-11-06",time:null,timezone:"UTC",offset:null});
  expect(publicCompensationV2(value.compensation)).toEqual({disclosure:"undisclosed"});
  expect(jobValuesToLegacy(value,"legacy-draft")).toEqual({...input,salaryMin:"10.00",salaryMax:"20.00"});
});
it("refuses annual v1 fallback for monthly pay, new classifications and unrepresentable precision",()=>{
  expect(()=>jobValuesToLegacy({...base(),compensation:{...base().compensation,period:"month"}},"legacy-draft")).toThrow();
  expect(()=>jobValuesToLegacy({...base(),vacancies:1000},"legacy-draft")).toThrow();
  expect(()=>jobValuesToLegacy({...base(),compensation:{...base().compensation,minAmount:"1.01"}},"legacy-draft")).toThrow();
  expect(()=>jobValuesToV2({...examples.legacy,salaryMin:"1000000000000"} as JobWizardValues,"legacy-draft")).toThrow();
  expect(()=>jobValuesToLegacy({...base(),education:["CA"]},"legacy-draft")).toThrow();
  expect(()=>jobValuesToLegacy({...base(),employment:"Deputation"},"legacy-draft")).toThrow();
});
it("preserves partially entered and inactive legacy variable-pay fields without manufacturing amounts",()=>{
  for(const variableEnabled of [false,true]) {
    const legacy={...examples.legacy,salaryMin:"",salaryMax:"",variablePercent:"10.25",variableEnabled} as JobWizardValues;
    const converted=jobValuesToV2(legacy,"legacy-draft");
    expect(converted.compensation).toMatchObject({minAmount:null,maxAmount:null,variableEnabled,variablePercent:"10.25"});
    expect(jobValuesToLegacy(converted,"legacy-draft")).toEqual(legacy);
  }
  const value=jobValuesToV2({...examples.legacy,salaryMin:"0.29",salaryMax:"0.31"} as JobWizardValues,"legacy-draft");
  expect(value.compensation).toMatchObject({minAmount:"29000.00",maxAmount:"31000.00"});
});
it("keeps draft saving, stage advancement and final publication separate",()=>{
  const values={...base(),description:"",responsibilities:"",requirements:"",skills:[],essentialSkills:[]};
  const request={values,version:1,jobVersion:1,step:1,reached:1};
  expect(jobV2StageAdvanceSchema.safeParse(request).success).toBe(true);
  expect(jobV2StageAdvanceSchema.safeParse({...request,step:2,reached:2}).success).toBe(false);
  expect(jobV2StageAdvanceSchema.safeParse({...request,step:3,reached:1}).success).toBe(false);
  expect(jobV2PublishRequestSchema.safeParse(request).success).toBe(false);
  expect(jobV2PublishRequestSchema.safeParse({...request,values:base()}).success).toBe(true);
  const generated={mode:"template-demo",role:"Developer",at:"2026-10-28T00:00:00Z"};
  expect(jobV2PublishRequestSchema.safeParse({...request,values:base(),generated}).success).toBe(false);
  expect(jobV2PublishRequestSchema.safeParse({...request,values:{...base(),aiVerified:true},generated}).success).toBe(true);
});
it("normalizes form blanks without inventing zero, validates before transport and handles aliases",()=>{
  const input={...base(),experienceMin:"",experienceMax:"",vacancies:"",education:["Class 10"],compensation:{...base().compensation,minAmount:"10.25",maxAmount:"20.1"}};
  const draft=jobV2FormToApi(input);
  expect(draft).toMatchObject({experienceMin:null,experienceMax:null,vacancies:null,education:["Class 10 / SSLC"],compensation:{minAmount:"10.25",maxAmount:"20.10"}});
  expect(()=>jobV2FormToApi(input,"publish")).toThrow();
  for(const experienceMin of ["NaN","Infinity","0.5","-1",true]) expect(()=>jobV2FormToApi({...base(),experienceMin})).toThrow();
  expect(()=>moneyMinor("01.00")).toThrow(); expect(()=>moneyMinor("1000000000000.01")).toThrow();
  expect(()=>compensationV2Schema.parse({...base().compensation,variablePercent:"bad"})).toThrow();
});
it("returns only the disclosure label for hidden schedules and does not mutate private values",()=>{
  const c=structuredClone(base().compensation);c.hidden=true;c.notes="Private negotiation details";c.schedule=[];
  const before=structuredClone(c);
  expect(JSON.stringify(publicCompensationV2(c))).toBe('{"disclosure":"undisclosed"}');expect(c).toEqual(before);
});
it("keeps legacy validation unchanged and marks only J3 endpoints implemented",()=>{
  expect(jobPublishSchema.safeParse(examples.legacy).success).toBe(true);
  expect(jobPublishSchema.safeParse({...examples.legacy,experienceMax:""}).success).toBe(false);
  expect(oldRules.employment).toEqual(rules.employment.slice(0,4));
  for(const path of Object.values(spec.paths)) for(const operation of Object.values(path)) expect(operation["x-implemented"]).toBe(operation["x-implementation-phase"]==="J3");
  expect(spec.components.schemas.JobDraftValuesV2.properties.schemaVersion.const).toBe(2);
  expect(jobV2DraftSchema.safeParse({...base(),schemaVersion:3}).success).toBe(false);
});

const id="00000000-0000-4000-8000-000000000001";
it("validates import inputs without accepting ownership, status or review shortcuts",()=>{
  const start={sourceAssetId:id,idempotencyKey:id}; expect(importStartSchema.safeParse(start).success).toBe(true);
  expect(importStartSchema.safeParse({...start,organizationId:id}).success).toBe(false);
  expect(importFileSchema.safeParse({name:"jobs.xlsx",bytes:1024}).success).toBe(true);
  for(const file of [{name:"jobs.xlsm",bytes:100},{name:"../jobs.xlsx",bytes:100},{name:"jobs.xlsx",bytes:0},{name:"jobs.xlsx",bytes:10485761}]) expect(importFileSchema.safeParse(file).success).toBe(false);
  const mapping={version:1,sheet:"All researched entries",headerRow:1,preset:"tn-government-research",timezone:"Asia/Kolkata",columns:{title:4,sourceId:1}};
  expect(importMappingSchema.safeParse(mapping).success).toBe(true);
  expect(importMappingSchema.safeParse({...mapping,columns:{sourceId:1}}).success).toBe(false);
  expect(importMappingSchema.safeParse({...mapping,timezone:"Invalid/Zone"}).success).toBe(false);
  const review={version:1,values:base(),resolutions:[]};expect(importPositionReviewSchema.safeParse(review).success).toBe(true);
  expect(importPositionReviewSchema.safeParse({...review,verified:true,canPublish:true}).success).toBe(false);
  const selection={version:1,idempotencyKey:id,positions:[{id,version:1}]};expect(importDraftSelectionSchema.safeParse(selection).success).toBe(true);
  expect(importDraftSelectionSchema.safeParse({...selection,positions:[{id,version:1},{id,version:2}]}).success).toBe(false);
  expect(importCancelSchema.safeParse({version:0}).success).toBe(false);
  expect(importSplitsSchema.safeParse({version:1,rowId:id,positions:[{sourcePositionKey:"case-worker",values:base()}]}).success).toBe(true);
});
