import { z } from "zod";
import rules from "../../../../../contracts/validation/job.json";
import type { JobWizardValues } from "@/types/domain";
import { today } from "@/lib/utils/date";
import {validateMedia} from "./profile";

export const JOB_RULES = rules;
export const calendarDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const text = (max: number) => z.string().trim().refine((v) => [...v].length <= max, `Use at most ${max} characters.`);
const numeric = (min: number, max: number, integer = false) => z.union([z.string(), z.number()]).refine((v) => v === "" || /^\d+(?:\.\d+)?$/.test(String(v)) && Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max && (!integer || /^(?:0|[1-9]\d*)$/.test(String(v))), `Use ${integer ? "a whole number" : "a number"} from ${min} to ${max}.`);
const list = (max: number) => z.array(text(rules.itemLength).refine(Boolean, "Remove empty items.")).max(max).refine((v) => new Set(v.map((x) => x.toLowerCase())).size === v.length, "Use distinct items.");
const optionalEnum = (values: string[]) => z.string().refine((v) => v === "" || values.includes(v), "Choose one of the available options.");
const asset = z.string().refine((v) => !v || /^https?:\/\/.+\/api\/v1\/media\/[0-9a-f-]{36}\/download$/.test(v), "Upload a managed file first.");
const question = z.object({ id: z.uuid(), text: text(rules.questionLength), type: z.enum(["text", "yesno", "number"]), required: z.boolean(), ideal: text(rules.idealLength) }).superRefine((v, ctx) => {
  if (v.ideal && v.type === "yesno" && !["Yes", "No"].includes(v.ideal)) ctx.addIssue({ code: "custom", path: ["ideal"], message: "Choose Yes or No." });
  if (v.ideal && v.type === "number" && !/^-?\d+(?:\.\d+)?$/.test(v.ideal)) ctx.addIssue({ code: "custom", path: ["ideal"], message: "Enter a finite number." });
});
/** Incomplete drafts may omit required content, but may never persist malformed supplied values. */
export const jobDraftValuesSchema = z.object({
  companyName:text(100), hideCompany:z.boolean(), title:text(120), department:optionalEnum(rules.departments), role:text(100), employment:optionalEnum(rules.employment),
  experienceMin:numeric(0,50,true), experienceMax:numeric(0,50,true), currency:z.enum(["INR","USD","EUR","GBP"]), salaryMin:numeric(0,rules.annualSalaryMax).refine((v)=>v===""||/^\d+(?:\.\d{1,2})?$/.test(String(v)),"Use at most two decimal places."), salaryMax:numeric(0,rules.annualSalaryMax).refine((v)=>v===""||/^\d+(?:\.\d{1,2})?$/.test(String(v)),"Use at most two decimal places."),
  variableEnabled:z.boolean(), variablePercent:numeric(0,100).refine((v)=>v===""||/^\d+(?:\.\d{1,2})?$/.test(String(v)),"Use at most two decimal places."), hideSalary:z.boolean(), arrangement:optionalEnum(rules.arrangements), locations:list(20), relocate:z.boolean(), vacancies:numeric(1,999,true),
  skills:list(20), essentialSkills:list(20), education:list(7).refine((v)=>v.every((x)=>rules.education.includes(x)),"Choose listed qualifications."), industries:list(20),
  description:text(rules.text.description), responsibilities:text(rules.text.responsibilities), requirements:text(rules.text.requirements), benefits:text(rules.text.benefits), questions:z.array(question).max(rules.questionsMax).refine((v)=>new Set(v.map((q)=>q.id)).size===v.length,"Use distinct question IDs."),
  expiresAt:z.string().refine((v)=>!v || calendarDate(v) && v >= today() && Date.parse(v)-Date.parse(today())<=rules.expiryMaxDays*86400000,"Choose a valid closing date within two years (UTC)."),
  reference:text(100), contactEmail:z.union([z.literal(""),z.email().max(254)]), requirePortfolio:z.boolean(), notifyResponses:z.boolean(), applicationInstructions:text(2000),
  thumbnail:z.object({template:z.enum(["cobalt","sage","graphite","lavender","none"]),image:asset,alt:text(200),headline:text(120)}),
  jobMedia:z.object({video:text(2048).refine((v)=>{if(!v)return true;try{const u=new URL(v);return ["http:","https:"].includes(u.protocol)&&/\.(mp4|webm)$/i.test(u.pathname);}catch{return false;}},"Use a direct HTTP or HTTPS MP4 or WebM URL."),files:z.array(z.object({id:z.uuid(),name:text(180).refine(Boolean),type:z.string().refine((v)=>rules.attachmentTypes.includes(v)),size:z.number().int().min(1).max(rules.fileMaxBytes),data:asset.refine(Boolean)})).max(rules.filesMax).refine((v)=>v.reduce((n,f)=>n+f.size,0)<=rules.filesTotalBytes,"Supporting files must total at most 1.5 MB.").refine((v)=>new Set(v.map((f)=>f.id)).size===v.length,"Use distinct files.")}),
  aiVerified:z.boolean().optional(),
}).superRefine((v,ctx)=>{
  const error=(path:string,message:string)=>ctx.addIssue({code:"custom",path:[path],message});
  if(v.experienceMin!=="" && v.experienceMax!=="" && Number(v.experienceMin)>Number(v.experienceMax))error("experienceMax","Maximum experience must be at least the minimum.");
  if(v.salaryMin!=="" && v.salaryMax!=="" && Number(v.salaryMin)>Number(v.salaryMax))error("salaryMax","Maximum salary must be at least the minimum.");
  if([v.salaryMin,v.salaryMax].some((s)=>s!=="" && Number(s)*(v.currency==="INR"?100000:1)>rules.annualSalaryMax))error("salaryMax","Annual salary exceeds the supported limit.");
  if(v.essentialSkills.some((s)=>!v.skills.includes(s)))error("essentialSkills","Essential skills must also be listed as job skills.");
});
const stageKeys = [[...rules.requiredStages[0],"hideCompany","hideSalary","variableEnabled","variablePercent","relocate"], ["skills","essentialSkills","education","industries"], ["description","responsibilities","requirements","benefits"], ["questions"], ["expiresAt","reference","contactEmail","requirePortfolio","notifyResponses","applicationInstructions"], ["thumbnail","jobMedia"], []];
const stageFor = (key:string) => stageKeys.findIndex((keys)=>keys.includes(key));
export function jobErrors(values: JobWizardValues, mode: "draft"|"publish"|number = "publish"): Record<string,string> {
  const errors:Record<string,string>={};
  const parsed=jobDraftValuesSchema.safeParse(values);
  if(!parsed.success) for(const issue of parsed.error.issues){const key=String(issue.path[0]);if(typeof mode!=="number"||stageFor(key)===mode)errors[key]??=issue.message;}
  const stages = typeof mode==="number"?[mode]:mode==="publish"?[0,1,2,3,4,5,6]:[];
  for(const stage of stages){
    for(const key of rules.requiredStages[stage]){const value=values[key as keyof JobWizardValues];if(value==="" || typeof value==="string" && !value.trim() || Array.isArray(value)&&!value.length)errors[key]="This field is required.";}
    if(stage===0 && values.variableEnabled && values.variablePercent==="")errors.variablePercent="Enter the variable pay percentage.";
    if(stage===3 && values.questions.some((q)=>!q.text.trim()))errors.questions="Add text to each question or remove it.";
    if(stage===5 && values.thumbnail.image && !values.thumbnail.alt.trim())errors.thumbnail="Describe the uploaded thumbnail.";
  }
  return errors;
}
export const jobPublishSchema = jobDraftValuesSchema.superRefine((v,ctx)=>{for(const [key,message] of Object.entries(jobErrors(v as JobWizardValues,"publish")))ctx.addIssue({code:"custom",path:[key],message});});
export function validateJobFiles(files: File[], existing: {size:number}[], thumbnail=false): string|null {
  if(!files.length || thumbnail && files.length!==1)return "Choose a file.";
  for(const file of files){const error=validateMedia(file,thumbnail?"job_thumbnail":"job_attachment");if(error)return error;}
  if(files.some((f)=>f.size<1 || f.size>rules.fileMaxBytes || !(thumbnail?["image/jpeg","image/png","image/webp"]:rules.attachmentTypes).includes(f.type)))return "Choose supported files up to 1 MB each.";
  if(!thumbnail && (files.length+existing.length>rules.filesMax || [...existing,...files].reduce((n,f)=>n+f.size,0)>rules.filesTotalBytes))return "Use up to three supporting files totaling 1.5 MB or less.";
  return null;
}
