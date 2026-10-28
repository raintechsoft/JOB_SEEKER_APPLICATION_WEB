"use client";

import { InfoBadge } from "@/components/ui/info-badge";

import { QueryFeedback } from "@/components/ui/query-view";

import Link from "next/link";
import { useState } from "react";
import { trackingSchema } from "@/lib/validation/application";
import { validationFields } from "@/lib/validation/profile";
import { useFormAction } from "@/hooks/use-form-action";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Id } from "@/types/domain";
import { type ApplicationCounts, type AlertRecord, type ApplicationRecord, type SavedJobRecord } from "@/services/applications/applications.service";
import { formatLongDate } from "@/lib/utils/date";
import { track } from "@/lib/analytics";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button, EmptyState, LinkButton, PageHeading } from "@/components/ui/primitives";
import { FloatingInput, TextAreaField, TextField } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/feedback";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { useJobActions } from "@/features/feed/job-dialogs";
import { useJobAlertDialogs } from "@/features/feed/job-alerts";
import { SavedOpportunities } from "./saved-opportunities";
import { AppliedOpportunities, JobAlertsList } from "./opportunity-lists";
import { ApplicationFilters, applicationFilter, type ApplicationFilter } from "./application-filters";

type Tab = "applied" | "saved" | "alerts";
const TABS: Record<Tab, string> = { applied: "Applied jobs", saved: "Saved jobs", alerts: "Job alerts" };
const demoDate = (v?: string) => (v ? formatLongDate(String(v).slice(0, 10)) : "Not set");
const statusClass = (s: string) => (["Interview", "Offer", "Shortlisted", "Hired"].includes(s) ? "positive" : s === "Rejected" ? "negative" : "pending");

function TrackingForm({ a }: { a: ApplicationRecord }) {
  const [errors,setErrors]=useState<Record<string,string>>({});
  const {execute,pending}=useFormAction(setErrors);
  const dialogs = useApplicationDialogs();
  return (
    <form
      id="application-tracking-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const checked=trackingSchema.safeParse({ followUp: String(f.get("followUp") || ""), trackingNote: String(f.get("trackingNote") || "").trim() });
        if(!checked.success)return setErrors(validationFields(checked.error));
        if(!await execute((s)=>s.applications.updateTracking(a.id,{...checked.data,version:a.version})))return;
        modal.close();
        toast("Private application notes saved.");
      }}
    >
      <div>
        <h3>{a.jobRef?.title || "Archived opportunity"}</h3>
        <p className="small muted">
          {a.jobRef?.companyName ?? "Company unavailable"} · Applied {demoDate(a.createdAt)}
        </p>
      </div>
      {errors._form&&<p role="alert">{errors._form}</p>}
      <TextField label="Follow-up date" name="followUp" error={errors.followUp} type="date" defaultValue={a.followUp} />
      <TextAreaField label="Private tracking notes" name="trackingNote" error={errors.trackingNote} defaultValue={a.trackingNote} maxLength={2500} placeholder="People to contact, interview preparation, or your next step..." />

      <div className="modal-footer">
        {!a.withdrawnAt && a.status !== "Withdrawn" && <Button variant="danger" disabled={pending} onClick={() => dialogs.withdraw(a)}>Withdraw application</Button>}
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check" loading={pending} disabled={pending}>
          Save notes
        </Button>
      </div>
    </form>
  );
}

function Details({ id }: { id: Id }) {
  const { data: a } = useServiceQuery(["application", id], (s) => s.applications.getApplication(id), {keepPreviousData:false,refetchInterval:10_000,refetchOnWindowFocus:"always",staleTime:0});
  const dialogs = useApplicationDialogs();
  const jobs = useJobActions();
  if (!a) return null;
  return (
    <div className="stack">
      <div>
        <h3>{a.jobRef?.title || "Archived opportunity"}</h3>
        <p className="small muted">
          {a.jobRef?.companyName ?? "Company unavailable"} · {demoDate(a.createdAt)}
        </p>
      </div>
      <span className={"application-status " + statusClass(a.status)} style={{ alignSelf: "flex-start" }}>
        {a.status}
      </span>
      <div className="application-detail-grid">
        <div>
          <span>Applicant</span>
          <p>{a.name}</p>
        </div>
        <div>
          <span>Email</span>
          <p>{a.email}</p>
        </div>
        <div>
          <span>Portfolio</span>
          <p>{a.portfolio ? devCopy("Included in demo application", "Included in application") : "Not included"}</p>
        </div>
        <div>
          <span>Follow-up</span>
          <p>{demoDate(a.followUp)}</p>
        </div>
      </div>
      <div>
        <h3>Your introduction</h3>
        <p className="small muted" style={{ marginTop: 9, whiteSpace: "pre-line" }}>
          {a.note || "No introduction added."}
        </p>
      </div>
      <div>
        <h3>Private tracking notes</h3>
        <p className="small muted" style={{ marginTop: 9, whiteSpace: "pre-line" }}>
          {a.trackingNote || "Add notes to keep track of your next step."}
        </p>
      </div>
      <DevOnly>
        <InfoBadge label="Application information">Local demonstration only. No application was sent to a real employer.</InfoBadge>
      </DevOnly>
      <div className="modal-footer wrap">
        <Button variant="danger sm" icon="trash" onClick={() => dialogs.remove(a.id)}>
          Remove tracking
        </Button>
        {a.jobRef && (
          <Button variant="sm" icon="external" onClick={() => jobs.view(a.jobRef!.id, "applications")}>
            View job
          </Button>
        )}
        <Button variant="primary sm" icon="edit" onClick={() => dialogs.edit(a.id)}>
          Edit notes
        </Button>
      </div>
    </div>
  );
}

