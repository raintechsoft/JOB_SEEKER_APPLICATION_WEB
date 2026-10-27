import {z} from "zod";
import contract from "../../../contracts/analytics/events.json";
const types:Record<string,z.ZodType>={surface:z.enum(contract.surfaces),boolean:z.boolean(),optional_count:z.number().int().min(0).max(1000000).optional(),uuid:z.uuid(),job:z.uuid(),position:z.number().int().min(0).max(199)};
const variants=Object.entries(contract.browser).map(([name,fields])=>z.object({id:z.uuid(),name:z.literal(name),schemaVersion:z.literal(1),occurredAt:z.iso.datetime({offset:true}),properties:z.object(Object.fromEntries(Object.entries(fields).map(([key,type])=>[key,types[type]]))).strict()}).strict());
export const analyticsEventSchema=z.union(variants as [typeof variants[number],typeof variants[number],...typeof variants[number][]]);
export const analyticsBatchSchema=z.object({identityId:z.uuid(),events:z.array(analyticsEventSchema).min(1).max(contract.batchMax)}).strict();
export const analyticsConsentSchema=z.object({granted:z.boolean(),policyVersion:z.string().max(80),version:z.number().int().min(0)}).strict().refine((v)=>!v.granted||v.policyVersion.length>0,{path:["policyVersion"],message:"An approved analytics policy is required."});
