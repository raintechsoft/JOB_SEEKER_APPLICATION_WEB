"use client";

import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {Icon} from "@/components/ui/icon";
import {LoadingRegion,Skeleton} from "@/components/ui/skeleton";
import {StatePanel} from "@/components/ui/state-panel";
import {modal} from "@/stores/modal-store";
import {ErrorState} from "@/components/ui/state-views";
import {useServices} from "@/hooks/use-services";
import {downloadBlob} from "@/lib/utils/files";
import {errorMessage} from "@/services/api/client";
import type {components} from "@/types/generated/application-wizard-v2";
type Sharing=components["schemas"]["ApplicationSharing"];
export const sharedPayLabel=(pay:Sharing["expectedCompensation"])=>pay?`${pay.currency} ${pay.amount} / ${pay.period}`:"Not shared";

type SubmittedFile=Sharing["attachments"][number];

/** Fetches a submitted attachment through the applicant route or the authorized reviewer route. */
function useSubmittedDocumentLoader(applicationId:string,reviewer:boolean){
  const services=useServices();
  return async (file:SubmittedFile):Promise<Blob>=>{
    let blob:Blob;
    if(reviewer){
      const session=await services.auth.me();const selected=session.workspaces.find(item=>item.id===session.selected_identity_id&&item.kind==="recruiter");
      if(!selected?.organization)throw new Error("Use the hiring workspace that has access to this application.");
      blob=await services.applicationDocuments.reviewerDownload(selected.organization.id,applicationId,file.id);
    }else blob=await services.applicationDocuments.applicantDownload(applicationId,file.id);
    // Keep the recorded type so the browser can display the file (the transport may report a generic type).
    return blob.type===file.mime?blob:new Blob([blob],{type:file.mime});
  };
}

/** Downloads a submitted attachment through the applicant or the authorized reviewer route. */
export function useSubmittedDocumentDownload(applicationId:string,reviewer=false){
  const load=useSubmittedDocumentLoader(applicationId,reviewer);const lock=useRef(false);
  const [pending,setPending]=useState(false),[error,setError]=useState("");
  async function download(file:SubmittedFile) {
    if(lock.current)return;lock.current=true;setPending(true);setError("");
    try{downloadBlob(file.name,await load(file));}catch(e){setError(errorMessage(e));}finally{lock.current=false;setPending(false);}
  }
  return {download,pending,error};
}

/** In-browser view of a submitted document: PDFs render inline; other formats offer the download. */
export function SubmittedDocumentViewer({file,applicationId,reviewer=false}:{file:SubmittedFile;applicationId:string;reviewer?:boolean}){
  const load=useSubmittedDocumentLoader(applicationId,reviewer);
  const {download,pending}=useSubmittedDocumentDownload(applicationId,reviewer);
  const [state,setState]=useState<{url?:string;error?:unknown}>({});
  const previewable=file.mime==="application/pdf";
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!previewable)return;
    let url:string|undefined,cancelled=false;
    load(file).then(blob=>{if(cancelled)return;url=URL.createObjectURL(blob);setState({url});}).catch(error=>{if(!cancelled)setState({error});});
    return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);};
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only for a new file or an explicit retry
  },[file.id,attempt,previewable]);
  return <div className="document-viewer">
    <div className="document-viewer-bar">
      <span className="document-viewer-name" title={file.name}><Icon name="file"/>{file.name}</span>
      <Button variant="primary sm" icon="download" disabled={pending} onClick={()=>void download(file)}>Download</Button>
    </div>
    {!previewable?<StatePanel icon="file" title="Preview isn’t available for this file type" description="Browsers can only show PDF files. Download the file to open it." actions={<Button variant="primary" icon="download" disabled={pending} onClick={()=>void download(file)}>Download {file.name}</Button>}/>
      :state.error?<ErrorState error={state.error} onRetry={()=>{setState({});setAttempt(n=>n+1);}} title="The resume couldn’t load" description="Try again, or download the file instead."/>
      :!state.url?<LoadingRegion label="Loading resume" className="document-viewer-frame"><Skeleton style={{height:"100%"}}/></LoadingRegion>
      :<iframe className="document-viewer-frame" src={state.url} title={"Resume: "+file.name}/>}
  </div>;
}

export function ApplicationSharingDetails({sharing,applicationId,reviewer=false}:{sharing:Sharing;applicationId:string;reviewer?:boolean}) {
  const {download,pending,error}=useSubmittedDocumentDownload(applicationId,reviewer);
  return <section className="stack" aria-label="Submitted application details"><h3>Shared application details</h3><p>Expected pay: {sharedPayLabel(sharing.expectedCompensation)}</p><p>Email verified at submission{sharing.verification.phone?.verifiedAt?" · Phone verified at submission":""}.</p>{sharing.attachments.map(file=><div className="row" key={file.id}><Button icon="eye" onClick={()=>modal.show("Resume · "+file.name,<SubmittedDocumentViewer file={file} applicationId={applicationId} reviewer={reviewer}/>,"project")}>View resume</Button><Button variant="text" icon="download" disabled={pending} onClick={()=>void download(file)} aria-label={"Download submitted resume: "+file.name}>Download</Button></div>)}{error&&<p role="alert">{error}</p>}{sharing.portfolio&&<><h3>Included portfolio: {sharing.portfolio.title}</h3>{sharing.portfolio.items.map(item=><section key={`${item.kind}:${item.id}`}><h4>{item.title}</h4><p style={{whiteSpace:"pre-wrap"}}>{item.description}</p>{item.url&&<p>{item.url}</p>}</section>)}</>}</section>;
}
