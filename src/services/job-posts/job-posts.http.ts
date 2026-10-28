import type { components as JobComponents } from "@/types/generated/job-module-v2";
import type { HttpClient } from "../api/client";
import type { AuthService } from "../auth/auth.service";
import type { JobPostsService, JobDraftContext } from "./job-posts.service";
import type { JobDraft } from "@/types/domain";
import { jobEditorPayload, jobEditorErrors, jobEditorValues } from "@/lib/domain/job-editor";
import type { JobValuesV2 } from "@/lib/validation/job-v2";
import { z } from "zod";

export async function hiringPath(auth: AuthService): Promise<string> {
  const session=await auth.me();
  const workspace=session.workspaces.find((w)=>w.id===session.selected_identity_id&&w.kind==="recruiter");
  if(!workspace?.organization)throw new Error("Select an active organization workspace first.");
  return `organizations/${workspace.organization.id}/hiring`;
}
type DraftDto = JobComponents["schemas"]["JobDraftV2"];
const options = {headers:{"X-Skillora-Job-Schema":"2"}};
const editorDraft = (row: DraftDto): JobDraft => ({...row,values:row.values.schemaVersion===2?jobEditorValues(row.values as JobValuesV2):row.values as unknown as JobDraft["values"]});
export function createHttpJobPostsService(http:HttpClient,auth:AuthService):JobPostsService & {reset():void} {
  const contexts=new Map<string,{base:string;context:JobDraftContext;version:number;jobVersion:number}>();
  const pending=new Map<string,Promise<void>>();
  const newDrafts=new Map<string,Promise<JobDraftContext>>();
  const revision=(n:number|undefined)=>z.number().int().min(1).parse(n);
  async function write(key:string,draft:JobDraft,publish=false){
    z.uuid().parse(key);
    // Check syntax before any request, including session/workspace reads.
    const invalid=jobEditorErrors(draft.values,publish?"publish":"draft");
    if(Object.keys(invalid).length)throw new Error(Object.values(invalid)[0]);
    const values=jobEditorPayload(draft.values,publish?"publish":"draft");
    z.object({step:z.number().int().min(0).max(6),reached:z.number().int().min(0).max(6)}).refine((v)=>v.step<=v.reached).parse(draft);
    const ctx=contexts.get(draft.editorToken??"");if(!ctx||ctx.context.key!==key)throw new Error("Reload this job draft before saving.");
    if(draft.reached>ctx.context.draft.reached){const invalid=jobEditorErrors(draft.values,draft.reached-1);if(Object.keys(invalid).length)throw new Error(Object.values(invalid)[0]);}
    if(publish&&draft.generated&&!draft.values.aiVerified)throw new Error("Review the generated content before publishing.");
    if(draft.generated)z.object({mode:z.literal("template-demo"),role:z.string().trim().min(1).max(100),at:z.iso.datetime()}).parse(draft.generated);
    revision(draft.version);revision(draft.jobVersion);
    const previous=pending.get(key)??Promise.resolve();
    const work=previous.then(async()=>{
      // The same draft object carries revisions returned by its own confirmed writes.
      const body={version:ctx.version,jobVersion:ctx.jobVersion,values,step:draft.step,reached:draft.reached,...(draft.generated?{generated:draft.generated}:{generated:null})};
      const path=`${ctx.base}/drafts/${key}${publish?"/publish":""}`;
      const row=(await (publish?http.post<{data:DraftDto}>(path,body,options):http.patch<{data:DraftDto}>(path,body,options))).data;
      draft.version=row.version;draft.jobVersion=row.jobVersion;draft.savedAt=row.savedAt;
      ctx.version=row.version;ctx.jobVersion=row.jobVersion;
      ctx.context.draft={...editorDraft(row),editorToken:draft.editorToken};
    });
    pending.set(key,work.catch(()=>undefined));
    await work;
    if(publish)newDrafts.clear();
    return true;
  }
  return {
    reset(){contexts.clear();pending.clear();newDrafts.clear();},
    async rebaseJobDraft(key,draft,latestJobVersion){z.uuid().parse(key);revision(latestJobVersion);jobEditorPayload(draft.values);const ctx=contexts.get(draft.editorToken??"");if(!ctx||ctx.context.key!==key)throw new Error("Reload this draft before continuing.");await pending.get(key);const row=(await http.post<{data:DraftDto}>(`${ctx.base}/drafts/${key}/rebase`,{version:ctx.version,latestJobVersion,confirmed:true},options)).data;ctx.version=row.version;ctx.jobVersion=row.jobVersion;ctx.context.draft={...editorDraft(row),editorToken:draft.editorToken};return {...draft,version:row.version,jobVersion:row.jobVersion};},
    async openJobDraft(id,creationKey=crypto.randomUUID()){
      if(id)z.uuid().parse(id);
      z.uuid().parse(creationKey);
      if(!id&&newDrafts.has(creationKey))return newDrafts.get(creationKey)!;
      const open=async()=>{const base=await hiringPath(auth);const wire=(await http.post<{data:JobComponents["schemas"]["JobDraftContextV2"]}>(`${base}/drafts`,id?{job_id:id}:{creation_key:creationKey},options)).data;const ctx:JobDraftContext={...wire,draft:editorDraft(wire.draft),latestJob:wire.latestJob?{...wire.latestJob,wizardValues:wire.latestJob.wizardValues?.schemaVersion===2?jobEditorValues(wire.latestJob.wizardValues as JobValuesV2):wire.latestJob.wizardValues as unknown as JobDraft["values"]}:wire.latestJob};const token=crypto.randomUUID();ctx.draft.editorToken=token;contexts.set(token,{base,context:ctx,version:revision(ctx.draft.version),jobVersion:revision(ctx.draft.jobVersion)});return ctx;};
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
