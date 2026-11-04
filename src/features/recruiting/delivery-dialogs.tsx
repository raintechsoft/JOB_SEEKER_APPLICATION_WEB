"use client";
import { ContentSkeleton } from "@/components/ui/skeleton";
import {useEffect,useState} from "react";
import {useServiceQuery,useServices} from "@/hooks/use-services";
import {useFormAction} from "@/hooks/use-form-action";
import {exportRequestSchema,outreachSendSchema} from "@/lib/validation/communication";
import {Button} from "@/components/ui/primitives";
import {ErrorState} from "@/components/ui/state-views";
import {StatePanel} from "@/components/ui/state-panel";
import {downloadBlob} from "@/lib/utils/files";
import {modal} from "@/stores/modal-store";
import {toast} from "@/stores/toast-store";
import type {components} from "@/types/generated/api";

type ExportState=components["schemas"]["ExportStatus"]["state"];
/** People-facing wording for each background export state. */
const EXPORT_STATE_LABELS:Record<ExportState,string>={pending:"Your export is queued.",processing:"Your export is being prepared.",ready:"Your export is ready to download.",failed:"Your export couldn’t be prepared.",expired:"This export has expired."};

export function OutreachDeliveryReview({id}:{id:string}){
 const q=useServiceQuery(["outreach-preview",id],(s)=>s.recruiting.outreachPreview!(id),{keepPreviousData:false});const [errors,setErrors]=useState<Record<string,string>>({});const {execute,pending}=useFormAction(setErrors);
 if(q.isError)return <ErrorState compact error={q.error} onRetry={()=>q.refetch()} title="This outreach draft couldn’t load" description="Check recipient access, then try again." />;
 if(!q.data)return <ContentSkeleton layout="form" label="Loading outreach draft" />;
 const draft=q.data;
 return <form className="stack" noValidate onSubmit={async(e)=>{e.preventDefault();const input=outreachSendSchema.safeParse({id,version:draft.version,confirmed:new FormData(e.currentTarget).has("confirmed")});if(!input.success){setErrors({_form:input.error.issues[0].message});return;}if(!await execute((s)=>s.recruiting.sendOutreach!(id,input.data.version,true)))return;modal.close();toast("Outreach queued for delivery. Delivery status is tracked separately.");}}>
  {errors._form&&<p role="alert" className="error">{errors._form}</p>}
  <h3>{draft.subject}</h3><p style={{whiteSpace:"pre-wrap"}}>{draft.message}</p><ul>{draft.recipients.map((r)=><li key={r.applicationId}>{r.name} · {r.email}</li>)}</ul>
  {draft.state==="queued"?<p role="status">This outreach is already queued.</p>:<><label className="check-row"><input type="checkbox" name="confirmed" disabled={pending}/>I reviewed the recipients and message and want to queue email delivery.</label><Button type="submit" loading={pending} disabled={pending}>Queue email delivery</Button></>}
 </form>;
}
export function ExportProgress({id}:{id:string}){
 const q=useServiceQuery(["export-status",id],(s)=>s.recruiting.exportStatus!(id),{keepPreviousData:false});const services=useServices();const [errors,setErrors]=useState<Record<string,string>>({});const {execute,pending}=useFormAction(setErrors);
 const state=q.data?.state;
 const [timedOut,setTimedOut]=useState(false),[attempt,setAttempt]=useState(0);
 const refetch=q.refetch,expires=q.data?.expiresAt;
 useEffect(()=>{
  if(state==="ready"||state==="failed"||state==="expired")return;
  const timer=setTimeout(()=>setTimedOut(true),120_000);
  return()=>clearTimeout(timer);
 },[id,state,attempt]);
 useEffect(()=>{
  if(!expires||state==="expired")return;
  const remaining=new Date(expires).getTime()-Date.now();
  if(!Number.isFinite(remaining))return;
  const timer=setTimeout(()=>void refetch(),Math.max(0,remaining)+100);
  return()=>clearTimeout(timer);
 },[expires,refetch,state]);
 if(q.isError&&!q.data)return <ErrorState compact error={q.error} onRetry={()=>q.refetch()} title="Export status couldn’t load" description="Your export may still be in progress. Try again to check its status." />;
 if(state==="failed")return <StatePanel compact role="alert" icon="alert" tone="danger" title="Export couldn’t be prepared" description="Check that you still have access to these responses, then request a new export." actions={<Button onClick={()=>modal.close()}>Close</Button>} />;
 if(state==="expired")return <StatePanel compact icon="hourglass" tone="neutral" title="This export has expired" description="Completed files are available for 24 hours. Request a new export to download the latest responses." actions={<Button onClick={()=>modal.close()}>Close</Button>} />;
 return <div className="stack">{errors._form&&<p role="alert" className="error">{errors._form}</p>}<p role="status">{timedOut&&state!=="ready"?"This is taking longer than expected. Your export may still finish in the background.":EXPORT_STATE_LABELS[state??"pending"]} Completed files are available for 24 hours.</p>{timedOut&&state!=="ready"&&<Button disabled={q.isFetching} onClick={()=>{setTimedOut(false);setAttempt(value=>value+1);void refetch();}}>Check status</Button>}{state==="ready"&&<Button loading={pending} disabled={pending} onClick={async()=>{let file:Blob|undefined;if(!await execute(async()=>{file=await services.recruiting.downloadExport!(id);}))return;if(file)downloadBlob("skillora-responses.csv",file);}}>Download private CSV</Button>}</div>;
}
export function ExportRequest({ids}:{ids:string[]}){
 const [errors,setErrors]=useState<Record<string,string>>({});const {execute,pending}=useFormAction(setErrors);
 return <form className="stack" noValidate onSubmit={async(e)=>{e.preventDefault();const input=exportRequestSchema.safeParse({ids});if(!input.success){setErrors({_form:input.error.issues[0].message});return;}let id:string|undefined;if(!await execute(async(s)=>{id=await s.recruiting.requestExport!(input.data.ids);}))return;if(id)modal.show("Background export",<ExportProgress id={id}/>);}}><p>Prepare a private CSV for {ids.length} selected responses. Access is checked again before generation and download.</p>{errors._form&&<p role="alert" className="error">{errors._form}</p>}<Button type="submit" loading={pending} disabled={pending}>Queue CSV export</Button></form>;
}
