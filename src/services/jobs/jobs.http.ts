import {jobSearchSchema} from "@/lib/validation/search";
import {z} from "zod";
import type {components} from "@/types/generated/api";
import type {HttpClient} from "../api/client";
import {ApiError} from "../api/client";
import type {JobsService,JobDetail} from "./jobs.service";
import {applicationSchema} from "@/lib/validation/application";

export const jobAlertSchema=z.object({name:z.string().trim().min(1).max(100),keywords:z.string().trim().min(1).max(200),location:z.string().trim().max(200),arrangement:z.enum(["Any","On-site","Hybrid","Remote"]),days:z.number().int().min(1).max(90),enabled:z.boolean()});
export function createHttpJobsService(http:HttpClient):JobsService & {reset():void} {
  const jobs=new Map<string,JobDetail>();const attempts=new Map<string,{signature:string;key:string}>();
  const getJob=async(id:string)=>{z.uuid().parse(id);try{const row=(await http.get<{data:components["schemas"]["JobDetail"]}>(`jobs/${id}`)).data;jobs.set(id,row);return row;}catch(e){if(e instanceof ApiError&&e.status===404)return null;throw e;}};
  return {
    async listOpportunities(query){const checked=jobSearchSchema.parse(query);const result=await http.get<{data:{job:components["schemas"]["HiringJob"];company:components["schemas"]["HiringCompany"];saved:boolean}[];meta:{total:number}}>("jobs",{...checked,pageSize:checked.pageSize??20});return {items:result.data,total:result.meta.total};},
    reset(){jobs.clear();attempts.clear();},getJob,
    async markSeen(id){return !!await getJob(id);},
    async apply(input){
      // The application form includes the question version it displayed. Never silently refresh it to submit.
      z.uuid().parse(input.jobId);
      const detail=jobs.get(input.jobId);if(!detail)throw new Error("Reload the job before applying.");
      const values=applicationSchema(detail.job.screeningQuestions??[],detail.job.requirePortfolio??false).parse(input);
      const signature=JSON.stringify(values);let attempt=attempts.get(input.jobId);
      if(!attempt||attempt.signature!==signature){attempt={signature,key:crypto.randomUUID()};attempts.set(input.jobId,attempt);}
      const {jobId,...body}=values;
      await http.post(`jobs/${jobId}/applications`,{...body,questionsVersion:input.questionsVersion??detail.job.questionsVersion,idempotencyKey:attempt.key});
      jobs.delete(jobId);
    },
    async toggleSave(id){z.uuid().parse(id);return {...(await http.post<{data:{saved:boolean}}>(`me/saved-jobs/${id}`)).data,persisted:true};},
    async listAlerts(){return (await http.get<{data:components["schemas"]["JobAlert"][]}>("me/job-alerts")).data;},
    async saveAlert(input){const values=jobAlertSchema.parse(input);if(input.id)z.uuid().parse(input.id);if(input.id)await http.patch(`me/job-alerts/${input.id}`,values);else await http.post("me/job-alerts",values);},
    async toggleAlert(id){z.uuid().parse(id);return (await http.post<{data:{enabled:boolean}}>(`me/job-alerts/${id}/toggle`)).data.enabled;},
    async deleteAlert(id){z.uuid().parse(id);await http.delete(`me/job-alerts/${id}`);},
  };
}
