import type {components} from "@/types/generated/api";
import type {HttpClient} from "../api/client";
import type {AuthService} from "../auth/auth.service";
import type {JobsService} from "../jobs/jobs.service";
import type {RecommendationsService} from "./recommendations.service";
import {recommendationQuerySchema} from "@/lib/validation/search";

export function createHttpRecommendationsService(http:HttpClient,auth:AuthService,jobs:JobsService){
  async function read(surface:"jobs"|"talent",limit:number){
    const session=await auth.me();
    const query=recommendationQuerySchema.parse({identity:session.selected_identity_id,surface,limit});
    return (await http.get<{data:components["schemas"]["BaselineRecommendations"]}>(`me/recommendations/${query.identity}`,{surface,limit})).data;
  }
  const service:RecommendationsService={async getJobsForYou(){
    const [page,alerts]=await Promise.all([read("jobs",20),jobs.listAlerts()]);
    const forYou=page.items.filter((r):r is components["schemas"]["RecommendedJob"]=>"job" in r).map(({job,company,saved,reason,matchedAlerts,analyticsContext})=>({analyticsContext,id:job.id,title:job.title,companyId:company.id,company,location:job.location,arrangement:job.arrangement,employment:job.employment,salary:job.salary,createdAt:job.createdAt,isNew:Date.now()-Date.parse(job.createdAt)<7*86400000,saved,matchedAlerts,reason}));
    return {strategyVersion:page.strategyVersion,forYou,alertMatches:forYou.filter((j)=>j.matchedAlerts.length>0),newCount:forYou.filter((j)=>j.isNew).length,alerts};
  }};
  return {...service,async talent(){const page=await read("talent",6);return page.items.filter((r):r is components["schemas"]["RecommendedTalent"]=>"person" in r).map((r)=>({...r.person,recommendationReason:r.reason,analyticsContext:r.analyticsContext}));}};
}
