"use client";
import { useHiringQuery } from "@/hooks/use-hiring-query";

import { InfoBadge } from "@/components/ui/info-badge";

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

import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Avatar, Button, LinkButton, Tags } from "@/components/ui/primitives";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { QueryFeedback } from "@/components/ui/query-view";

function ReviewForm({ id }: { id: Id }) {
  const {data,isError,error,refetch}=useHiringQuery(["review",id],(s,scope)=>s.recruiting.getReview(id,scope));
  return data?<ReviewEditor initialData={data}/>:<QueryFeedback data={data} error={isError} cause={error} compact retry={refetch} layout="form" label="Loading application review" />;
}

const daysLabel = (value: number | string | null | undefined) => {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n === 0 ? "Immediate" : n + " days";
};

/**
 * What the applicant submitted for this job: the same fields the responses table shows.
 * Prefers the submission-time profile; falls back to the raw recruitment details for older rows.
 */
function ApplicationFacts({ data }: { data: ReviewView }) {
  const a = data.application;
  const p = data.profile;
  const d = a.recruitmentDetails ?? {};
  const location = [p ? p.location : d.location, p ? p.locality : d.locality].filter(Boolean).join(" · ");
  const facts: [string, string][] = [
    ["Email", p?.email || a.email || ""],
    ["Phone", p?.phone || d.phone || ""],
    ["Location", location],
    ["Notice period", daysLabel(p ? p.notice : d.noticeDays)],
    ["Can join in", daysLabel(p ? p.joining : d.joiningDays)],
    ["Preferred locations", p?.preferredLocations || d.preferredLocations || ""],
    ["Experience", p && Number.isFinite(p.years) ? p.years + " years" : ""],
    ["Education", p?.educationText || ""],
  ];
  const skills = p?.skills ?? [];
  return (
    <div className="response-detail-grid review-application-grid" role="list" aria-label="Submitted application details">
      {facts.map(([label, value]) => (
        <div key={label} role="listitem" className="review-application-row">
          <span>{label}</span>
          <p className={value ? undefined : "is-empty"}>{value || "Not provided"}</p>
        </div>
      ))}
      <div role="listitem" className="review-application-row">
        <span>Skills</span>
        {skills.length ? <Tags items={skills} /> : <p className="is-empty">Not provided</p>}
      </div>
    </div>
  );
}

export function ReviewEditor({initialData}:{initialData:ReviewView}){
  const [data,setData]=useState(initialData);
  const changed=initialData.application.version!==data.application.version;
  const [errors,setErrors]=useState<Record<string,string>>({});
  const {execute,pending}=useFormAction(setErrors);
  const { application: a, person: p } = data;
  const id=a.id;
  return (
    <form
      key={data.application.version}
      id="recruiter-review-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if(changed)return;
        const f = new FormData(e.currentTarget);
        const checked=reviewSchema.safeParse({ status: String(f.get("status")), note: String(f.get("note") || "").trim(), followUp: String(f.get("followUp") || "") });
        if(!checked.success)return setErrors(validationFields(checked.error));
        const ok=await execute((s)=>s.recruiting.saveReview(id,{...checked.data,version:a.version}),{invalidate:["jobs-manager","responses","review","hiring-summary","jobs","job","feed","applications"]});
        if(!ok)return;
        modal.close();
        toast(devCopy("Changes saved in your demo workspace.", "Changes saved."));
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
      <div className="stack" style={{ gap: 8 }}>
        <h3>Application details</h3>
        <ApplicationFacts data={data} />
      </div>
      {!!a.screeningAnswers?.length && (
        <div className="stack" style={{ gap: 8 }}>
          <h3>Screening answers</h3>
          <ol className="review-screening-list">
            {a.screeningAnswers.map((answer, index) => (
              <li key={answer.id} className="review-screening-item">
                <p className="review-screening-question">
                  <span className="review-screening-index">Q{index + 1}</span>
                  {answer.question}
                </p>
                <p className={"review-screening-answer" + (answer.answer ? "" : " is-empty")}>
                  {answer.answer === "yes" ? "Yes" : answer.answer === "no" ? "No" : answer.answer || "No answer"}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
      <LinkButton href={"/recruiter/talent/" + p.id} icon="arrowUp">
        Explore candidate profile
      </LinkButton>
      {errors._form&&<p role="alert" className="error">{errors._form}</p>}
      {changed&&<div className="notice" role="status">This application changed. Your entered notes are retained. Reload the current review before saving.<Button onClick={()=>setData(initialData)}>Reload current review</Button></div>}
      {a.withdrawnAt&&<p className="notice">The applicant withdrew this application. Its hiring stage cannot change.</p>}
      <SelectField required label="Hiring status" name="status" error={errors.status} defaultValue={a.status} options={isPrototype?HIRING_STAGES:[a.status,...(a.withdrawnAt?[]:RECRUITING_RULES.transitions[a.status])]} />
      <TextAreaField label="Private hiring notes" name="note" error={errors.note} defaultValue={a.recruiterNote} maxLength={2000} />
      <TextField label="Follow-up date" name="followUp" error={errors.followUp} type="date" defaultValue={a.followUp} />
      <InfoBadge label="Application status information">Status changes appear in the candidate’s application tracker. Hiring notes and follow-up dates stay private to your team.</InfoBadge>
      {!!a.history?.length&&<details><summary>Private review history</summary>{a.history.map((event)=><p key={event.id} className="small"><strong>{event.author}</strong> · {event.kind==="stage"?`${event.from} → ${event.to}`:event.body||"Note cleared"}</p>)}</details>}
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" loading={pending} disabled={pending||changed}>
          Save review
        </Button>
      </div>
    </form>
  );
}

export const openReview = (id: Id) => modal.show("Review application", <ReviewForm id={id} />, "project");
