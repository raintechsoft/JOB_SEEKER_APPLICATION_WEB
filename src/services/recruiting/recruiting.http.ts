import type { ReadScope } from "../realtime/realtime.http";
import {z} from "zod";
import type {components} from "@/types/generated/api";
import type {HttpClient} from "../api/client";
import type {AuthService} from "../auth/auth.service";
import type {RecruitingService,ResponseParams} from "./recruiting.service";
import {hiringPath} from "../job-posts/job-posts.http";
import {bulkIdsSchema,collaborationSchema,outreachSchema,reviewSchema} from "@/lib/validation/application";
import {managedJobsSchema,RECRUITING_RULES,responseFiltersSchema} from "@/lib/validation/recruiting";
import {exportRequestSchema,outreachSendSchema} from "@/lib/validation/communication";
type ResponseItem=components["schemas"]["ResponseItem"];
type ManagedJob=components["schemas"]["ManagedJob"];
export function createHttpRecruitingService(http:HttpClient,auth:AuthService):RecruitingService & {reset():void} {
  const exportAttempts=new Map<string,string>();
  const responses=new Map<string,ResponseItem>(),jobs=new Map<string,ManagedJob>();
  const getApplicant=async(id:string,scope?:ReadScope)=>{z.uuid().parse(id);const row=(await http.get<{data:ResponseItem}>(`${await hiringPath(auth,scope)}/responses/${id}`,undefined,scope)).data;responses.set(id,row);return row;};
  const getManagedJob=async(id:string,scope?:ReadScope)=>{z.uuid().parse(id);const row=(await http.get<{data:ManagedJob}>(`${await hiringPath(auth,scope)}/jobs/${id}`,undefined,scope)).data;jobs.set(id,row);return row;};
  const loadResponseApplication=async(id:string,fresh=false)=>{
    if(fresh)responses.delete(id);
    return (responses.get(id)??await getApplicant(id)).application;
  };
  const action=async(kind:"responses"|"jobs",name:string,ids:string[],body:object={},freshResponses=true)=>{
    bulkIdsSchema.parse(ids);
    // Response mutations re-read versions by default. Stale list/note versions were returning 409,
    // so Shortlist/Reject looked like a no-op in the UI.
    const records=await Promise.all(ids.map(async(id)=>kind==="jobs"?jobs.get(id)??await getManagedJob(id):loadResponseApplication(id,freshResponses)));
    const versions=Object.fromEntries(records.map((r)=>[r.id,z.number().int().min(1).parse(r.version)]));
    // Explicit body.versions (e.g. note/review forms) must not overwrite the fresh server versions.
    const {versions:_ignored, ...rest}=body as {versions?:Record<string,number>};
    const result=(await http.post<{data:{count:number;status:"Draft"|"Closed"|"Expired"|"Active"|null;candidate?:string|null;draftId?:string}}>(`${await hiringPath(auth)}/${kind}/actions/${name}`,{ids,versions,...rest})).data;
    if(kind==="jobs")ids.forEach((id)=>jobs.delete(id));else ids.forEach((id)=>responses.delete(id));
    return result;
  };
  const listResponses=async(params:ResponseParams,scope?:ReadScope)=>{responseFiltersSchema.parse(params);const page=(await http.get<{data:components["schemas"]["ResponsesPage"]}>(`${await hiringPath(auth,scope)}/responses`,params,scope)).data;for(const row of page.items)responses.set(row.application.id,row);return page;};
  const transition=async(ids:string[],status:string)=>{
    bulkIdsSchema.parse(ids);z.enum(["New","Reviewing","Shortlisted","Interview","Hired","Rejected"]).parse(status);
    for(const id of ids){const a=await loadResponseApplication(id,true);
      const allowed=(RECRUITING_RULES.transitions[a.status] as string[]|undefined)?.includes(status);
      if(a.status!==status&&(a.withdrawnAt||!allowed))throw new Error("This hiring transition is unavailable. Review the current stage.");}
  };
  return {
    reset(){responses.clear();jobs.clear();exportAttempts.clear();},getApplicant,getManagedJob,listResponses,
    async getHiringSummary(scope){return (await http.get<{data:components["schemas"]["HiringSummary"]}>(`${await hiringPath(auth,scope)}/summary`,undefined,scope)).data;},
    async getReview(id,scope){const row=await getApplicant(id,scope);return {application:row.application,person:row.profile,jobTitle:row.jobTitle};},
    async saveReview(id,input){const v=reviewSchema.parse(input);z.uuid().parse(id);await transition([id],v.status);await action("responses","review",[id],v,false);return true;},
    async listManagedJobs(query,scope){const q=managedJobsSchema.parse(query);const result=(await http.get<{data:components["schemas"]["ManagedJobsPage"]}>(`${await hiringPath(auth,scope)}/jobs`,q,scope)).data;result.items.forEach((row)=>jobs.set(row.id,row));return result;},
    async toggleJob(id){return (await action("jobs","toggle",[id])).status;},
    async repostJob(id){await action("jobs","repost",[id]);return true;},
    async closeJobs(ids){return (await action("jobs","close",ids)).count;},
    async saveCollaboration(ids,emails,note,versions){const v=collaborationSchema.parse({ids,emails,note});await action("jobs","collaboration",ids,{emails:v.emails,note:v.note,...(versions?{versions}:{})});},
    async deleteDraft(id){await action("jobs","delete",[id]);},
    async deleteDrafts(ids){bulkIdsSchema.parse(ids);return (await action("jobs","delete",ids)).count;},
    async setStatus(ids,status){await transition(ids,status);return (await action("responses","status",ids,{status},false)).count;},
    async saveNote(id,note){const v=z.string().trim().max(5000).parse(note);await action("responses","note",[id],{note:v});},
    async markViewed(id){return (await action("responses","viewed",[id])).candidate??null;},
    async remove(ids){await action("responses","remove",ids);},
    async saveOutreach(ids,subject,message){const v=outreachSchema.parse({ids,subject,message});const row=await action("responses","outreach",ids,{subject:v.subject,message:v.message});return {draftId:z.uuid().parse(row.draftId)};},
    async outreachPreview(id){z.uuid().parse(id);return (await http.get<{data:components["schemas"]["OutreachPreview"]}>(`${await hiringPath(auth)}/outreach/${id}`)).data;},
    async sendOutreach(id,version,confirmed){const {id:target,...v}=outreachSendSchema.parse({id,version,confirmed});await http.post(`${await hiringPath(auth)}/outreach/${target}/send`,v);},
    async requestExport(ids){const v=exportRequestSchema.parse({ids});const base=await hiringPath(auth),signature=JSON.stringify([base,[...v.ids].sort()]);const creationKey=exportAttempts.get(signature)??crypto.randomUUID();exportAttempts.set(signature,creationKey);const row=(await http.post<{data:{id:string}}>(`${base}/export-requests`,{...v,creationKey})).data;exportAttempts.delete(signature);return row.id;},
    async exportStatus(id){z.uuid().parse(id);return (await http.get<{data:components["schemas"]["ExportStatus"]}>(`${await hiringPath(auth)}/export-requests/${id}`)).data;},
    async downloadExport(id){z.uuid().parse(id);return http.blob(`${await hiringPath(auth)}/export-requests/${id}/download`);},
    async runKeywordMatch(params,autoShortlist){responseFiltersSchema.parse(params);z.boolean().parse(autoShortlist);const all:ResponseItem[]=[];let page=1,total=0;
      do{const result=await listResponses({...params,stage:"all",fit:"1",page:String(page),size:"40"});total=result.total;if(autoShortlist&&total>100)throw new Error("Narrow matching to at most 100 responses before shortlisting.");all.push(...result.items);page++;if(!autoShortlist)break;}while(all.length<total);
      const ids=all.filter((r)=>!r.application.withdrawnAt&&["New","Reviewing"].includes(r.application.status)).map((r)=>r.application.id);
      const shortlisted=autoShortlist&&ids.length?(await action("responses","status",ids,{status:"Shortlisted"})).count:0;return {matches:total,shortlisted};},
    async exportCsv(ids){bulkIdsSchema.parse(ids);return (await http.post<{data:{csv:string}}>(`${await hiringPath(auth)}/exports`,{ids})).data.csv;},
    async exportProfile(id){z.uuid().parse(id);return (await http.post<{data:{fileName:string;text:string}}>(`${await hiringPath(auth)}/exports`,{ids:[id],profile:true})).data;},
    async applicantNames(ids){bulkIdsSchema.parse(ids);return Promise.all(ids.map(async(id)=>(responses.get(id)??await getApplicant(id)).profile.name));},
  };
}
