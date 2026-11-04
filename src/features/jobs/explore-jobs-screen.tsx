"use client";
import { useHiringQuery } from "@/hooks/use-hiring-query";

import type { MouseEvent, ReactNode } from "react";
import type { IconName } from "@/components/ui/icon";
import { ScreenError } from "@/components/ui/feedback";
import { useJobAlertDialogs } from "@/features/feed/job-alerts";
import type { CompanySummary } from "@/types/api";
import type { IsoDateTime } from "@/types/domain";
import { QueryFeedback } from "@/components/ui/query-view";
import { Button, EmptyState, LinkButton } from "@/components/ui/primitives";
import { CompanyAvatar } from "@/components/jobs/job-visuals";
import { VerifiedCompanyMark } from "@/components/organization/controls";
import { ProfileColumn } from "@/features/feed/feed-parts";
import { useJobActions } from "@/features/feed/job-dialogs";

import { formatFollowers } from "@/lib/utils/text";
import { formatDay } from "@/lib/utils/date";
import { searchMetaLine } from "@/lib/search/result-copy";
import { MatchBadge, type MatchBadgeData } from "@/components/jobs/match-badge";

type ExploreJob = {
  id: string;
  title: string;
  createdAt: IsoDateTime;
  company: CompanySummary;
  applied: boolean;
  closed?: boolean;
  match?: MatchBadgeData | null;
};

function sectionId(title: string) {
  return title.replace(/\s+/g, "-").toLowerCase();
}

function jobLine(company: CompanySummary) {
  const followers = company.confidential || company.followerCount == null ? "" : formatFollowers(company.followerCount);
  return searchMetaLine([company.confidential ? "" : company.industry, followers]);
}

function ExploreJobCard({ job, onView, onApply }: { job: ExploreJob; onView: (id: string) => void; onApply: (id: string) => void }) {
  const posted = job.createdAt;
  const company = job.company;
  const line = jobLine(company);
  const open = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onView(job.id);
  };
  return (
    <li>
      <div className="explore-job-card">
        <button type="button" className="explore-job-main" onClick={open} aria-label={"View " + job.title + " job"}>
          <CompanyAvatar company={company} />
          <span className="explore-job-copy">
            <strong>{job.title}</strong>
            <span className="explore-job-meta">
              <span className="explore-job-company">{company.confidential ? "Confidential company" : company.name}<VerifiedCompanyMark company={company} /></span>
              {line ? <span>{" · " + line}</span> : null}
            </span>
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

function JobSection({ title, description, jobs, empty, loading, error, cause, retry, onView, onApply }: {
  title: string;
  description?: string;
  jobs: ExploreJob[];
  empty: { title: string; description: string; icon: IconName; action: ReactNode };
  loading: boolean;
  error: boolean;
  cause?: unknown;
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
        error && !loading ? <ScreenError compact error={cause} title={title + " couldn’t load"} description="Something interrupted the request. Please try again." onRetry={retry} /> : <QueryFeedback data={undefined} error={error} cause={cause} compact retry={retry} label={"Loading " + title.toLowerCase()} />
      ) : jobs.length ? (
        <ul className="explore-job-list">{jobs.map((job) => <ExploreJobCard key={job.id} job={job} onView={onView} onApply={onApply} />)}</ul>
      ) : (
        <EmptyState compact icon={empty.icon} title={empty.title} description={empty.description} action={empty.action} />
      )}
    </section>
  );
}

export function ExploreJobsScreen() {
  const jobs = useJobActions();
  const alertDialogs = useJobAlertDialogs();
  const matched = useHiringQuery(["job-recommendations"], (s) => s.recommendations.getJobsForYou());
  const more = useHiringQuery(["job-opportunities", "explore"], (s, scope) => s.jobs.listOpportunities({ q: "", page: 1, pageSize: 40 }, scope));
  const applications = useHiringQuery(["applications", "explore"], (s, scope) => s.applications.listApplications({ q: "", status: "" }, scope));
  const appliedIds = new Set((applications.data ?? []).map((row) => row.job));
  const matchedJobs: ExploreJob[] = (matched.data?.forYou ?? []).flatMap((job) => job?.id && job.company ? [{
    id: job.id,
    title: job.title,
    createdAt: job.createdAt,
    company: job.company,
    applied: appliedIds.has(job.id),
    closed: !!job.closed,
    match: job.match,
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
          empty={{ icon: "briefcase", title: "No matching jobs yet", description: "Add skills and preferences to your profile, or browse more jobs below.", action: <LinkButton variant="sm" icon="user" href="/app/profile">Update your profile</LinkButton> }}
          loading={matched.isPending}
          error={matched.isError}
          cause={matched.error}
          retry={() => void matched.refetch()}
          onView={openJob}
          onApply={applyJob}
        />
        <JobSection
          title="More jobs for you"
          jobs={moreJobs}
          empty={{ icon: "search", title: "No more open roles right now", description: "More open roles will appear here as teams start hiring. Set a job alert to hear about them first.", action: <Button variant="sm" icon="bell" onClick={() => alertDialogs.edit()}>Create a job alert</Button> }}
          loading={more.isPending || matched.isPending}
          error={more.isError}
          cause={more.error}
          retry={() => void more.refetch()}
          onView={openJob}
          onApply={applyJob}
        />
      </div>
    </div>
  );
}