function useApplicationDialogs() {
  const run = useServiceAction();
  const services = useServices();
  return {
    edit: async (id: Id) => {
      const a = await services.applications.getApplication(id);
      if (a) modal.show("Private application notes", <TrackingForm a={a} />);
    },
    details: (id: Id) => modal.show("Your application, at a glance.", <Details id={id} />),
    withdraw: (a: ApplicationRecord) => confirmAction("Withdraw this application?", "The employer will see that you withdrew. This cannot be undone; your private notes will be kept.", async () => {
      if (!await run(async s => {await s.applications.withdraw(a.id,a.version);return true;})) return;
      modal.close();toast("Application withdrawn.");
    }, "Withdraw application", {icon:"close"}),
    remove: (id: Id) =>
      confirmAction("Remove this tracking record?", devCopy("This deletes the application and its notes from this browser. It does not withdraw an application from an employer.", "This deletes the application and its notes from your tracker. It does not withdraw an application from an employer."), async () => {
        if(!await run(async(s)=>{await s.applications.remove(id);return true;}))return;
        modal.close();
        toast("Application tracking record removed.");
      }, "Remove record"),
  };
}

export function ApplicationsScreen() {
  const applicationDialogs = useApplicationDialogs();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const alerts = useJobAlertDialogs();
  const tab: Tab = (Object.keys(TABS) as Tab[]).includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "applied";
  const q = params.get("q") || "";
  const savedView = params.get("savedView") === "archived" ? "archived" : "active";
  const unfilteredUrl = "/app/applications?tab=" + tab + (tab === "saved" && savedView === "archived" ? "&savedView=archived" : "");
  const status = tab === "applied" ? applicationFilter(params.get("status")) : "";
  const { data: overview } = useServiceQuery(["applications", "overview"], (s) => s.applications.getOverview());
  const { data: results, isError, refetch } = useServiceQuery(["applications", tab, q, status, savedView], async (s): Promise<{items:(ApplicationRecord | SavedJobRecord | AlertRecord)[];counts?:ApplicationCounts}> => {
    if (tab === "applied") return s.applications.getApplicationResults({q,status});
    return {items:tab === "saved" ? await s.applications.listSavedJobs({q,state:savedView}) : await s.applications.listAlerts({q})};
  }, {keepPreviousData:false,refetchInterval:tab === "applied" ? 10_000 : undefined,refetchOnWindowFocus:"always",staleTime:0});
  const list = results?.items;
  const selectStatus = (nextStatus: ApplicationFilter) => {
    const next = new URLSearchParams({tab:"applied"});
    if (q) next.set("q",q);
    if (nextStatus) next.set("status",nextStatus);
    router.push(pathname + "?" + next);
  };

  const submit = (form: HTMLFormElement) => {
    const f = new FormData(form);
    const next = new URLSearchParams({ tab });
    if (tab === "saved" && savedView === "archived") next.set("savedView", "archived");
    const query = String(f.get("q") || "").trim();
    if (query) next.set("q", query);
    if (tab === "applied" && status) next.set("status", status);
    track("search_performed", { surface: "applications", hasQuery: !!query });
    router.push(pathname + "?" + next);
  };

  const filtered = !!(q || status);
  const EMPTY: Record<Tab, [string, string]> = {
    applied: ["Your next chapter starts with a first step.", devCopy("Demo jobs you apply to appear here, ready for your notes and next steps.", "Jobs you apply to appear here, ready for your notes and next steps.")],
    saved: ["Keep promising opportunities close.", "Save jobs from the feed or jobs panel to revisit them here. Saved social posts stay in your feed."],
    alerts: ["Put your next role on your radar.", "Create an alert for the job titles, skills, and locations you’re interested in."],
  };
  const sections: [Tab, string, number, IconName][] = [
    ["applied", "Your applications", overview?.counts.applied ?? 0, "briefcase"],
    ["saved", "Saved opportunities", overview?.counts.saved ?? 0, "bookmark"],
    ["alerts", "Active job alerts", overview?.counts.activeAlerts ?? 0, "bell"],
  ];

  return (
    <div className="applications-workspace">
      <PageHeading
        title="Job Tracker"
        subtitle=""
        actions={
          <>
            <LinkButton href="/app/jobs" icon="search">
              Explore jobs
            </LinkButton>
            <Button variant="primary" icon="bell" onClick={() => alerts.edit()}>
              Create job alert
            </Button>
          </>
        }
      />
      <div className="application-layout">
        <aside className="card application-sidebar">
          <h2>Your opportunities</h2>
          <nav aria-label="Application sections">
            {sections.map(([t, label, count, icon]) => (
              <Link key={t} href={"/app/applications?tab=" + t} className={tab === t ? "active" : ""} aria-current={tab === t ? "page" : undefined}>
                <span className="application-section-label">
                  <Icon name={icon} />
                  <span>{label}</span>
                </span>
                <span className="application-section-count">{count}</span>
              </Link>
            ))}
          </nav>
        </aside>
        <div className="application-content">
          <h2 className="application-content-title">{{ applied: "Your applications", saved: "Saved opportunities", alerts: "Job alerts" }[tab]}</h2>
          {tab === "saved" && <nav className="saved-job-views" aria-label="Saved opportunity views">{(["active","archived"] as const).map(view => <Link key={view} href={"/app/applications?" + new URLSearchParams({tab:"saved",...(q ? {q} : {}),...(view === "archived" ? {savedView:"archived"} : {})})} aria-current={savedView === view ? "page" : undefined}>{view === "active" ? "Saved" : "Archived"}</Link>)}</nav>}
          {tab === "applied" && <ApplicationFilters counts={results?.counts} value={status} onSelect={selectStatus} />}
          <div className="application-toolbar">
            <form
              id="applications-search-form"
              key={tab + q + status + savedView}
              onSubmit={(e) => {
                e.preventDefault();
                submit(e.currentTarget);
              }}
            >
              <input type="hidden" name="tab" value={tab} />
              <label className="application-search">
                <Icon name="search" />
                <FloatingInput label={"Search " + TABS[tab]} compact type="search" name="q" maxLength={200} defaultValue={q} placeholder={tab === "alerts" ? "Search your alerts..." : "Search roles, companies, or locations..."} aria-label={"Search " + TABS[tab]} />
              </label>
              <button type="submit" className="btn sm search-button">
                <Icon name="search" />
                Search
              </button>
              {filtered && (
                <LinkButton href={unfilteredUrl} variant="text sm" icon="close">
                  Clear
                </LinkButton>
              )}
            </form>

          </div>
          <section className="application-record-list" aria-label={TABS[tab]}>
            <QueryFeedback data={list} error={isError} retry={refetch} label="Loading your applications" />
            {list && list.length
              ? tab === "saved" ? <SavedOpportunities key={q + savedView} items={list as SavedJobRecord[]} view={savedView} /> : tab === "applied" ? <AppliedOpportunities items={list as ApplicationRecord[]} onEdit={applicationDialogs.edit} /> : <JobAlertsList items={list as AlertRecord[]} />
              : list && (
                  <EmptyState
                    title={filtered ? "No matching records." : tab === "saved" && savedView === "archived" ? "No archived opportunities." : EMPTY[tab][0]}
                    description={filtered ? "Clear the search or status filter to see more." : tab === "saved" && savedView === "archived" ? "Jobs you archive from Saved will appear here." : EMPTY[tab][1]}
                    action={
                      filtered ? (
                        <LinkButton href={unfilteredUrl} icon="close">
                          Clear filters
                        </LinkButton>
                      ) : tab === "saved" && savedView === "archived" ? (<LinkButton href="/app/applications?tab=saved" icon="bookmark">View saved opportunities</LinkButton>) : tab === "alerts" ? (
                        <Button variant="primary" icon="bell" onClick={() => alerts.edit()}>
                          Create job alert
                        </Button>
                      ) : (
                        <LinkButton href="/app/jobs" variant="primary" icon="search">
                          Explore jobs
                        </LinkButton>
                      )
                    }
                  />
                )}
          </section>
          <DevOnly>
            <div className="application-demo-note">
              <Icon name="shield" />
              <p>Demo workspace · Applications, statuses, notes, and job alerts are stored in this browser. Statuses are updated by you; no employer system is connected.</p>
            </div>
          </DevOnly>
        </div>
      </div>
    </div>
  );
}
