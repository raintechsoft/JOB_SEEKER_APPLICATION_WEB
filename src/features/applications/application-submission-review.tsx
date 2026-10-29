"use client";

import {Button} from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton";
import {ApplicationDraftReview} from "./application-fields";
import type {useApplicationEditor} from "./use-application-editor";

export function ApplicationSubmissionReview({editor}:{editor:ReturnType<typeof useApplicationEditor>}) {
  const review=editor.review;
  return <div className="wizard-section application-review">
    <ApplicationDraftReview editor={editor}/>
    {editor.reviewLoading&&<section aria-busy="true" aria-label="Loading review"><Skeleton style={{display:"block",height:24,width:180,marginBottom:16}}/><Skeleton style={{display:"block",height:90}}/></section>}
    {review&&<>
      {review.portfolio&&<section><h3>Shared portfolio: {review.portfolio.title}</h3>{review.portfolio.items.map(item=><div key={`${item.kind}:${item.id}`}><strong>{item.title}</strong><p className="application-preserve-text">{item.description}</p>{item.url&&<p>{item.url}</p>}</div>)}</section>}
      <label className="wizard-check"><input type="checkbox" required checked={editor.acknowledgedSharing} onChange={event=>editor.setAcknowledgedSharing(event.target.checked)}/>I confirm that I have reviewed and verified the details above, and agree to share this information and the selected documents with {editor.context.companyName}.<span aria-hidden="true"> *</span></label>
    </>}
    {!review&&!editor.reviewLoading&&!editor.submissionUncertain&&<Button disabled={editor.working} onClick={()=>void (editor.blocked?editor.reload():editor.reloadReview())}>Reload review</Button>}
    {editor.submissionUncertain&&<section role="alert"><p>Check whether the application was received before trying again.</p><div className="row wrap"><Button disabled={editor.working} onClick={()=>void editor.checkSubmission()}>Check submission</Button><Button disabled={editor.working} onClick={()=>void editor.retrySubmission()}>Retry same submission</Button></div></section>}
  </div>;
}
