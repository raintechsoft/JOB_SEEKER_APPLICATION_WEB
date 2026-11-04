import {z} from "zod";
import policy from "../../../contracts/validation/public-browsing.json";
import search from "../../../contracts/validation/global-search.json";
import {compensationQueryErrors, compensationQueryShape} from "./job-discovery";

export const PUBLIC_BROWSING_POLICY=policy;
const text=(max:number)=>z.string().refine(value=>!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value),"Use text without control characters.").trim().refine(value=>[...value].length<=max,`Use at most ${max} characters.`);
const numeric=(schema:z.ZodNumber)=>z.preprocess(value=>typeof value==="string"&&/^\d+(?:\.\d+)?$/.test(value)?Number(value):value,schema);
const size=(max:number)=>numeric(z.number().int().min(1).max(max));
const cursorValue=z.string().min(1).max(policy.limits.cursor).regex(new RegExp(policy.cursorPattern));
const cursor=cursorValue.optional();
export const publicEntryIdSchema=z.uuid();
export const publicFeedQuerySchema=z.object({filter:z.enum(["all","posts","jobs","updates"]).default("all"),sort:z.literal("recent").default("recent"),limit:size(policy.limits.pageSize).default(policy.limits.defaultPageSize),cursor}).strict();
export const publicCommentsQuerySchema=z.object({limit:size(policy.limits.commentPageSize).default(policy.limits.defaultPageSize),cursor,focus:z.uuid().optional()}).strict();
export const publicSearchScopeSchema=z.enum(["all","posts","companies","people","jobs","updates"]);
const filters={
  location:text(200).min(1).refine(value=>!/[\x00-\x1f\x7f]/.test(value)).optional(),skill:text(100).min(1).refine(value=>!/[\x00-\x1f\x7f]/.test(value)).optional(),industry:text(100).min(1).refine(value=>!/[\x00-\x1f\x7f]/.test(value)).optional(),
  companyType:z.enum(search.companyTypes as [string,...string[]]).optional(),arrangement:z.enum(search.arrangements as [string,...string[]]).optional(),
  employment:z.enum(search.employment as [string,...string[]]).optional(),education:z.enum(search.education as [string,...string[]]).optional(),
  contentType:z.enum(search.contentTypes as [string,...string[]]).optional(),author:z.uuid().optional(),
  days:numeric(z.number().int().min(1).max(365)).optional(),experienceMin:numeric(z.number().min(0).max(60)).optional(),experienceMax:numeric(z.number().min(0).max(60)).optional(),
  ...compensationQueryShape,
  salaryMin:z.preprocess(value=>typeof value==="string"&&/^\d+(?:\.\d+)?$/.test(value)?Number(value):value,compensationQueryShape.salaryMin),
  salaryMax:z.preprocess(value=>typeof value==="string"&&/^\d+(?:\.\d+)?$/.test(value)?Number(value):value,compensationQueryShape.salaryMax),
};
export const publicSearchQuerySchema=z.object({
  q:text(policy.limits.queryMax).transform(value=>value.replace(/\s+/gu," ")).refine(value=>[...value].length>=policy.limits.queryMin,"Enter at least two characters."),
  scope:publicSearchScopeSchema.default("all"),sort:z.enum(["relevance","recent","salary_asc","salary_desc"]).default("relevance"),
  limit:size(policy.limits.pageSize).default(policy.limits.defaultPageSize),cursor,selected:z.string().regex(/^(person|company|post|job|update):[0-9a-f-]{36}$/i).optional(),...filters,
}).strict().superRefine((value,ctx)=>{
  const allowed=search.filters[value.scope] as string[];
  for(const key of Object.keys(filters) as (keyof typeof filters)[])if(value[key]!==undefined&&!allowed.includes(key))ctx.addIssue({code:"custom",path:[key],message:"This filter is unavailable in this category."});
  if(value.experienceMin!==undefined&&value.experienceMax!==undefined&&value.experienceMin>value.experienceMax)ctx.addIssue({code:"custom",path:["experienceMax"],message:"Maximum experience must be at least the minimum."});
  if(value.sort.startsWith("salary_")&&value.scope!=="jobs")ctx.addIssue({code:"custom",path:["sort"],message:"Compensation sorting is available for jobs only."});
  for(const [key,message]of Object.entries(compensationQueryErrors(value)))ctx.addIssue({code:"custom",path:[key],message});
  if(value.selected){const [kind,id]=value.selected.split(":");if(!z.uuid().safeParse(id).success||!(search.selectionKinds[value.scope] as string[]).includes(kind))ctx.addIssue({code:"custom",path:["selected"],message:"Choose a public result in this category."});}
});

const uuidPattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const slug="[a-z0-9]+(?:-[a-z0-9]+)*";
export const publicResourcePathSchema=z.string().max(512).regex(new RegExp(`^/(?:feed/${uuidPattern}|jobs/${uuidPattern}|professionals/${slug}|organizations/${slug}|recruiters/${uuidPattern}|portfolio/${slug})$`));
export const publicExternalVideoSchema=z.object({position:z.number().int().min(0).max(199),url:z.string().max(2048).regex(new RegExp(policy.externalVideoUrlPattern)),name:text(180),alt:text(300)}).strict();
export const publicMediaSchema=z.object({id:z.uuid(),kind:z.enum(["image","video","document"]),mime:text(120).min(1),name:text(180).min(1),alt:text(300),downloadPath:z.string().regex(new RegExp(`^/api/v1/media/${uuidPattern}/download$`)),position:z.number().int().min(0).max(199).optional()}).strict().superRefine((value,ctx)=>{
  if(value.downloadPath!==`/api/v1/media/${value.id}/download`)ctx.addIssue({code:"custom",path:["downloadPath"],message:"The media path must match its resource."});
});
export const publicAuthorSchema=z.object({id:z.uuid(),kind:z.enum(["professional","recruiter"]),name:text(150).min(1),headline:text(300),profilePath:publicResourcePathSchema,picture:publicMediaSchema.nullable()}).strict().superRefine((value,ctx)=>{
  if(!value.profilePath.startsWith(value.kind==="professional"?"/professionals/":"/recruiters/"))ctx.addIssue({code:"custom",path:["profilePath"],message:"Choose the matching public profile path."});
  if(value.picture&&value.picture.kind!=="image")ctx.addIssue({code:"custom",path:["picture"],message:"Profile pictures must be images."});
});
export const publicCompanySchema=z.object({id:z.uuid().nullable(),name:text(150).min(1),profilePath:publicResourcePathSchema.nullable(),confidential:z.boolean(),logo:publicMediaSchema.nullable(),verified:z.boolean()}).strict().superRefine((value,ctx)=>{
  if(value.profilePath&&!value.profilePath.startsWith("/organizations/"))ctx.addIssue({code:"custom",path:["profilePath"],message:"Choose a public company path."});
  if(value.confidential&&(value.id!==null||value.profilePath!==null||value.logo!==null||value.verified||value.name!=="Confidential company"))ctx.addIssue({code:"custom",message:"Confidential company details must remain masked."});
});
export const publicJobSummarySchema=z.object({id:z.uuid(),title:text(150).min(1),location:text(300),arrangement:text(100),employment:text(100),compensationLabel:text(1000),acceptingApplications:z.boolean(),closesAt:z.iso.datetime({offset:true}).nullable(),publicPath:publicResourcePathSchema}).strict().superRefine((value,ctx)=>{
  if(value.publicPath!==`/jobs/${value.id}`)ctx.addIssue({code:"custom",path:["publicPath"],message:"Choose the matching public job path."});
});
export const publicEntrySchema=z.object({id:z.uuid(),kind:z.enum(["post","job","update"]),path:publicResourcePathSchema,title:text(policy.limits.title),body:text(policy.limits.body),publishedAt:z.iso.datetime({offset:true}),author:publicAuthorSchema.nullable(),company:publicCompanySchema.nullable(),media:z.array(publicMediaSchema).max(policy.limits.media),externalVideos:z.array(publicExternalVideoSchema).max(policy.limits.media).optional(),counts:z.object({likes:z.number().int().nonnegative(),comments:z.number().int().nonnegative(),reposts:z.number().int().nonnegative()}).strict(),job:publicJobSummarySchema.nullable()}).strict().superRefine((value,ctx)=>{
  if(value.path!==`/feed/${value.id}`)ctx.addIssue({code:"custom",path:["path"],message:"Choose the matching public entry path."});
  if(value.kind==="job"?!value.job:!!value.job)ctx.addIssue({code:"custom",path:["job"],message:"Job details must match the entry kind."});
  if(value.kind!=="job"&&!value.author)ctx.addIssue({code:"custom",path:["author"],message:"A public author is required."});
});
export const publicCommentSchema=z.object({id:z.uuid(),entryId:z.uuid(),parentId:z.uuid().nullable(),author:publicAuthorSchema,text:text(policy.limits.comment).min(1),createdAt:z.iso.datetime({offset:true}),pinned:z.boolean()}).strict();
export const publicSearchResultSchema=z.object({id:z.uuid(),kind:z.enum(["person","company","post","job","update"]),title:text(300).min(1),subtitle:text(1000),path:publicResourcePathSchema,picture:publicMediaSchema.nullable()}).strict().superRefine((value,ctx)=>{
  const prefixes=value.kind==="person"?["/professionals/","/recruiters/"]:value.kind==="company"?["/organizations/"]:value.kind==="job"?["/jobs/"]:["/feed/"];
  if(!prefixes.some(prefix=>value.path.startsWith(prefix)))ctx.addIssue({code:"custom",path:["path"],message:"The result path must match its category."});
});
const page=<T extends z.ZodType>(item:T,max:number)=>z.object({items:z.array(item).max(max),nextCursor:cursorValue.nullable(),total:z.number().int().nonnegative()}).strict();
export const publicFeedPageSchema=page(publicEntrySchema,policy.limits.pageSize);
export const publicCommentsPageSchema=page(publicCommentSchema,policy.limits.commentPageSize);
export const publicSearchPageSchema=page(publicSearchResultSchema,policy.limits.pageSize).extend({scope:publicSearchScopeSchema});
export type PublicFeedQuery=z.output<typeof publicFeedQuerySchema>;
export type PublicSearchQuery=z.output<typeof publicSearchQuerySchema>;
export type PublicCommentsQuery=z.output<typeof publicCommentsQuerySchema>;
