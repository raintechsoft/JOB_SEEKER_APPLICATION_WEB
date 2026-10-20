"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ApplicationStatus, Id } from "@/types/domain";
import { APPLICATION_STATUSES, type AlertRecord, type ApplicationRecord, type SavedJobRecord } from "@/services/applications/applications.service";
import { formatLongDate } from "@/lib/utils/date";
import { track } from "@/lib/analytics";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button, EmptyState, IconButton, LinkButton, PageHeading } from "@/components/ui/primitives";
import { FloatingInput, FloatingSelect, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/feedback";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { useJobActions } from "@/features/feed/job-dialogs";
import { useJobAlertDialogs } from "@/features/feed/job-alerts";

type Tab = "applied" | "saved" | "alerts";
const TABS: Record<Tab, string> = { applied: "Applied jobs", saved: "Saved jobs", alerts: "Job alerts" };
const demoDate = (v?: string) => (v ? formatLongDate(String(v).slice(0, 10)) : "Not set");
const statusClass = (s: string) => (["Interview", "Offer"].includes(s) ? "positive" : ["Rejected", "Withdrawn"].includes(s) ? "muted-status" : "pending");

function Logo({ companyId }: { companyId?: string }) {
  return <span className={"application-company-logo " + (companyId || "")}>{companyId === "c0" ? <Icon name="spark" /> : companyId === "c1" ? "m." : companyId === "c2" ? "f." : <Icon name="briefcase" />}</span>;
}

function TrackingForm({ a }: { a: ApplicationRecord }) {
  const run = useServiceAction();
  return (
    <form
      id="application-tracking-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await run((s) => s.applications.updateTracking(a.id, { status: String(f.get("status")) as ApplicationStatus, followUp: String(f.get("followUp") || ""), trackingNote: String(f.get("trackingNote") || "").trim() }));
        modal.close();
        toast("Application tracking saved.");
      }}
    >
      <div>
        <h3>{a.jobRef?.title || "Archived opportunity"}</h3>
        <p className="small muted">
          {a.jobRef?.companyName ?? "Company unavailable"} · Applied {demoDate(a.createdAt)}
        </p>
      </div>
      <SelectField label="Current status" name="status" defaultValue={a.status} options={APPLICATION_STATUSES} />
      <TextField label="Follow-up date (optional)" name="followUp" type="date" defaultValue={a.followUp} />
      <TextAreaField label="Private tracking notes" name="trackingNote" defaultValue={a.trackingNote} maxLength={2500} placeholder="People to contact, interview preparation, or your next step..." />
      <p className="notice">This is your personal tracking record. Changing a status does not contact the employer or withdraw an application.</p>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check">
          Save tracking
        </Button>
      </div>
    </form>
  );
}

function Details({ id }: { id: Id }) {
  const { data: a } = useServiceQuery(["application", id], (s) => s.applications.getApplication(id));
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
        <p className="notice">Local demonstration only. No application was sent to a real employer.</p>
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
          Update tracking
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
      if (a) modal.show("Keep your next step in sight.", <TrackingForm a={a} />);
    },
    details: (id: Id) => modal.show("Your application, at a glance.", <Details id={id} />),
    remove: (id: Id) =>
      confirmAction("Remove this tracking record?", devCopy("This deletes the application and its notes from this browser. It does not withdraw an application from an employer.", "This deletes the application and its notes from your tracker. It does not withdraw an application from an employer."), async () => {
        await run((s) => s.applications.remove(id));
        modal.close();
        toast("Application tracking record removed.");
      }, "Remove record"),
  };
}

