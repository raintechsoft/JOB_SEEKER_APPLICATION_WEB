"use client";

import {useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {useServices} from "@/hooks/use-services";
import {downloadBlob} from "@/lib/utils/files";
import {errorMessage} from "@/services/api/client";
import type {components} from "@/types/generated/application-wizard-v2";
type Sharing=components["schemas"]["ApplicationSharing"];
export const sharedPayLabel=(pay:Sharing["expectedCompensation"])=>pay?`${pay.currency} ${pay.amount} / ${pay.period}`:"Not shared";

export function ApplicationSharingDetails({sharing,applicationId,reviewer=false}:{sharing:Sharing;applicationId:string;reviewer?:boolean}) {
  const services=useServices();const lock=useRef(false);
  const [pending,setPending]=useState(false),[error,setError]=useState("");
  async function download(file:Sharing["attachments"][number]) {
    if(lock.current)return;lock.current=true;setPending(true);setError("");
    try {
      let blob:Blob;
      if(reviewer){
        const session=await services.auth.me();const selected=session.workspaces.find(item=>item.id===session.selected_identity_id&&item.kind==="recruiter");
        if(!selected?.organization)throw new Error("Use the hiring workspace that has access to this application.");
        blob=await services.applicationDocuments.reviewerDownload(selected.organization.id,applicationId,file.id);
      }else blob=await services.applicationDocuments.applicantDownload(applicationId,file.id);
      downloadBlob(file.name,blob);
    }catch(e){setError(errorMessage(e));}finally{lock.current=false;setPending(false);}
  }
  return <section className="stack" aria-label="Submitted application details"><h3>Shared application details</h3><p>Expected pay: {sharedPayLabel(sharing.expectedCompensation)}</p><p>Email verified at submission{sharing.verification.phone?.verifiedAt?" · Phone verified at submission":""}.</p>{sharing.attachments.map(file=><Button key={file.id} disabled={pending} onClick={()=>void download(file)}>Download submitted resume: {file.name}</Button>)}{error&&<p role="alert">{error}</p>}{sharing.portfolio&&<><h3>Included portfolio: {sharing.portfolio.title}</h3>{sharing.portfolio.items.map(item=><section key={`${item.kind}:${item.id}`}><h4>{item.title}</h4><p style={{whiteSpace:"pre-wrap"}}>{item.description}</p>{item.url&&<p>{item.url}</p>}</section>)}</>}</section>;
}
