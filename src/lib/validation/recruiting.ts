import {z} from "zod";
import rules from "../../../../../contracts/validation/recruiting.json";
export const RECRUITING_RULES=rules;
export const responseFiltersSchema=z.record(z.string(),z.string()).superRefine((v,ctx)=>{
  const error=(path:string,message:string)=>ctx.addIssue({code:"custom",path:[path],message});
  for(const[key,max]of Object.entries(rules.text))if((v[key]?.length??0)>max)error(key,`Use at most ${max} characters.`);
  for(const[key,max]of Object.entries(rules.numbers)){if(!v[key])continue;if(["notice","joining"].includes(key)&&v[key]==="90+")continue;if(!/^\d+(?:\.\d+)?$/.test(v[key])||Number(v[key])>max)error(key,`Enter a number from 0 to ${max}.`);}
  for(const[key,choices]of Object.entries({stage:rules.tabs,sort:rules.sorts,keywordMode:["any","all"],fit:["0","1"]}))if(v[key]&&!choices.includes(v[key]))error(key,"Choose an available option.");
  for(const[min,max]of [["expMin","expMax"],["salaryMin","salaryMax"]])if(v[min]&&v[max]&&Number(v[min])>Number(v[max]))error(max,"The maximum must be at least the minimum.");
  if(v.job&&!z.uuid().safeParse(v.job).success)error("job","Choose an available job.");
  if(v.distance&&!v.job)error("distance","Choose a job before filtering distance.");
  for(const[key,min,max]of [["page",1,10000],["size",1,40],["threshold",0,100]] as const)if(v[key]&&(!/^\d+$/.test(v[key])||Number(v[key])<min||Number(v[key])>max))error(key,`Enter a whole number from ${min} to ${max}.`);
  if(v.size&&!["10","20","40"].includes(v.size))error("size","Choose 10, 20 or 40 results.");
});
export const managedJobsSchema=z.object({drafts:z.boolean(),q:z.string().max(200),statuses:z.array(z.enum(["Draft","Closed","Expired","Active"])).max(4),categories:z.array(z.enum(["Full-time","Part-time","Contract","Internship"])).max(4),location:z.string().max(200),days:z.number().int().min(0).max(730),sort:z.enum(["newest","oldest","responses"]),page:z.number().int().min(1).max(10000),pageSize:z.number().int().min(1).max(100)});
