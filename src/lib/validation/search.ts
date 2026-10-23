import {z} from "zod";
import rules from "../../../../../contracts/validation/search.json";

export const jobSearchSchema=z.object({
  q:z.string().trim().max(rules.queryMax),page:z.number().int().min(1).max(rules.pageMax),
  pageSize:z.number().int().min(1).max(rules.pageSizeMax).optional(),
  arrangement:z.enum(rules.arrangements).optional(),employment:z.enum(rules.employment).optional(),
  location:z.string().trim().max(200).optional(),skill:z.string().trim().max(100).optional(),
  experience:z.number().min(0).max(60).optional(),
  salaryMin:z.number().min(0).max(1e12).optional(),salaryMax:z.number().min(0).max(1e12).optional(),
  currency:z.enum(rules.currencies).optional(),
}).superRefine((v,ctx)=>{
  if(v.salaryMin!==undefined&&v.salaryMax!==undefined&&v.salaryMin>v.salaryMax)ctx.addIssue({code:"custom",path:["salaryMax"],message:"The maximum must be at least the minimum."});
  if((v.salaryMin!==undefined||v.salaryMax!==undefined)&&!v.currency)ctx.addIssue({code:"custom",path:["currency"],message:"Choose a currency for salary filters."});
});
export type JobSearchInput=z.infer<typeof jobSearchSchema>;
export const recommendationQuerySchema=z.object({identity:z.uuid(),surface:z.enum(["jobs","feed","talent"]),limit:z.number().int().min(1).max(rules.recommendationLimit)});
