import {z} from "zod";
import rules from "../../../contracts/validation/search.json";
import { compensationQueryShape, compensationQueryErrors } from "./job-discovery";

export const jobSearchSchema=z.object({
  q:z.string().trim().max(rules.queryMax),page:z.number().int().min(1).max(rules.pageMax),
  pageSize:z.number().int().min(1).max(rules.pageSizeMax).optional(),
  arrangement:z.enum(rules.arrangements).optional(),employment:z.enum(rules.employment).optional(),
  location:z.string().trim().max(200).optional(),skill:z.string().trim().max(100).optional(),
  experience:z.number().min(0).max(60).optional(),
  ...compensationQueryShape,
  education:z.enum(rules.education).optional(),
  sort:z.enum(rules.jobSorts).optional(),
}).superRefine((v,ctx)=>{
  for(const[key,message]of Object.entries(compensationQueryErrors(v)))ctx.addIssue({code:"custom",path:[key],message});
});
export type JobSearchInput=z.infer<typeof jobSearchSchema>;
export const recommendationQuerySchema=z.object({identity:z.uuid(),surface:z.enum(["jobs","feed","talent"]),limit:z.number().int().min(1).max(rules.recommendationLimit)});
