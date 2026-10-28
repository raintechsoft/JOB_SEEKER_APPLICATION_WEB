"use client";

import { useEffect, useRef, useState } from "react";
import type { SavedJobRecord } from "@/services/applications/applications.service";
import { apiConfig } from "@/services/api/config";
import { bulkIdsSchema, savedJobSelectionSchema, SAVED_JOB_SELECTION_LIMIT } from "@/lib/validation/application";
import { useFormAction } from "@/hooks/use-form-action";
import { Button } from "@/components/ui/primitives";
import { CompanyAvatar } from "@/components/jobs/job-visuals";
import { useJobActions } from "@/features/feed/job-dialogs";
import { useServiceQuery } from "@/hooks/use-services";
import { postedAgo } from "@/lib/utils/date";
import { toast } from "@/stores/toast-store";
import { track } from "@/lib/analytics";
import { modal } from "@/stores/modal-store";

export function SavedOpportunities({ items, view = "active" }: { items: SavedJobRecord[]; view?: "active" | "archived" }) {
  const jobs = useJobActions();
  const applications = useServiceQuery(["applications", "saved-applied"], (s) => s.applications.listApplications({ q: "", status: "" }));
  const appliedIds = new Set((applications.data ?? []).map((row) => row.job));
  const [selected, setSelected] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const { execute, pending } = useFormAction(setErrors);
  const selectAll = useRef<HTMLInputElement>(null);
  const selectable = items.slice(0,SAVED_JOB_SELECTION_LIMIT);
  const ids = items.filter(item => selected.includes(item.id)).map(item => item.id);
  const all = selectable.length > 0 && selectable.every(item => selected.includes(item.id));
  useEffect(() => { if (selectAll.current) selectAll.current.indeterminate = ids.length > 0 && !all; }, [ids.length, all]);
  const change = async (action: "unsave" | "archive" | "restore") => {
    const parsed = (apiConfig.dataSource === "http" ? bulkIdsSchema : savedJobSelectionSchema).safeParse(ids);
    if (!parsed.success) { setErrors({_form:parsed.error.issues[0].message}); return; }
    setErrors({});
    if (await execute(service => action === "unsave" ? service.applications.unsaveJobs(parsed.data) : service.applications.archiveSavedJobs(parsed.data,action), {invalidate:action === "unsave" ? ["applications","job","feed","feed-saved-count"] : ["applications"]})) {
      if (action === "unsave") for (const jobId of ids) track("job_saved", {jobId,saved:false});
      setSelected([]);
      toast(action === "archive" ? "Moved to Archived." : action === "restore" ? "Restored to Saved." : ids.length === 1 ? "Removed from saved jobs." : `Removed ${ids.length} saved jobs.`);
    }
  };
  return <div className="saved-opportunities">
    <div className="saved-opportunities-toolbar" aria-label="Saved job actions">
      <span role="status">{ids.length} selected</span>
      <Button variant="text sm" icon="bookmark" disabled={!ids.length || pending} onClick={() => change("unsave")}>Unsave</Button>
      <Button variant="text sm" icon={view === "archived" ? "restore" : "archive"} disabled={!ids.length || pending} onClick={() => change(view === "archived" ? "restore" : "archive")}>{view === "archived" ? "Restore" : "Archive"}</Button>
      <Button variant="text sm" icon="trash" disabled={!ids.length || pending} onClick={() => modal.show("Delete saved opportunities?", <SavedJobsDeleteDialog ids={ids} onDeleted={() => setSelected([])} />)}>Delete</Button>
    </div>
    {errors._form && <p className="saved-opportunities-error" role="alert">{errors._form}</p>}
    {items.length > SAVED_JOB_SELECTION_LIMIT && <p className="saved-opportunities-limit">Select up to {SAVED_JOB_SELECTION_LIMIT} jobs at a time.</p>}
    <table className="saved-opportunities-table" aria-label={view === "archived" ? "Archived opportunities" : "Saved opportunities"}>
      <thead><tr>
        <th scope="col" className="saved-opportunity-select"><input ref={selectAll} type="checkbox" aria-label={items.length > SAVED_JOB_SELECTION_LIMIT ? `Select first ${SAVED_JOB_SELECTION_LIMIT} saved opportunities` : "Select all saved opportunities"} checked={all} disabled={pending} onChange={() => {setSelected(all ? [] : selectable.map(item => item.id));setErrors({});}} /></th>
        <th scope="col">Jobs</th><th scope="col"><span className="sr-only">Actions</span></th>
      </tr></thead>
      <tbody>{items.map(item => {
        const age = item.postedAt && Number.isFinite(Date.parse(item.postedAt)) ? postedAgo(item.postedAt) : null;
        const applied = Boolean(item.application) || appliedIds.has(item.id);
        const closed = item.acceptingApplications === false;
        return <tr key={item.id} data-saved-job={item.id} data-selected={selected.includes(item.id)}>
          <td className="saved-opportunity-select"><input type="checkbox" aria-label={`Select ${item.title}`} checked={selected.includes(item.id)} disabled={pending} onChange={() => {
            if (!selected.includes(item.id) && ids.length >= SAVED_JOB_SELECTION_LIMIT) {setErrors({_form:`Select up to ${SAVED_JOB_SELECTION_LIMIT} jobs at a time.`});return;}
            setSelected(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current,item.id]);setErrors({});
          }} /></td>
          <td><div className="saved-opportunity-job">
            <CompanyAvatar company={{id:item.companyId,name:item.companyName,logoUrl:item.companyLogo,confidential:item.confidential}} />
            <div className="saved-opportunity-copy">
              <button className="saved-opportunity-title" type="button" onClick={() => jobs.view(item.id,"applications")}>{item.title}</button>
              <p>{item.companyName}{item.location && ` · ${item.location}`}{item.arrangement && ` (${item.arrangement})`}</p>
              {age && <time dateTime={item.postedAt!}>{age === "Just posted" ? age : `Posted ${age}`}</time>}
            </div>
          </div></td>
          <td className="saved-opportunity-action">{applied ? (
            <span className="saved-opportunity-applied">Applied</span>
          ) : (
            <Button unstyled className="saved-opportunity-apply" icon="arrowUp" disabled={closed} aria-label={closed ? `${item.title} is closed` : `Apply for ${item.title}`} onClick={() => jobs.apply(item.id)}>{closed ? "Closed" : "Apply"}</Button>
          )}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function SavedJobsDeleteDialog({ ids, onDeleted }: { ids: string[]; onDeleted: () => void }) {
  const [errors,setErrors] = useState<Record<string,string>>({});
  const {execute,pending} = useFormAction(setErrors);
  return <>
    <p>Delete {ids.length} selected saved {ids.length === 1 ? "opportunity" : "opportunities"}? This removes them from your saved list. Job listings and submitted applications are kept.</p>
    {errors._form && <p role="alert">{errors._form}</p>}
    <div className="modal-footer">
      <Button disabled={pending} onClick={() => modal.close()}>Cancel</Button>
      <Button variant="danger" icon="trash" loading={pending} disabled={pending} onClick={async () => {
        const parsed = (apiConfig.dataSource === "http" ? bulkIdsSchema : savedJobSelectionSchema).safeParse(ids);
        if (!parsed.success) {setErrors({_form:parsed.error.issues[0].message});return;}
        setErrors({});
        if (await execute(service => service.applications.unsaveJobs(parsed.data), {invalidate:["applications","job","feed","feed-saved-count"]})) {
          for (const jobId of parsed.data) track("job_saved",{jobId,saved:false});
          onDeleted();modal.close();toast("Deleted from your saved list.");
        }
      }}>Delete</Button>
    </div>
  </>;
}
