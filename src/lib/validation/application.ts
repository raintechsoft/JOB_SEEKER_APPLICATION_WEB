import { z } from "zod";
import rules from "../../../../../contracts/validation/application.json";
import type { ScreeningQuestion } from "@/types/domain";
import { calendarDate } from "./job";
import { today } from "@/lib/utils/date";

const text=(max:number)=>z.string().trim().refine((v)=>[...v].length<=max,`Use at most ${max} characters.`);
const optionalNumber=(max:number,integer=false)=>z.string().refine((v)=>!v || /^\d+(?:\.\d+)?$/.test(v)&&Number(v)<=max&&(!integer||/^(?:0|[1-9]\d*)$/.test(v)),`Enter ${integer?"a whole number":"a number"} from 0 to ${max}.`);
export const recruitmentDetailsSchema=z.object({location:text(200).optional(),locality:text(200).optional(),expectedSalaryLpa:optionalNumber(10000000).optional(),noticeDays:optionalNumber(365,true).optional(),joiningDays:optionalNumber(365,true).optional(),industry:text(100).optional(),designation:text(200).optional(),department:text(100).optional(),preferredLocations:text(500).optional(),phone:z.string().trim().refine((v)=>!v||/^[+()0-9\s.\-]{7,25}$/.test(v),"Enter a valid phone number.").optional()});
export const applicationSchema=(questions:ScreeningQuestion[],requirePortfolio:boolean)=>z.object({jobId:z.string().min(1),name:text(150).refine(Boolean,"Enter your name."),email:z.email().max(254),note:text(1500),portfolio:z.boolean(),recruitmentDetails:recruitmentDetailsSchema,answers:z.record(z.string(),text(rules.answerLength))}).superRefine((v,ctx)=>{
  if(requirePortfolio&&!v.portfolio)ctx.addIssue({code:"custom",path:["portfolio"],message:"This job requires a portfolio."});
  for(const key of Object.keys(v.answers))if(!questions.some((q)=>q.id===key))ctx.addIssue({code:"custom",path:["answers",key],message:"The screening questions changed. Reload the job."});
  for(const q of questions){const answer=v.answers[q.id]?.trim()||"";let message="";
    if(q.required&&!answer)message="Answer this required question.";
    else if(answer&&q.type==="yesno"&&!["Yes","No"].includes(answer))message="Choose Yes or No.";
    else if(answer&&q.type==="number"&&(!/^-?\d+(?:\.\d+)?$/.test(answer)||!Number.isFinite(Number(answer))||Math.abs(Number(answer))>1e12))message="Enter a number between −1 trillion and 1 trillion.";
    if(message)ctx.addIssue({code:"custom",path:["answers",q.id],message});
  }
});
export const followUp=z.string().refine((v)=>!v || calendarDate(v)&&v>=today()&&Date.parse(v)-Date.parse(today())<=730*86400000,"Choose a valid follow-up date within two years (UTC).");
export const trackingSchema=z.object({status:z.enum(["Applied","In review","Interview","Offer","Rejected","Withdrawn"]),followUp,trackingNote:text(rules.noteLength)});
export const reviewSchema=z.object({status:z.enum(["New","Reviewing","Shortlisted","Interview","Hired","Rejected"]),followUp,note:text(rules.noteLength)});
export const bulkIdsSchema=z.array(z.uuid()).min(1).max(rules.bulkMax).refine((ids)=>new Set(ids).size===ids.length,"Select distinct records.");
export const collaborationSchema=z.object({ids:bulkIdsSchema,emails:z.array(z.email().max(254)).max(50).refine((v)=>new Set(v.map((e)=>e.toLowerCase())).size===v.length,"Use distinct email addresses."),note:text(2000)});
export const outreachSchema=z.object({ids:bulkIdsSchema,subject:text(200).refine(Boolean,"Enter a subject."),message:text(10000).refine(Boolean,"Enter a message.")});
export const shortlistNameSchema=text(rules.shortlistNameLength).refine(Boolean,"Enter a list name.");
export const comparisonSchema=z.array(z.uuid()).min(1).max(rules.compareMax).refine((v)=>new Set(v).size===v.length,"Select distinct candidates.");
export const talentFiltersSchema=z.object({q:text(200),category:z.union([z.literal(""),z.enum(["Design","Engineering","Data","Business"])]),skill:text(100),location:text(200),years:z.enum(["","0-4","5-7","8+"]),availability:z.enum(["","available","Remote","Hybrid"]),completeness:z.boolean(),recent:z.boolean(),sort:z.enum(["relevance","recent","experience"])});
