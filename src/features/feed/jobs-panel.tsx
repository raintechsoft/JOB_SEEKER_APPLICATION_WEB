"use client";

import type { RecommendedJob } from "@/services/recommendations/recommendations.service";
import { postedAgo } from "@/lib/utils/date";
import { useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Button, IconButton } from "@/components/ui/primitives";
import { useJobActions } from "./job-dialogs";
import { useJobAlertDialogs } from "./job-alerts";

function RailJob({ item }: { item: RecommendedJob }) {
  const jobs = useJobActions();
  return (
    <article className="rail-job" data-relevant-job={item.id}>
      <div className="rail-job-company">
        <span className={"rail-company-logo " + item.companyId}>{item.companyId === "c0" ? <Icon name="spark" /> : item.companyId === "c1" ? "m." : "f."}</span>
        <div>
          <span>{item.company.name}</span>
          <small>{postedAgo(item.createdAt)}</small>
        </div>
        {item.isNew && <span className="rail-new">NEW</span>}
      </div>
      <button type="button" className="rail-job-title" onClick={() => jobs.view(item.id, "jobs-rail")}>
        {item.title} <Icon name="arrowUp" />
      </button>
      <p>
        <Icon name="location" />
        {item.location} · {item.arrangement}
      </p>
      <div className="rail-job-tags">
        <span>{item.employment}</span>
        <span>{item.salary}</span>
      </div>
      <div className="rail-job-reason">
        <Icon name={item.matchedAlerts.length ? "bell" : "user"} />
        <span>{item.matchedAlerts.length ? "Matches " + item.matchedAlerts.join(", ") : "Based on your role & skills"}</span>
      </div>
      <div className="rail-job-actions">
        <button type="button" onClick={() => jobs.view(item.id, "jobs-rail")}>
          View opportunity <Icon name="arrow" />
        </button>
        <button type="button" onClick={() => jobs.toggleSave("professional", item.id, "job")} aria-label={(item.saved ? "Unsave" : "Save") + " " + item.title} className={item.saved ? "saved" : ""}>
          <Icon name="bookmark" />
        </button>
      </div>
    </article>
  );
}

/** "New jobs for you" rail with job alerts (professional feed). */
export function JobsPanel() {
  const { view, mobileOpen } = useUiStore((s) => s.jobsPanel);
  const setJobsPanel = useUiStore((s) => s.setJobsPanel);
  const alertsDialogs = useJobAlertDialogs();
  const { data } = useServiceQuery(["recommendations", "jobs"], (s) => s.recommendations.getJobsForYou());
  const list = data ? (view === "alerts" ? data.alertMatches : data.forYou) : [];
  const newCount = data?.newCount ?? 0;
  return (
    <aside className={"feed-jobs-column" + (mobileOpen ? " show-jobs" : "")} aria-label="Relevant jobs and job alerts">
      <button type="button" className="jobs-mobile-toggle" onClick={() => setJobsPanel({ mobileOpen: !mobileOpen })} aria-expanded={mobileOpen}>
        <span>
          <Icon name="briefcase" />
          New jobs for you{newCount > 0 && <b>{newCount} new</b>}
        </span>
        <Icon name={mobileOpen ? "up" : "down"} />
      </button>
      <div className="jobs-rail-content">
        <section className="card relevant-jobs-card">
          <header className="rail-heading">
            <span className="eyebrow">YOUR NEXT POSSIBILITY</span>
            <div className="row between">
              <h2>New jobs for you</h2>
              {newCount > 0 && <span className="rail-new-count">{newCount} new</span>}
            </div>
            <p>Fresh opportunities worth a look.</p>
          </header>
          <div className="rail-job-tabs" role="tablist" aria-label="Relevant job filters">
            <button type="button" role="tab" aria-selected={view === "all"} onClick={() => setJobsPanel({ view: "all" })} className={view === "all" ? "active" : ""}>
              For you <span>{data?.forYou.length ?? 0}</span>
            </button>
            <button type="button" role="tab" aria-selected={view === "alerts"} onClick={() => setJobsPanel({ view: "alerts" })} className={view === "alerts" ? "active" : ""}>
              Alert
            </button>
          </div>
          <div className="rail-job-list">
            {list.length ? (
              list.map((item) => <RailJob key={item.id} item={item} />)
            ) : data ? (
              <div className="rail-jobs-empty">
                <Icon name="search" />
                <h3>{view === "alerts" ? "No fresh alert matches yet." : "Your next possibility is on its way."}</h3>
                <p>{view === "alerts" ? "Edit your keywords, location, or date range to explore more roles." : "Set a job alert to include the roles and locations you’re interested in."}</p>
                <Button variant="sm" icon="plus" onClick={() => alertsDialogs.edit()}>
                  Set a job alert
                </Button>
              </div>
            ) : null}
          </div>
          <div className="rail-sort-note">
            <Icon name="clock" />
            Newest first · Matches from demo jobs
          </div>
        </section>
        <section className="card job-alerts-card">
          <div className="row between">
            <h2>
              <Icon name="bell" />
              Your job alerts
            </h2>
            <IconButton icon="plus" label="Create a job alert" onClick={() => alertsDialogs.edit()} />
          </div>
          <p>The right role, a little easier to spot.</p>
          <div className="rail-alert-list">
            {data?.alerts.length ? (
              data.alerts.map((a) => (
                <div className="rail-alert" key={a.id}>
                  <button type="button" className="rail-alert-name" onClick={() => alertsDialogs.edit(a.id)}>
                    <strong>{a.name}</strong>
                    <span>
                      {a.location || "All locations"} · {a.arrangement === "Any" ? "Any work mode" : a.arrangement}
                    </span>
                  </button>
                  <button type="button" className={"rail-alert-status" + (a.enabled ? " on" : "")} onClick={() => alertsDialogs.toggle(a.id)} aria-label={(a.enabled ? "Pause" : "Resume") + " " + a.name + " alert"} aria-pressed={a.enabled}>
                    {a.enabled ? "On" : "Paused"}
                  </button>
                </div>
              ))
            ) : data ? (
              <p className="rail-alert-empty">No alerts set. Create one for your next role.</p>
            ) : null}
          </div>
          <button type="button" className="rail-manage-alerts" onClick={alertsDialogs.manage}>
            Manage alerts <Icon name="arrow" />
          </button>
        </section>
        <p className="rail-demo-note">
          <Icon name="shield" />
          In-app demo alerts · No emails or push notifications. New matching demo jobs appear here when you revisit or refresh.
        </p>
      </div>
    </aside>
  );
}
