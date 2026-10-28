"use client";

import { InfoBadge } from "@/components/ui/info-badge";

import type { Id, JobAlert } from "@/types/domain";
import {useState} from "react";
import {jobAlertSchema} from "@/services/jobs/jobs.http";
import {validationFields} from "@/lib/validation/profile";
import {useFormAction} from "@/hooks/use-form-action";
import { normalizeKeywords } from "@/lib/domain/jobs";
import { track } from "@/lib/analytics";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Button, IconButton } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { SelectField, TextField } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/feedback";

function AlertEditor({ alert }: { alert: JobAlert | null }) {
  const [errors,setErrors]=useState<Record<string,string>>({});
  const {execute,pending}=useFormAction(setErrors);
  const dialogs = useJobAlertDialogs();
  return (
    <form
      id="job-alert-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const get = (k: string) => String(f.get(k) || "").trim();
        if (!normalizeKeywords(get("keywords"))) {
          toast("Enter a job title or skill to match.");
          return;
        }
        const input = { id: alert?.id, name: get("name"), keywords: get("keywords"), location: get("location"), arrangement: get("arrangement") as JobAlert["arrangement"], days: Number(get("days")), enabled: f.has("enabled") };
        const checked=jobAlertSchema.safeParse(input);
        if(!checked.success)return setErrors(validationFields(checked.error));
        if(!await execute((s)=>s.jobs.saveAlert({...checked.data,...(alert?{id:alert.id}:{})})))return;
        track("job_alert_saved", { arrangement: input.arrangement, days: input.days });
        modal.close();
        toast("Job alert saved. Matching opportunities are up to date.");
      }}
    >
      {Object.entries(errors).map(([key,error])=><p role="alert" key={key}>{key}: {error}</p>)}
      <TextField label="Alert name" name="name" defaultValue={alert?.name ?? ""} required maxLength={70} placeholder="e.g. Product design roles" />
      <TextField label="Job title or skills" name="keywords" defaultValue={alert?.keywords ?? ""} required maxLength={120} placeholder="e.g. Product Designer or React" />
      <p className="small muted">A role must match all entered keywords in its title or skills.</p>
      <TextField label="Location" name="location" defaultValue={alert?.location ?? ""} maxLength={100} placeholder="e.g. Bengaluru or India" />
      <div className="grid cols2">
        <SelectField required label="Work arrangement" name="arrangement" defaultValue={alert?.arrangement ?? "Any"} options={["Any", "Remote", "Hybrid", "On-site"]} />
        <SelectField required
          label="Posted within"
          name="days"
          defaultValue={String(alert?.days || 7)}
          options={[
            { value: "1", label: "Last 24 hours" },
            { value: "3", label: "Last 3 days" },
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
          ]}
        />
      </div>
      <label className="check-row">
        <input name="enabled" type="checkbox" defaultChecked={!alert || alert.enabled} />
        Keep this alert active
      </label>
      <DevOnly>
        <InfoBadge label="Job alert information">Alerts filter the fictional jobs in this browser. They don’t send email or monitor external job boards.</InfoBadge>
      </DevOnly>
      <div className="modal-footer">
        {alert && (
          <Button variant="danger sm" icon="trash" onClick={() => dialogs.remove(alert.id)}>
            Delete alert
          </Button>
        )}
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="bell" loading={pending} disabled={pending}>
          Save alert
        </Button>
      </div>
    </form>
  );
}

function AlertManager() {
  const dialogs = useJobAlertDialogs();
  const { data: alerts } = useServiceQuery(["job-alerts"], (s) => s.jobs.listAlerts());
  if (!alerts) return null;
  return (
    <div id="job-alert-manager" className="stack">
      <p className="small muted">Manage the alerts that supply your Alert matches list. Paused alerts stop contributing matches.</p>
      {alerts.length ? (
        alerts.map((a) => (
          <div className="manage-alert-row" key={a.id}>
            <div>
              <h3>{a.name}</h3>
              <p>
                {a.keywords} · {a.location || "All locations"} · Last {a.days} days
              </p>
            </div>
            <div className="row gap8">
              <Button variant="sm" onClick={() => dialogs.toggle(a.id)}>
                {a.enabled ? "Pause" : "Resume"}
              </Button>
              <IconButton icon="edit" label={"Edit " + a.name} onClick={() => dialogs.edit(a.id)} />
            </div>
          </div>
        ))
      ) : (
        <p className="small muted">You don’t have any alerts yet.</p>
      )}
      <div className="modal-footer">
        <Button variant="primary" icon="plus" onClick={() => dialogs.edit()}>
          New alert
        </Button>
      </div>
    </div>
  );
}

export function useJobAlertDialogs() {
  const run = useServiceAction();
  const services = useServices();
  return {
    edit: async (id?: Id) => {
      const alert = id ? ((await services.jobs.listAlerts()).find((a) => a.id === id) ?? null) : null;
      modal.show(alert ? "Fine-tune your job alert." : "Make room for your next opportunity.", <AlertEditor alert={alert} />);
    },
    manage: () => modal.show("Your next role, on your radar.", <AlertManager />),
    toggle: async (id: Id) => {
      const enabled = await run((s) => s.jobs.toggleAlert(id));
      if (enabled === null || enabled === undefined) return;
      toast(enabled ? "Job alert resumed." : "Job alert paused.");
    },
    remove: (id: Id) =>
      confirmAction("Delete this job alert?", "This removes the alert from your browser. Saved jobs stay in your Saved feed.", async () => {
        await run((s) => s.jobs.deleteAlert(id));
        modal.close();
        toast("Job alert deleted.");
      }, "Delete alert"),
  };
}
