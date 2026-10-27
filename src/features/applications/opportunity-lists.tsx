"use client";

import type { ReactNode } from "react";
import type { ApplicationRecord, AlertRecord } from "@/services/applications/applications.service";
import { Button, IconButton } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { CompanyAvatar } from "@/components/jobs/job-visuals";
import { useJobActions } from "@/features/feed/job-dialogs";
import { useJobAlertDialogs } from "@/features/feed/job-alerts";
import { formatLongDate } from "@/lib/utils/date";

function OpportunityList({ label, heading, children }: { label: string; heading: string; children: ReactNode }) {
  return <div className="saved-opportunities"><table className="saved-opportunities-table opportunity-list-table" aria-label={label}>
    <thead><tr><th scope="col">{heading}</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
    <tbody>{children}</tbody>
  </table></div>;
}

export function AppliedOpportunities({ items, onDetails, onEdit }: { items: ApplicationRecord[]; onDetails: (id: string) => void; onEdit: (id: string) => void | Promise<void> }) {
  const jobs = useJobActions();
  return <OpportunityList label="Your applications" heading="Jobs">{items.map(application => {
    const job = application.jobRef;
    const companyName = job?.companyName ?? "Company unavailable";
    const title = job?.title ?? "Archived opportunity";
    const status = ["Interview","Offer","Shortlisted","Hired"].includes(application.status) ? "positive" : ["Rejected","Withdrawn"].includes(application.status) ? "muted-status" : "pending";
    return <tr key={application.id} data-application-id={application.id}>
      <td><div className="saved-opportunity-job">
        <CompanyAvatar company={{id:job?.companyId ?? application.job,name:companyName,confidential:companyName === "Confidential company"}} />
        <div className="saved-opportunity-copy">
          {job ? <button type="button" className="saved-opportunity-title" onClick={() => jobs.view(job.id,"applications")}>{title}</button> : <strong className="saved-opportunity-title">{title}</strong>}
          <p>{companyName}{job?.location && ` · ${job.location}`}{job?.arrangement && ` (${job.arrangement})`}</p>
          <time dateTime={application.createdAt}>Applied {formatLongDate(application.createdAt.slice(0,10))}</time>
          {application.followUp && <small className="opportunity-follow-up">Follow up {formatLongDate(application.followUp)}</small>}
        </div>
      </div></td>
      <td className="saved-opportunity-action"><div className="opportunity-row-actions">
        <span className={`application-status ${status}`}>{application.status}</span>
        {application.statusSource === "employer" && <small className="muted">Updated by employer</small>}
        <div>
          <Button unstyled className="saved-opportunity-apply" icon="file" aria-label={`Details for ${title}`} onClick={() => onDetails(application.id)}>Details</Button>
          <Button unstyled className="saved-opportunity-apply" icon="edit" aria-label={`Update tracking for ${title}`} onClick={() => onEdit(application.id)}>Update tracking</Button>
        </div>
      </div></td>
    </tr>;
  })}</OpportunityList>;
}

export function JobAlertsList({ items }: { items: AlertRecord[] }) {
  const jobs = useJobActions();
  const alerts = useJobAlertDialogs();
  return <OpportunityList label="Active job alerts" heading="Alerts">{items.map(alert => <tr key={alert.id} data-alert-id={alert.id}>
    <td><div className="saved-opportunity-job">
      <span className="opportunity-alert-icon" aria-hidden="true"><Icon name="bell" /></span>
      <div className="saved-opportunity-copy">
        <button type="button" className="saved-opportunity-title" onClick={() => alerts.edit(alert.id)}>{alert.name}</button>
        <p>{[alert.keywords,alert.location || "All locations",alert.arrangement === "Any" ? "Any work mode" : alert.arrangement,`Last ${alert.days} days`].filter(Boolean).join(" · ")}</p>
        {alert.enabled && alert.matches.length ? <details className="opportunity-alert-matches">
          <summary>{alert.matches.length} matching {alert.matches.length === 1 ? "opportunity" : "opportunities"}</summary>
          <ul>{alert.matches.map(job => <li key={job.id}><button type="button" aria-label={`View ${job.title}`} onClick={() => jobs.view(job.id,"applications")}><strong>{job.title}</strong><span>{job.companyName}{job.location && ` · ${job.location}`}</span></button></li>)}</ul>
        </details> : <small className="opportunity-follow-up">{alert.enabled ? "No matching opportunities" : "Alert paused"}</small>}
      </div>
    </div></td>
    <td className="saved-opportunity-action"><div className="opportunity-row-actions">
      <span className={`application-status ${alert.enabled ? "positive" : "muted-status"}`}>{alert.enabled ? "Active" : "Paused"}</span>
      <div>
        <Button unstyled className="saved-opportunity-apply" icon={alert.enabled ? "bell" : "check"} aria-label={`${alert.enabled ? "Pause" : "Resume"} ${alert.name}`} onClick={() => alerts.toggle(alert.id)}>{alert.enabled ? "Pause" : "Resume"}</Button>
        <Button unstyled className="saved-opportunity-apply" icon="edit" aria-label={`Edit ${alert.name}`} onClick={() => alerts.edit(alert.id)}>Edit</Button>
        <IconButton icon="trash" label={`Delete ${alert.name} alert`} onClick={() => alerts.remove(alert.id)} />
      </div>
    </div></td>
  </tr>)}</OpportunityList>;
}
