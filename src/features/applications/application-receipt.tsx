"use client";

import {useState} from "react";
import {useServices} from "@/hooks/use-services";
import {Button,LinkButton} from "@/components/ui/primitives";
import {downloadBlob} from "@/lib/utils/files";
import {errorMessage} from "@/services/api/client";
import type {ApplicationReceipt} from "./application-wizard-policy";

export function ApplicationReceiptView({receipt,title,companyName,returnTo}:{receipt:ApplicationReceipt;title:string;companyName:string;returnTo:string}) {
  const {applicationDocuments}=useServices();
  const [pending,setPending]=useState(false),[error,setError]=useState("");
  return <section className="card stack" aria-label="Application receipt"><h1>{receipt.schemaVersion===2?"Application submitted":"You have already applied"}</h1><p>{title} · {companyName}</p><p>Applied {new Date(receipt.submittedAt).toLocaleDateString()}</p><p>Reference: {receipt.id}</p>{receipt.contactVerification==="recorded"&&<p>Your verified email and selected application details were recorded at submission.</p>}{receipt.attachments.map(file=><Button key={file.id} disabled={pending} onClick={async()=>{if(pending)return;setPending(true);setError("");try{downloadBlob(file.name,await applicationDocuments.applicantDownload(receipt.id,file.id));}catch(e){setError(errorMessage(e));}finally{setPending(false);}}}>Download submitted resume: {file.name}</Button>)}{error&&<p role="alert">{error}</p>}<div className="row wrap"><LinkButton href="/app/applications?tab=applied" variant="primary">View your applications</LinkButton><LinkButton href={returnTo}>Back to opportunities</LinkButton></div></section>;
}
