"use client";

import { QueryFeedback } from "@/components/ui/query-view";

import type { RecommendedJob } from "@/services/recommendations/recommendations.service";
import { postedAgo } from "@/lib/utils/date";
import { CompanyAvatar } from "@/components/jobs/job-visuals";
import { VerifiedCompanyMark } from "@/components/organization/controls";
import {apiConfig} from "@/services/api/config";
import { devCopy } from "@/lib/env/app-env";
import { useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Button, EmptyState, LinkButton } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { useJobActions } from "./job-dialogs";
import { useJobAlertDialogs } from "./job-alerts";
import {useImpression} from "@/hooks/use-impression";
import {track} from "@/lib/analytics";
import { useInteractionTracking } from "@/hooks/use-interaction-tracking";

function RailJob({ item, position }: { item: RecommendedJob; position: number }) {
  const jobs = useJobActions();
  const ref=useImpression<HTMLElement>(()=>{if(item.analyticsContext)track("recommendation_exposed",item.analyticsContext);},item.analyticsContext?.requestId);
  // Watch history (views, reading time, clicks) personalises later recommendations.
  const { ref: watchRef, click: watchClick } = useInteractionTracking<HTMLElement>({ kind: "job", id: item.id }, { surface: "jobs-rail", position, requestId: item.analyticsContext?.requestId });
  const setRef = (el: HTMLElement | null) => { ref.current = el; watchRef.current = el; };
  const open=()=>{if(item.analyticsContext)track("recommendation_clicked",item.analyticsContext);watchClick();jobs.view(item.id,"jobs-rail");};
  const location = item.location?.trim() || "";
  const arrangement = item.arrangement?.trim() || "";
  return (
    <article ref={setRef} className="rail-job" data-relevant-job={item.id}>
      <div className="rail-job-logo">
        {apiConfig.dataSource === "http" ? (
          <CompanyAvatar company={item.company} />
        ) : (
          <span className={"rail-company-logo " + item.companyId}>{item.companyId === "c0" ? <Icon name="spark" /> : item.companyId === "c1" ? "m." : "f."}</span>
        )}
      </div>
      <div className="rail-job-copy">
        <button type="button" className="rail-job-title" title={item.title} onClick={open}>
          {item.title}
        </button>
        <div className="rail-job-company">
          <span className="rail-job-company-name">
            <span className="rail-job-company-label" title={item.company.name}>
              {item.company.name}
            </span>
            <VerifiedCompanyMark company={item.company} />
          </span>
        </div>
        {(location || arrangement) && (
          <p className="rail-job-meta">
            {location ? <span>{location}</span> : null}
            {location && arrangement ? <span className="rail-job-meta-sep" aria-hidden="true" /> : null}
            {arrangement ? <span>{arrangement}</span> : null}
          </p>
        )}
        <time className="rail-job-posted" dateTime={item.createdAt} title={item.createdAt}>
          {postedAgo(item.createdAt)}
        </time>
      </div>
    </article>
  );
}

const RAIL_JOB_LIMIT = 5;

/** "New jobs for you" rail with job alerts (professional feed). */
export function JobsPanel() {
  const { view, mobileOpen } = useUiStore((s) => s.jobsPanel);
  const setJobsPanel = useUiStore((s) => s.setJobsPanel);
  const alertsDialogs = useJobAlertDialogs();
  const { data, isError, error, refetch } = useServiceQuery(["recommendations", "jobs"], (s) => s.recommendations.getJobsForYou());
  const fullList = data && view ? (view === "alerts" ? data.alertMatches : data.forYou) : [];
  const list = fullList.slice(0, RAIL_JOB_LIMIT);
  const newCount = data?.newCount ?? 0;
  const tabSelected = view === "all" || view === "alerts";
  const viewAllHref = view === "alerts" ? "/app/applications?tab=alerts" : "/app/jobs";
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
            <div className="row between">
              <h2>New jobs for you</h2>
              {newCount > 0 && <span className="rail-new-count">{newCount} new</span>}
            </div>
            <p>Recent roles matched to your profile, skills, and interests.</p>
          </header>
          <div className="rail-job-tabs" role="tablist" aria-label="Relevant job filters">
            <button type="button" role="tab" aria-selected={view === "all"} aria-controls="rail-jobs-panel" id="rail-tab-for-you" onClick={() => setJobsPanel({ view: "all" })} className={view === "all" ? "active" : ""}>
              For you <span>{data?.forYou.length ?? "—"}</span>
            </button>
            <button type="button" role="tab" aria-selected={view === "alerts"} aria-controls="rail-jobs-panel" id="rail-tab-alerts" onClick={() => setJobsPanel({ view: "alerts" })} className={view === "alerts" ? "active" : ""}>
              Alert
            </button>
          </div>
          {tabSelected ? (
            <>
              <div className="rail-job-list" id="rail-jobs-panel" role="tabpanel" aria-labelledby={view === "alerts" ? "rail-tab-alerts" : "rail-tab-for-you"}>
                <QueryFeedback data={data} error={isError} cause={error} compact retry={refetch} label="Loading recommended jobs" />
                {list.length ? (
                  list.map((item, i) => <RailJob key={item.id} item={item} position={i} />)
                ) : data ? (
                  <EmptyState
                    compact
                    icon={view === "alerts" ? "bell" : "briefcase"}
                    title={view === "alerts" ? "No fresh alert matches yet" : "Your next possibility is on its way"}
                    description={view === "alerts" ? "Edit your keywords, location, or date range to explore more roles." : "Set a job alert to include the roles and locations you’re interested in."}
                    action={<Button variant="sm" icon="plus" onClick={() => alertsDialogs.edit()}>Set a job alert</Button>}
                  />
                ) : null}
              </div>
              {fullList.length > 0 ? (
                <div className="rail-view-all">
                  <LinkButton href={viewAllHref} variant="text sm">
                    View all
                  </LinkButton>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
        {view === "alerts" ? (
          <section className="card job-alerts-card rail-alerts-cta">
            <LinkButton href="/app/applications?tab=alerts" variant="primary" icon="plus">
              Add job alert
            </LinkButton>
          </section>
        ) : null}
        <DevOnly>
          <p className="rail-demo-note">
            <Icon name="shield" />
            In-app demo alerts · No emails or push notifications. New matching demo jobs appear here when you revisit or refresh.
          </p>
        </DevOnly>
      </div>
    </aside>
  );
}
