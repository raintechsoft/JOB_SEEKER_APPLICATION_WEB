import {z} from "zod";
import type {components} from "@/types/generated/api";
import type {HttpClient} from "../api/client";
import type {AuthService} from "../auth/auth.service";
import type {CandidateView,TalentService} from "./talent.service";
import {hiringPath} from "../job-posts/job-posts.http";
import {comparisonSchema,shortlistNameSchema,talentFiltersSchema} from "@/lib/validation/application";

export function createHttpTalentService(http:HttpClient,auth:AuthService,recommended:()=>Promise<import("./talent.service").TalentCardData[]>,inbox:()=>Promise<import("../messaging/messaging.service").Inbox>):TalentService & {reset():void} {
  const lists=new Map<string,components["schemas"]["ShortlistView"]>();
  const discoveryPath=async()=>typeof window!=="undefined"&&window.location.pathname.startsWith("/recruiter/")?`${await hiringPath(auth)}/`:"";
  const listShortlists=async()=>{const rows=(await http.get<{data:components["schemas"]["ShortlistView"][]}>(`${await hiringPath(auth)}/shortlists`)).data;lists.clear();rows.forEach((r)=>lists.set(r.id,r));return rows;};
  const known=async(id:string)=>{z.uuid().parse(id);const row=lists.get(id)??(await listShortlists()).find((r)=>r.id===id);if(!row)throw new Error("This shortlist is unavailable.");return row;};
  const setCandidateShortlists=async(candidateId:string,ids:string[],observed?:Record<string,number>)=>{z.uuid().parse(candidateId);z.array(z.uuid()).max(50).refine((v)=>new Set(v).size===v.length).parse(ids);const versions=observed??Object.fromEntries([...lists.values()].filter((l)=>l.canEdit).map((l)=>[l.id,l.version]));return (await http.post<{data:{saved:boolean}}>(`${await hiringPath(auth)}/talent/${candidateId}/shortlists`,{ids,versions})).data.saved;};
  const search=async(filters:Parameters<TalentService["search"]>[0])=>{const f=talentFiltersSchema.parse(filters);return (await http.get<{data:components["schemas"]["TalentCard"][]}>(`${await discoveryPath()}talent`,f)).data;};
  return {
    reset(){lists.clear();},search,listShortlists,setCandidateShortlists,getRecommendedTalent:recommended,
    async shareShortlist(id,input){z.uuid().parse(id);z.enum(["private","organization"]).parse(input.visibility);const list=await known(id);await http.patch(`${await hiringPath(auth)}/shortlists/${id}`,{name:list.name,version:input.version??list.version,visibility:input.visibility});lists.delete(id);},
    async getFilterOptions(){return (await http.get<{data:{locations:string[];skills:string[]}}>(`${await discoveryPath()}talent-options`)).data;},
    async getCandidate(id){z.uuid().parse(id);return (await http.get<{data:CandidateView}>(`${await hiringPath(auth)}/talent/${id}`)).data;},
    async getCandidateBySlug(slug){return (await http.get<{data:CandidateView}>(`professionals/${encodeURIComponent(slug)}`)).data;},
    async createShortlist(name){const value=shortlistNameSchema.parse(name);return (await http.post<{data:{id:string}}>(`${await hiringPath(auth)}/shortlists`,{name:value})).data.id;},
    async renameShortlist(id,name,version){const value=shortlistNameSchema.parse(name);const list=await known(id);await http.patch(`${await hiringPath(auth)}/shortlists/${id}`,{name:value,version:version??list.version});lists.delete(id);},
    async deleteShortlist(id){const list=await known(id);await http.delete(`${await hiringPath(auth)}/shortlists/${id}`,{version:list.version});lists.delete(id);},
    async removeFromShortlist(id,candidateId){z.uuid().parse(candidateId);const target=await known(id);if(!target.canEdit)throw new Error("This shared shortlist is read-only.");const all=[...lists.values()];const selected=all.filter((l)=>l.canEdit&&l.id!==id&&l.candidates.includes(candidateId)).map((l)=>l.id);await setCandidateShortlists(candidateId,selected);return true;},
    async compare(ids){comparisonSchema.parse(ids);return (await http.get<{data:components["schemas"]["ComparisonPerson"][]}>(`${await hiringPath(auth)}/compare`,{ids})).data;},
    async listPublicPeople(){return search({q:"",category:"",skill:"",location:"",years:"",availability:"",completeness:false,recent:false,sort:"recent"});},
    async getOverview(){const [shortlists,people,recentTalent,messages]=await Promise.all([listShortlists(),search({q:"",category:"",skill:"",location:"",years:"",availability:"",completeness:false,recent:false,sort:"recent"}),recommended(),inbox()]);return {talentCount:people.length,savedCandidates:new Set(shortlists.flatMap((l)=>l.candidates)).size,shortlists,conversationCount:messages.threads.length,recentTalent,conversations:messages.threads.slice(0,6).map((t)=>({id:t.id,person:t.contact,lastMessage:t.lastMessage?.text??""}))};},
  };
}
