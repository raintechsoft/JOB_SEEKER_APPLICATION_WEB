import type { ReadScope } from "../realtime/realtime.http";
import {z} from "zod";
import type {components} from "@/types/generated/api";
import type {HttpClient} from "../api/client";
import type {ApplicationsService, ApplicationResults} from "./applications.service";
import {applicationFiltersSchema,trackingSchema,bulkIdsSchema,savedJobStateSchema,savedJobActionSchema} from "@/lib/validation/application";

export function createHttpApplicationsService(http:HttpClient):ApplicationsService & {reset():void} {
  const versions=new Map<string,number>();const search=z.string().trim().max(200);
  const remember=(row:components["schemas"]["PersonalApplication"])=>{versions.set(row.id,row.version);return row;};
  const getApplication=async(id:string,scope?:ReadScope)=>remember((await http.get<{data:components["schemas"]["PersonalApplication"]}>(`me/applications/${z.uuid().parse(id)}`,undefined,scope)).data);
  const listApplications=async(query:{q:string;status:string},scope?:ReadScope)=>{search.parse(query.q);applicationFiltersSchema.shape.status.parse(query.status);return (await http.get<{data:components["schemas"]["PersonalApplication"][]}>("me/applications",query,scope)).data.map(remember);};
  const listSavedJobs=async(query:{q:string;state?:"active"|"archived"|"all"},scope?:ReadScope)=>{search.parse(query.q);if(query.state!==undefined)savedJobStateSchema.parse(query.state);return (await http.get<{data:components["schemas"]["SavedJob"][]}>("me/saved-jobs",query,scope)).data;};
  const listAlerts=async(query:{q:string},scope?:ReadScope)=>{search.parse(query.q);return (await http.get<{data:Awaited<ReturnType<ApplicationsService["listAlerts"]>>}>("me/job-alerts",{...query,matches:true},scope)).data;};
  const version=async(id:string)=>versions.get(id)??(await getApplication(id)).version;
  return {
    reset(){versions.clear();},getApplication,listApplications,listSavedJobs,listAlerts,
    async getApplicationResults(query,scope){const input=applicationFiltersSchema.parse(query);const response=await http.get<{data:components["schemas"]["PersonalApplication"][];meta:{counts:ApplicationResults["counts"]}}>("me/applications",input,scope);return {items:response.data.map(remember),counts:response.meta.counts};},
    async unsaveJobs(ids){await http.delete("me/saved-jobs",{ids:bulkIdsSchema.parse(ids)});},
    async archiveSavedJobs(ids,action){const input={ids:bulkIdsSchema.parse(ids),action:savedJobActionSchema.parse(action)};await http.patch("me/saved-jobs",input);},
    async getOverview(scope){const [a,s,alerts]=await Promise.all([listApplications({q:"",status:""},scope),listSavedJobs({q:"",state:"active"},scope),listAlerts({q:""},scope)]);return {counts:{applied:a.length,saved:s.length,activeAlerts:alerts.filter((a)=>a.enabled).length}};},
    async updateTracking(id,input){const {version:expected,...fields}=input;const values=trackingSchema.parse(fields);z.uuid().parse(id);await http.patch(`me/applications/${id}`,{...values,version:z.number().int().positive().parse(expected??await version(id))});versions.delete(id);},
    async withdraw(id,expected){z.uuid().parse(id);const current=z.number().int().positive().parse(expected??await version(id));await http.post(`me/applications/${id}/withdraw`,{version:current});versions.delete(id);},
    async remove(id){z.uuid().parse(id);await http.delete(`me/applications/${id}`,{version:await version(id)});versions.delete(id);},
  };
}