function AppliedCard({ a }: { a: ApplicationRecord }) {
  const dialogs = useApplicationDialogs();
  const jobs = useJobActions();
  const j = a.jobRef;
  return (
    <article className="card application-record" data-application-id={a.id}>
      <div className="application-record-top">
        <Logo companyId={j?.companyId} />
        <div className="grow">
          <h2>
            {j ? (
              <button type="button" onClick={() => jobs.view(j.id, "applications")}>
                {j.title}
              </button>
            ) : (
              "Archived opportunity"
            )}
          </h2>
          <p>
            {j?.companyName ?? "Company unavailable"}
            {j ? " · " + j.location + " · " + j.arrangement : ""}
          </p>
        </div>
        <span className={"application-status " + statusClass(a.status)}>{a.status}</span>
      </div>
      <div className="application-record-facts">
        <span>
          <Icon name="calendar" />
          Applied {demoDate(a.createdAt)}
        </span>
        <span>
          <Icon name="clock" />
          {a.followUp ? "Follow up " + demoDate(a.followUp) : "No follow-up set"}
        </span>
        <span>
          <Icon name="file" />
          {a.portfolio ? "Portfolio included" : "No portfolio attached"}
        </span>
      </div>
      {a.trackingNote && (
        <div className="application-note">
          <span>
            <Icon name="edit" />
            Your notes
          </span>
          <p>{a.trackingNote}</p>
        </div>
      )}
      <div className="application-record-bottom">
        <span>Self-tracked · {a.updatedAt ? "Updated " + demoDate(a.updatedAt) : devCopy("Local demo application", "Application")}</span>
        <div className="row gap8">
          <Button variant="sm" icon="file" onClick={() => dialogs.details(a.id)}>
            Details
          </Button>
          <Button variant="primary sm" icon="edit" onClick={() => dialogs.edit(a.id)}>
            Update tracking
          </Button>
        </div>
      </div>
    </article>
  );
}

