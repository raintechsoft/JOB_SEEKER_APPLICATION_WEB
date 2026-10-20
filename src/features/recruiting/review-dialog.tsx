"use client";

import type { HiringStage, Id } from "@/types/domain";
import { HIRING_STAGES } from "@/services/recruiting/recruiting.service";
import { devCopy } from "@/lib/env/app-env";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Avatar, Button, LinkButton } from "@/components/ui/primitives";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";

function ReviewForm({ id }: { id: Id }) {
  const run = useServiceAction();
  const { data } = useServiceQuery(["review", id], (s) => s.recruiting.getReview(id));
  if (!data) return null;
  const { application: a, person: p } = data;
  return (
    <form
      id="recruiter-review-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const ok = await run((s) => s.recruiting.saveReview(id, { status: String(f.get("status")) as HiringStage, note: String(f.get("note") || "").trim(), followUp: String(f.get("followUp") || "") }));
        if (ok === undefined) return;
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
      <SelectField label="Hiring status" name="status" defaultValue={a.status} options={HIRING_STAGES} />
      <TextAreaField label="Private hiring notes" name="note" defaultValue={a.recruiterNote} maxLength={2000} />
      <TextField label="Follow-up date (optional)" name="followUp" type="date" defaultValue={a.followUp} />
      <p className="notice">{devCopy("Saved locally. Updating a status does not notify the candidate.", "Updating a status does not notify the candidate.")}</p>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save review
        </Button>
      </div>
    </form>
  );
}

export const openReview = (id: Id) => modal.show("Review application", <ReviewForm id={id} />, "project");
