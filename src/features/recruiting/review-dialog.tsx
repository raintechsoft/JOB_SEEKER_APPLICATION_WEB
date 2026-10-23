"use client";

import type { Id } from "@/types/domain";
import { useState } from "react";
import { reviewSchema } from "@/lib/validation/application";
import { validationFields } from "@/lib/validation/profile";
import { useFormAction } from "@/hooks/use-form-action";
import { RECRUITING_RULES } from "@/lib/validation/recruiting";
import { isPrototype } from "@/lib/env/app-env";
import { HIRING_STAGES } from "@/services/recruiting/recruiting.service";
import type {ReviewView} from "@/services/recruiting/recruiting.service";
import { devCopy } from "@/lib/env/app-env";
import { useServiceQuery } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Avatar, Button, LinkButton } from "@/components/ui/primitives";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";

function ReviewForm({ id }: { id: Id }) {
  const {data,isError}=useServiceQuery(["review",id],(s)=>s.recruiting.getReview(id),{keepPreviousData:false});
  if(isError)return <p role="alert">This application could not be loaded. Please retry.</p>;
  return data?<ReviewEditor initialData={data}/>:null;
}

export function ReviewEditor({initialData}:{initialData:ReviewView}){
  const [data]=useState(initialData);
  const [errors,setErrors]=useState<Record<string,string>>({});
  const {execute,pending}=useFormAction(setErrors);
  const { application: a, person: p } = data;
  const id=a.id;
  return (
    <form
      id="recruiter-review-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const checked=reviewSchema.safeParse({ status: String(f.get("status")), note: String(f.get("note") || "").trim(), followUp: String(f.get("followUp") || "") });
        if(!checked.success)return setErrors(validationFields(checked.error));
        const ok=await execute((s)=>s.recruiting.saveReview(id,{...checked.data,version:a.version}),{invalidate:["jobs-manager","responses","review","hiring-summary","jobs","job","feed","applications"]});
        if(!ok)return;
        modal.close();
        toast(ok ? devCopy("Changes saved in your demo workspace.", "Changes saved.") : "Changes kept for this session; browser storage is unavailable.");
      }}
    >
      <div className="row">
        <Avatar person={p} size="lg" />
        <div>
          <h3>{p.name}</h3>
          <p className="small muted">{p.headline}</p>
        </div>
      </div>
      <div>
        <h3>{data.jobTitle}</h3>
        <p className="small muted">{a.note || "No introduction included."}</p>
      </div>
      {!!a.screeningAnswers?.length && (
        <div>
          <h3>Screening answers</h3>
          {a.screeningAnswers.map((answer) => (
            <p className="small muted" key={answer.id}>
              <strong>{answer.question}</strong>
              <br />
              {answer.answer || "No answer"}
            </p>
          ))}
        </div>
      )}
      <LinkButton href={"/recruiter/talent/" + p.id} icon="arrowUp">
        Explore candidate profile
      </LinkButton>
      {errors._form&&<p role="alert">{errors._form}</p>}
      {a.withdrawnAt&&<p className="notice">The applicant withdrew this application. Its hiring stage cannot change.</p>}
      <SelectField label="Hiring status" name="status" error={errors.status} defaultValue={a.status} options={isPrototype?HIRING_STAGES:[a.status,...(a.withdrawnAt?[]:RECRUITING_RULES.transitions[a.status])]} />
      <TextAreaField label="Private hiring notes" name="note" error={errors.note} defaultValue={a.recruiterNote} maxLength={2000} />
      <TextField label="Follow-up date (optional)" name="followUp" error={errors.followUp} type="date" defaultValue={a.followUp} />
      <p className="notice">{devCopy("Saved locally. Updating a status does not notify the candidate.", "Updating a status does not notify the candidate.")}</p>
      {!!a.history?.length&&<details><summary>Private review history</summary>{a.history.map((event)=><p key={event.id} className="small"><strong>{event.author}</strong> · {event.kind==="stage"?`${event.from} → ${event.to}`:event.body||"Note cleared"}</p>)}</details>}
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          Save review
        </Button>
      </div>
    </form>
  );
}

export const openReview = (id: Id) => modal.show("Review application", <ReviewForm id={id} />, "project");
