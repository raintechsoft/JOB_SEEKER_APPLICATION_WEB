import type { components } from "@/types/generated/api";
import type { HttpClient } from "../api/client";
import type { AuthService } from "../auth/auth.service";
import type { JobPostsService, JobDraftContext } from "./job-posts.service";
import type { JobDraft } from "@/types/domain";
import { jobDraftValuesSchema, jobPublishSchema } from "@/lib/validation/job";
import { z } from "zod";

export async function hiringPath(auth: AuthService): Promise<string> {
  const session=await auth.me();
  const workspace=session.workspaces.find((w)=>w.id===session.selected_identity_id&&w.kind==="recruiter");
  if(!workspace?.organization)throw new Error("Select an active organization workspace first.");
  return `organizations/${workspace.organization.id}/hiring`;
}
type DraftDto=components["schemas"]["JobDraft"];
export function createHttpJobPostsService(http:HttpClient,auth:AuthService):JobPostsService & {reset():void} {
  const contexts=new Map<string,{base:string;context:JobDraftContext;version:number;jobVersion:number}>();
  const pending=new Map<string,Promise<void>>();
  const newDrafts=new Map<string,Promise<JobDraftContext>>();
  const revision=(n:number|undefined)=>z.number().int().min(1).parse(n);
  async function write(key:string,draft:JobDraft,publish=false){
    z.uuid().parse(key);
    // Check syntax before any request, including session/workspace reads.
    const values=(publish?jobPublishSchema:jobDraftValuesSchema).parse(draft.values);
    z.object({step:z.number().int().min(0).max(6),reached:z.number().int().min(0).max(6)}).refine((v)=>v.step<=v.reached).parse(draft);
    const ctx=contexts.get(draft.editorToken??"");if(!ctx||ctx.context.key!==key)throw new Error("Reload this job draft before saving.");
    revision(draft.version);revision(draft.jobVersion);
    const previous=pending.get(key)??Promise.resolve();
    const work=previous.then(async()=>{
      // The same draft object carries revisions returned by its own confirmed writes.
      const body={version:ctx.version,jobVersion:ctx.jobVersion,values,step:draft.step,reached:draft.reached,...(draft.generated?{generated:draft.generated}:{generated:null})};
      const path=`${ctx.base}/drafts/${key}${publish?"/publish":""}`;
      const row=(await (publish?http.post<{data:DraftDto}>(path,body):http.patch<{data:DraftDto}>(path,body))).data;
      draft.version=row.version;draft.jobVersion=row.jobVersion;draft.savedAt=row.savedAt;
      ctx.version=row.version;ctx.jobVersion=row.jobVersion;
      ctx.context.draft={...row,editorToken:draft.editorToken};
    });
    pending.set(key,work.catch(()=>undefined));
    await work;
    if(publish)newDrafts.clear();
    return true;
  }
  return {
    reset(){contexts.clear();pending.clear();newDrafts.clear();},
    async rebaseJobDraft(key,draft,latestJobVersion){z.uuid().parse(key);revision(latestJobVersion);jobDraftValuesSchema.parse(draft.values);const ctx=contexts.get(draft.editorToken??"");if(!ctx||ctx.context.key!==key)throw new Error("Reload this draft before continuing.");await pending.get(key);const row=(await http.post<{data:DraftDto}>(`${ctx.base}/drafts/${key}/rebase`,{version:ctx.version,latestJobVersion,confirmed:true})).data;ctx.version=row.version;ctx.jobVersion=row.jobVersion;ctx.context.draft={...row,editorToken:draft.editorToken};return {...draft,version:row.version,jobVersion:row.jobVersion};},
    async openJobDraft(id,creationKey=crypto.randomUUID()){
      if(id)z.uuid().parse(id);
      z.uuid().parse(creationKey);
      if(!id&&newDrafts.has(creationKey))return newDrafts.get(creationKey)!;
      const open=async()=>{const base=await hiringPath(auth);const ctx:JobDraftContext=(await http.post<{data:components["schemas"]["JobDraftContext"]}>(`${base}/drafts`,id?{job_id:id}:{creation_key:creationKey})).data;const token=crypto.randomUUID();ctx.draft.editorToken=token;contexts.set(token,{base,context:ctx,version:revision(ctx.draft.version),jobVersion:revision(ctx.draft.jobVersion)});return ctx;};
      if(!id){const opened=open().catch((error)=>{newDrafts.delete(creationKey);throw error;});newDrafts.set(creationKey,opened);if(newDrafts.size>10)newDrafts.delete(newDrafts.keys().next().value!);return opened;}
      return open();
    },
    storeJobDraft:(key,draft)=>write(key,draft),
    async saveJobAsDraft(key,draft){if(!draft.values.title.trim())throw new Error("Add a job title before saving a draft.");await write(key,draft);return {ok:true,editingPublished:!!draft.existingId};},
    publishJob:(key,draft)=>write(key,draft,true),
    async discardJobDraft(key){z.uuid().parse(key);const ctx=[...contexts.values()].findLast((c)=>c.context.key===key);if(!ctx)throw new Error("Reload this draft before discarding.");await pending.get(key);await http.delete(`${ctx.base}/drafts/${key}`,{version:ctx.version});newDrafts.clear();},
    async getPostDraft(){throw new Error("Post editing is connected in Phase 5.");},
    async storePostDraft(){throw new Error("Post editing is connected in Phase 5.");},
  };
}
