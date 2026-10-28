"use client";

import type { MouseEvent } from "react";
import type { CompanySummary } from "@/types/api";
import type { IsoDateTime } from "@/types/domain";
import { QueryFeedback } from "@/components/ui/query-view";
import { Button } from "@/components/ui/primitives";
import { CompanyAvatar } from "@/components/jobs/job-visuals";
import { ProfileColumn } from "@/features/feed/feed-parts";
import { useJobActions } from "@/features/feed/job-dialogs";
import { useServiceQuery } from "@/hooks/use-services";
import { formatFollowers } from "@/lib/utils/text";
import { formatDay } from "@/lib/utils/date";
import { searchMetaLine } from "@/lib/search/result-copy";
import { MatchBadge, type MatchBadgeData } from "@/components/jobs/match-badge";

type ExploreJob = {
  id: string;
  title: string;
  createdAt: IsoDateTime;
  company: CompanySummary;
  match?: MatchBadgeData | null;
  applied: boolean;
  closed?: boolean;
};

function sectionId(title: string) {
  return title.replace(/\s+/g, "-").toLowerCase();
}

function jobLine(company: CompanySummary) {
  const followers = company.confidential || company.followerCount == null ? "" : formatFollowers(company.followerCount);
  return searchMetaLine([company.confidential ? "Confidential company" : company.name, company.confidential ? "" : company.industry, followers]);
}

function ExploreJobCard({ job, onView, onApply }: { job: ExploreJob; onView: (id: string) => void; onApply: (id: string) => void }) {
  const posted = job.createdAt;
  const line = jobLine(job.company);
  const open = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onView(job.id);
  };
  return (
    <li>
      <div className="explore-job-card">
        <button type="button" className="explore-job-main" onClick={open} aria-label={"View " + job.title + " job"}>
          <CompanyAvatar company={job.company} />
          <span className="explore-job-copy">
            <strong>{job.title}</strong>
            {line ? <span className="explore-job-meta">{line}</span> : null}
            {posted ? <time dateTime={posted}>Posted {formatDay(posted)}</time> : null}
          </span>
        </button>
        {job.applied ? (
          <span className="explore-job-applied">Applied</span>
        ) : (
          <Button unstyled className="explore-job-apply" icon="arrowUp" disabled={job.closed} aria-label={job.closed ? job.title + " is closed" : "Apply for " + job.title} onClick={() => onApply(job.id)}>
            {job.closed ? "Closed" : "Apply"}
          </Button>
        )}
      </div>
      {/* Outside the card buttons: the badge has its own "why" button. */}
      {job.match ? <div className="explore-job-match"><MatchBadge match={job.match} /></div> : null}
    </li>
  );
}

function JobSection({ title, description, jobs, empty, loading, error, retry, onView, onApply }: {
  title: string;
  description?: string;
  jobs: ExploreJob[];
  empty: string;
  loading: boolean;
  error: boolean;
  retry: () => void;
  onView: (id: string) => void;
  onApply: (id: string) => void;
}) {
  const headingId = sectionId(title);
  return (
    <section className="explore-jobs-section" aria-labelledby={headingId}>
      <header>
        <h2 id={headingId}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      {(loading || error) && !jobs.length ? (
        <QueryFeedback data={undefined} error={error} retry={retry} label={"Loading " + title.toLowerCase()} />
      ) : jobs.length ? (
        <ul className="explore-job-list">{jobs.map((job) => <ExploreJobCard key={job.id} job={job} onView={onView} onApply={onApply} />)}</ul>
      ) : (
        <p className="explore-jobs-empty">{empty}</p>
      )}
    </section>
  );
}

export function ExploreJobsScreen() {
  const jobs = useJobActions();
  const matched = useServiceQuery(["recommendations", "jobs"], (s) => s.recommendations.getJobsForYou());
  const more = useServiceQuery(["job-opportunities", "explore"], (s) => s.jobs.listOpportunities({ q: "", page: 1, pageSize: 40 }));
  const applications = useServiceQuery(["applications", "explore"], (s) => s.applications.listApplications({ q: "", status: "" }));
  const appliedIds = new Set((applications.data ?? []).map((row) => row.job));
  const matchedJobs: ExploreJob[] = (matched.data?.forYou ?? []).flatMap((job) => job?.id && job.company ? [{
    id: job.id,
    title: job.title,
    createdAt: job.createdAt,
    company: job.company,
    match: job.match,
    applied: appliedIds.has(job.id),
    closed: !!job.closed,
  }] : []);
  const matchedIds = new Set(matchedJobs.map((job) => job.id));
  const moreJobs: ExploreJob[] = matched.isPending
    ? []
    : (more.data?.items ?? []).flatMap((row) => {
        const job = row?.job;
        if (!job?.id || !row.company || matchedIds.has(job.id)) return [];
        return [{ id: job.id, title: job.title, createdAt: job.publishedAt || job.createdAt, company: row.company, applied: appliedIds.has(job.id), closed: job.closed, match: row.match }];
      });
  const openJob = (id: string) => jobs.view(id, "explore-jobs");
  const applyJob = (id: string) => jobs.apply(id);

  return (
    <div className="explore-jobs-layout">
      <ProfileColumn />
      <div className="explore-jobs-main">
        <h1 className="sr-only">Explore jobs</h1>
        <JobSection
          title="Jobs that match your profile"
          description="Based on your profile and the job criteria"
          jobs={matchedJobs}
          empty="No matching jobs yet. Update your profile or browse more jobs below."
          loading={matched.isPending}
          error={matched.isError}
          retry={() => void matched.refetch()}
          onView={openJob}
          onApply={applyJob}
        />
        <JobSection
          title="More jobs for you"
          jobs={moreJobs}
          empty="More open roles will appear here as teams start hiring."
          loading={more.isPending || matched.isPending}
          error={more.isError}
          retry={() => void more.refetch()}
          onView={openJob}
          onApply={applyJob}
        />
      </div>
    </div>
  );
}