function SavedCard({ j }: { j: SavedJobRecord }) {
  const jobs = useJobActions();
  const dialogs = useApplicationDialogs();
  return (
    <article className="card application-record" data-saved-job={j.id}>
      <div className="application-record-top">
        <Logo companyId={j.companyId} />
        <div className="grow">
          <h2>
            <button type="button" onClick={() => jobs.view(j.id, "applications")}>
              {j.title}
            </button>
          </h2>
          <p>
            {j.companyName} · {j.location}
          </p>
        </div>
        <IconButton icon="bookmark" label={"Remove " + j.title + " from saved jobs"} extra="saved" onClick={() => jobs.toggleSave("professional", j.id, "job")} />
      </div>
      <div className="application-record-facts">
        <span>
          <Icon name="briefcase" />
          {j.employment}
        </span>
        <span>
          <Icon name="location" />
          {j.arrangement}
        </span>
        <span>{j.salary}</span>
      </div>
      <p className="application-saved-description">{j.description}</p>
      <div className="application-record-bottom">
        <span>{j.application ? "Already applied · " + j.application.status : "Saved for your next step"}</span>
        <div className="row gap8">
          <Button variant="text sm" icon="close" onClick={() => jobs.toggleSave("professional", j.id, "job")}>
            Remove
          </Button>
          <Button variant="primary sm" icon="arrowUp" onClick={() => (j.application ? dialogs.details(j.application.id) : jobs.view(j.id, "applications"))}>
            {j.application ? "View application" : "View opportunity"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function AlertCard({ a }: { a: AlertRecord }) {
  const jobs = useJobActions();
  const alerts = useJobAlertDialogs();
  return (
    <article className="card application-alert-record" data-alert-id={a.id}>
      <div className="application-record-top">
        <span className="application-alert-symbol">
          <Icon name="bell" />
        </span>
        <div className="grow">
          <h2>{a.name}</h2>
          <p>
            {a.keywords} · {a.location || "All locations"} · {a.arrangement === "Any" ? "Any work mode" : a.arrangement} · Last {a.days} days
          </p>
        </div>
        <span className={"application-status " + (a.enabled ? "positive" : "muted-status")}>{a.enabled ? "Active" : "Paused"}</span>
      </div>
      <div className="application-alert-matches">
        <h3>{a.enabled ? a.matches.length + " matching " + (a.matches.length === 1 ? "opportunity" : "opportunities") : "Alert paused"}</h3>
        {a.enabled ? (
          a.matches.length ? (
            a.matches.map((j) => (
              <button type="button" key={j.id} onClick={() => jobs.view(j.id, "applications")}>
                <span>
                  <strong>{j.title}</strong>
                  <small>
                    {j.companyName} · {j.location}
                  </small>
                </span>
                <Icon name="arrowUp" />
              </button>
            ))
          ) : (
            <p>No matches in this date range. Try broader keywords or another location.</p>
          )
        ) : (
          <p>Resume this alert to include its matching jobs in your feed.</p>
        )}
      </div>
      <div className="application-record-bottom">
        <span>{devCopy("In-app demo alert", "In-app alert")}</span>
        <div className="row gap8">
          <Button variant="sm" icon={a.enabled ? "bell" : "check"} onClick={() => alerts.toggle(a.id)}>
            {a.enabled ? "Pause" : "Resume"}
          </Button>
          <Button variant="primary sm" icon="edit" onClick={() => alerts.edit(a.id)}>
            Edit
          </Button>
          <IconButton icon="trash" label={"Delete " + a.name + " alert"} onClick={() => alerts.remove(a.id)} />
        </div>
      </div>
    </article>
  );
}

export function ApplicationsScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const alerts = useJobAlertDialogs();
  const tab: Tab = (Object.keys(TABS) as Tab[]).includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "applied";
  const q = params.get("q") || "";
  const status = (params.get("status") || "") as ApplicationStatus | "";
  const { data: overview } = useServiceQuery(["applications", "overview"], (s) => s.applications.getOverview());
  const { data: list } = useServiceQuery(["applications", tab, q, status], async (s): Promise<(ApplicationRecord | SavedJobRecord | AlertRecord)[]> => (tab === "applied" ? s.applications.listApplications({ q, status }) : tab === "saved" ? s.applications.listSavedJobs({ q }) : s.applications.listAlerts({ q })));

  const submit = (form: HTMLFormElement) => {
    const f = new FormData(form);
    const next = new URLSearchParams({ tab });
    const query = String(f.get("q") || "").trim();
    if (query) next.set("q", query);
    if (f.get("status")) next.set("status", String(f.get("status")));
    track("search_performed", { surface: "applications", hasQuery: !!query });
    router.push(pathname + "?" + next);
  };

  const n = list?.length ?? 0;
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
        title="My Application"
        subtitle="Your opportunities, your progress, and your next steps — in one place."
        actions={
          <>
            <LinkButton href="/app/dashboard?view=jobs" icon="search">
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
          <div className="application-toolbar">
            <form
              id="applications-search-form"
              key={tab + q + status}
              onSubmit={(e) => {
                e.preventDefault();
                submit(e.currentTarget);
              }}
            >
              <input type="hidden" name="tab" value={tab} />
              <label className="application-search">
                <Icon name="search" />
                <FloatingInput label={"Search " + TABS[tab]} compact type="search" name="q" defaultValue={q} placeholder={tab === "alerts" ? "Search your alerts..." : "Search roles, companies, or locations..."} aria-label={"Search " + TABS[tab]} />
              </label>
              {tab === "applied" && (
                <>
                  <label className="sr-only" htmlFor="application-status-filter">
                    Application status
                  </label>
                  <FloatingSelect label="Application status" className="control" id="application-status-filter" name="status" defaultValue={status} options={[{ value: "", label: "All statuses" }, ...APPLICATION_STATUSES]} onChange={(e) => submit(e.currentTarget.form!)} />
                </>
              )}
              <button type="submit" className="btn sm search-button">
                <Icon name="search" />
                Search
              </button>
              {filtered && (
                <LinkButton href={"/app/applications?tab=" + tab} variant="text sm" icon="close">
                  Clear
                </LinkButton>
              )}
            </form>
            <span>
              {n} {tab === "alerts" ? (n === 1 ? "alert" : "alerts") : tab === "saved" ? (n === 1 ? "saved job" : "saved jobs") : n === 1 ? "application" : "applications"}
            </span>
          </div>
          <section className="application-record-list" aria-label={TABS[tab]}>
            {list && list.length
              ? list.map((item) => (tab === "applied" ? <AppliedCard key={item.id} a={item as ApplicationRecord} /> : tab === "saved" ? <SavedCard key={item.id} j={item as SavedJobRecord} /> : <AlertCard key={item.id} a={item as AlertRecord} />))
              : list && (
                  <EmptyState
                    title={filtered ? "No matching records." : EMPTY[tab][0]}
                    description={filtered ? "Clear the search or status filter to see more." : EMPTY[tab][1]}
                    action={
                      filtered ? (
                        <LinkButton href={"/app/applications?tab=" + tab} icon="close">
                          Clear filters
                        </LinkButton>
                      ) : tab === "alerts" ? (
                        <Button variant="primary" icon="bell" onClick={() => alerts.edit()}>
                          Create job alert
                        </Button>
                      ) : (
                        <LinkButton href="/app/dashboard?view=jobs" variant="primary" icon="search">
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
