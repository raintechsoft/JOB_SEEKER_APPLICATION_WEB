import { expect,it } from "vitest";
import { jobDraftValuesSchema,jobErrors,jobPublishSchema,validateJobFiles } from "@/lib/validation/job";
import { applicationSchema,bulkIdsSchema,trackingSchema } from "@/lib/validation/application";
import {validJob} from "../fixtures/job";


it("distinguishes incomplete drafts, individual wizard stages and final publishing",()=>{
  expect(jobPublishSchema.safeParse(validJob).success).toBe(true);
  const incomplete={...validJob,title:"",salaryMin:"",salaryMax:"",skills:[],essentialSkills:[],description:""};
  expect(jobDraftValuesSchema.safeParse(incomplete).success).toBe(true);
  expect(jobErrors(incomplete,0)).toHaveProperty("salaryMin");
  expect(jobErrors(incomplete,1)).toHaveProperty("skills");
  expect(jobPublishSchema.safeParse(incomplete).success).toBe(false);
});
it("blocks supplied malformed values even in drafts, unordered ranges, duplicates, stale dates and unsafe media",()=>{
  for(const patch of [{experienceMin:"NaN"},{experienceMin:0.5},{experienceMin:8},{salaryMax:"2"},{skills:["PHP","php"]},{essentialSkills:["SQL"]},{expiresAt:"2027-02-31"},{jobMedia:{video:"javascript:alert(1)",files:[]}},{thumbnail:{...validJob.thumbnail,image:"data:image/png;base64,abc"}}])expect(jobDraftValuesSchema.safeParse({...validJob,...patch}).success).toBe(false);
  expect(validateJobFiles([new File(["x"],"cover.pdf",{type:"application/pdf"})],[],true)).toBeTruthy();
  expect(validateJobFiles([new File(["x"],"cover.png",{type:"image/png"})],[],true)).toBeNull();
});
it("validates required and conditional screening answers, explicit sharing and recruiting details",()=>{
  const q={id:"00000000-0000-4000-8000-000000000001",text:"Years?",type:"number" as const,required:true,ideal:""};
  const input={jobId:q.id,name:"Applicant",email:"a@example.test",note:"",portfolio:true,recruitmentDetails:{},answers:{[q.id]:"2"}};
  const schema=applicationSchema([q],true);
  expect(schema.safeParse(input).success).toBe(true);
  for(const patch of [{portfolio:false},{answers:{}},{answers:{[q.id]:"Infinity"}},{recruitmentDetails:{noticeDays:"1.5"}},{recruitmentDetails:{phone:"bad"}}])expect(schema.safeParse({...input,...patch}).success).toBe(false);
  expect(bulkIdsSchema.safeParse([q.id,q.id]).success).toBe(false);
  expect(trackingSchema.safeParse({status:"Hired",followUp:"",trackingNote:""}).success).toBe(false);
});
