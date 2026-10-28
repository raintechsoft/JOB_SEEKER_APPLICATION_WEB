import type {components} from "@/types/generated/api";
import type {HttpClient} from "../api/client";
import type {AuthService} from "../auth/auth.service";
import type {RecommendationsService} from "./recommendations.service";
import {recommendationQuerySchema} from "@/lib/validation/search";
import {z} from "zod";

export function createHttpRecommendationsService(http:HttpClient,auth:AuthService){
  async function read(surface:"jobs"|"talent",limit:number){
    const session=await auth.me();
    const query=recommendationQuerySchema.parse({identity:session.selected_identity_id,surface,limit});
    return (await http.get<{data:components["schemas"]["BaselineRecommendations"]}>(`me/recommendations/${query.identity}`,{surface,limit})).data;
  }
  const toJob=({job,company,saved,reason,matchedAlerts,analyticsContext,match}:components["schemas"]["RecommendedJob"])=>({analyticsContext,match,id:job.id,title:job.title,companyId:company.id,company,location:job.location,arrangement:job.arrangement,employment:job.employment,salary:job.salary,createdAt:job.createdAt,isNew:Date.now()-Date.parse(job.createdAt)<7*86400000,saved,matchedAlerts,reason});
  async function similar(kind:"job"|"professional",id:string,limit:number){
    z.uuid().parse(id);
    const session=await auth.me();
    const identity=z.uuid().parse(session.selected_identity_id);
    return (await http.get<{data:components["schemas"]["SimilarItems"]}>(`me/recommendations/${identity}/similar`,{kind,id,limit:Math.min(10,Math.max(1,limit))})).data.items;
  }
  const service:RecommendationsService={async getJobsForYou(){
    const page=await read("jobs",20);
    const forYou=page.items.filter((r):r is components["schemas"]["RecommendedJob"]=>"job" in r).map(toJob);
    return {strategyVersion:page.strategyVersion,forYou,alertMatches:forYou.filter((j)=>j.matchedAlerts.length>0),newCount:forYou.filter((j)=>j.isNew).length};
  },
  async similarJobs(jobId,limit=4){return (await similar("job",jobId,limit)).filter((r):r is components["schemas"]["RecommendedJob"]=>"job" in r).map(toJob);},
  async similarPeople(professionalId,limit=4){return (await similar("professional",professionalId,limit)).filter((r):r is components["schemas"]["RecommendedTalent"]=>"person" in r).map(({person,reason})=>({id:person.id,name:person.name,headline:person.headline,picture:person.picture,color:person.color,reason}));},
  };
  return {...service,async talent(){const page=await read("talent",6);return page.items.filter((r):r is components["schemas"]["RecommendedTalent"]=>"person" in r).map((r)=>({...r.person,recommendationReason:r.reason,analyticsContext:r.analyticsContext,match:r.match,pool:r.pool}));}};
}
