import {z} from "zod";
import type {components} from "@/types/generated/api";
import type {HttpClient} from "../api/client";
import type {ApplicationsService} from "./applications.service";
import {trackingSchema} from "@/lib/validation/application";

export function createHttpApplicationsService(http:HttpClient):ApplicationsService & {reset():void} {
  const versions=new Map<string,number>();const search=z.string().trim().max(200);
  const remember=(row:components["schemas"]["PersonalApplication"])=>{versions.set(row.id,row.version);return row;};
  const getApplication=async(id:string)=>remember((await http.get<{data:components["schemas"]["PersonalApplication"]}>(`me/applications/${z.uuid().parse(id)}`)).data);
  const listApplications=async(query:{q:string;status:string})=>{search.parse(query.q);z.enum(["","Applied","In review","Interview","Offer","Rejected","Withdrawn"]).parse(query.status);return (await http.get<{data:components["schemas"]["PersonalApplication"][]}>("me/applications",query)).data.map(remember);};
  const listSavedJobs=async(query:{q:string})=>{search.parse(query.q);return (await http.get<{data:Awaited<ReturnType<ApplicationsService["listSavedJobs"]>>}>("me/saved-jobs",query)).data;};
  const listAlerts=async(query:{q:string})=>{search.parse(query.q);return (await http.get<{data:Awaited<ReturnType<ApplicationsService["listAlerts"]>>}>("me/job-alerts",{...query,matches:true})).data;};
  const version=async(id:string)=>versions.get(id)??(await getApplication(id)).version;
  return {
    reset(){versions.clear();},getApplication,listApplications,listSavedJobs,listAlerts,
    async getOverview(){const [a,s,alerts]=await Promise.all([listApplications({q:"",status:""}),listSavedJobs({q:""}),listAlerts({q:""})]);return {counts:{applied:a.length,saved:s.length,activeAlerts:alerts.filter((a)=>a.enabled).length}};},
    async updateTracking(id,input){const values=trackingSchema.parse(input);z.uuid().parse(id);await http.patch(`me/applications/${id}`,{...values,version:input.version??await version(id)});versions.delete(id);},
    async remove(id){z.uuid().parse(id);await http.delete(`me/applications/${id}`,{version:await version(id)});versions.delete(id);},
  };
}
