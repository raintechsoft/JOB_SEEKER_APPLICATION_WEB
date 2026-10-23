"use client";
import { ContentSkeleton } from "@/components/ui/skeleton";
import {useState} from "react";
import {useServiceQuery,useServices} from "@/hooks/use-services";
import {useFormAction} from "@/hooks/use-form-action";
import {exportRequestSchema,outreachSendSchema} from "@/lib/validation/communication";
import {Button} from "@/components/ui/primitives";
import {downloadBlob} from "@/lib/utils/files";
import {modal} from "@/stores/modal-store";
import {toast} from "@/stores/toast-store";

export function OutreachDeliveryReview({id}:{id:string}){
 const q=useServiceQuery(["outreach-preview",id],(s)=>s.recruiting.outreachPreview!(id),{keepPreviousData:false});const [errors,setErrors]=useState<Record<string,string>>({});const {execute,pending}=useFormAction(setErrors);
 if(q.isError)return <p role="alert">This outreach draft could not be loaded. Check recipient access and try again. <Button onClick={()=>void q.refetch()}>Try again</Button></p>;
 if(!q.data)return <ContentSkeleton layout="form" label="Loading outreach draft" />;
 const draft=q.data;
 return <form className="stack" noValidate onSubmit={async(e)=>{e.preventDefault();const input=outreachSendSchema.safeParse({id,version:draft.version,confirmed:new FormData(e.currentTarget).has("confirmed")});if(!input.success){setErrors({_form:input.error.issues[0].message});return;}if(!await execute((s)=>s.recruiting.sendOutreach!(id,input.data.version,true)))return;modal.close();toast("Outreach queued for delivery. Delivery status is tracked separately.");}}>
  {errors._form&&<p role="alert" className="error">{errors._form}</p>}
  <h3>{draft.subject}</h3><p style={{whiteSpace:"pre-wrap"}}>{draft.message}</p><ul>{draft.recipients.map((r)=><li key={r.applicationId}>{r.name} · {r.email}</li>)}</ul>
  {draft.state==="queued"?<p role="status">This outreach is already queued.</p>:<><label className="check-row"><input type="checkbox" name="confirmed" disabled={pending}/>I reviewed the recipients and message and want to queue email delivery.</label><Button type="submit" loading={pending} disabled={pending}>Queue email delivery</Button></>}
 </form>;
}
export function ExportProgress({id}:{id:string}){
 const q=useServiceQuery(["export-status",id],(s)=>s.recruiting.exportStatus!(id),{refetchInterval:5000,keepPreviousData:false});const services=useServices();const [errors,setErrors]=useState<Record<string,string>>({});const {execute,pending}=useFormAction(setErrors);
 return <div className="stack">{errors._form&&<p role="alert">{errors._form}</p>}{q.isError?<p role="alert">Export status could not be loaded. <Button onClick={()=>void q.refetch()}>Try again</Button></p>:<p role="status">Export: {q.data?.state??"queued"}. Completed files are available for 24 hours.</p>}{q.data?.state==="ready"&&<Button loading={pending} disabled={pending} onClick={async()=>{let file:Blob|undefined;if(!await execute(async()=>{file=await services.recruiting.downloadExport!(id);}))return;if(file)downloadBlob("skillora-responses.csv",file);}}>Download private CSV</Button>}{q.data?.state==="failed"&&<p>Export could not be prepared. Check access and request a new export.</p>}</div>;
}
export function ExportRequest({ids}:{ids:string[]}){
 const [errors,setErrors]=useState<Record<string,string>>({});const {execute,pending}=useFormAction(setErrors);
 return <form className="stack" noValidate onSubmit={async(e)=>{e.preventDefault();const input=exportRequestSchema.safeParse({ids});if(!input.success){setErrors({_form:input.error.issues[0].message});return;}let id:string|undefined;if(!await execute(async(s)=>{id=await s.recruiting.requestExport!(input.data.ids);}))return;if(id)modal.show("Background export",<ExportProgress id={id}/>);}}><p>Prepare a private CSV for {ids.length} selected responses. Access is checked again before generation and download.</p>{errors._form&&<p role="alert">{errors._form}</p>}<Button type="submit" loading={pending} disabled={pending}>Queue CSV export</Button></form>;
}
