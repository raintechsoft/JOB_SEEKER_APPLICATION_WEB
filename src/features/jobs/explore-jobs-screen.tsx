"use client";

import type { MouseEvent } from "react";
import type { CompanySummary } from "@/types/api";
import type { IsoDateTime } from "@/types/domain";
import { QueryFeedback } from "@/components/ui/query-view";
import { CompanyAvatar } from "@/components/jobs/job-visuals";
import { ProfileColumn } from "@/features/feed/feed-parts";
import { useJobActions } from "@/features/feed/job-dialogs";
import { useServiceQuery } from "@/hooks/use-services";
import { formatFollowers } from "@/lib/utils/text";
import { formatDay } from "@/lib/utils/date";
import { searchMetaLine } from "@/lib/search/result-copy";

type ExploreJob = {
  id: string;
  title: string;
  createdAt: IsoDateTime;
  company: CompanySummary;
};

function sectionId(title: string) {
  return title.replace(/\s+/g, "-").toLowerCase();
}

function jobLine(company: CompanySummary) {
  const followers = company.confidential || company.followerCount == null ? "" : formatFollowers(company.followerCount);
  return searchMetaLine([company.confidential ? "Confidential company" : company.name, company.confidential ? "" : company.industry, followers]);
}

function ExploreJobCard({ job, onView }: { job: ExploreJob; onView: (id: string) => void }) {
  const posted = job.createdAt;
  const line = jobLine(job.company);
  const open = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onView(job.id);
  };
  return (
    <li>
      <button type="button" className="explore-job-card" onClick={open} aria-label={"View " + job.title + " job"}>
        <CompanyAvatar company={job.company} />
        <span className="explore-job-copy">
          <strong>{job.title}</strong>
          {line ? <span className="explore-job-meta">{line}</span> : null}
          <time dateTime={posted}>Posted {formatDay(posted)}</time>
        </span>
      </button>
    </li>
  );
}

function JobSection({ title, description, jobs, empty, loading, error, retry, onView }: {
  title: string;
  description?: string;
  jobs: ExploreJob[];
  empty: string;
  loading: boolean;
  error: boolean;
  retry: () => void;
  onView: (id: string) => void;
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
        <ul className="explore-job-list">{jobs.map((job) => <ExploreJobCard key={job.id} job={job} onView={onView} />)}</ul>
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
  const matchedJobs: ExploreJob[] = (matched.data?.forYou ?? []).map((job) => ({
    id: job.id,
    title: job.title,
    createdAt: job.createdAt,
    company: job.company,
  }));
  const matchedIds = new Set(matchedJobs.map((job) => job.id));
  const moreJobs: ExploreJob[] = matched.isPending
    ? []
    : (more.data?.items ?? [])
        .filter((row) => !matchedIds.has(row.job.id))
        .map((row) => ({ id: row.job.id, title: row.job.title, createdAt: row.job.publishedAt || row.job.createdAt, company: row.company }));
  const openJob = (id: string) => jobs.view(id, "explore-jobs");

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
        />
        <JobSection
          title="More jobs for you"
          jobs={moreJobs}
          empty="More open roles will appear here as teams start hiring."
          loading={more.isPending || matched.isPending}
          error={more.isError}
          retry={() => void more.refetch()}
          onView={openJob}
        />
      </div>
    </div>
  );
}
