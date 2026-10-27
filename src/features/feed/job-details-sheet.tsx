"use client";

import { InfoBadge } from "@/components/ui/info-badge";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CompanySummary } from "@/types/api";
import type { Id, IsoDateTime, Job, Role } from "@/types/domain";
import { isOpenJob, isSimilarJobAlert, similarJobAlertInput } from "@/lib/domain/jobs";
import { splitJobAbout, toBulletItems } from "@/lib/domain/job-description";
import { jobAlertSchema } from "@/services/jobs/jobs.http";
import { track } from "@/lib/analytics";
import { HOUR_MS } from "@/lib/utils/date";
import { formatFollowers } from "@/lib/utils/text";
import { devCopy } from "@/lib/env/app-env";
import { useDismissableDetails } from "@/hooks/use-dismissable";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { CompanyAvatar } from "@/components/jobs/job-visuals";
import { QueryFeedback } from "@/components/ui/query-view";
import { Badge, Button, LinkButton, Tags } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { DevOnly } from "@/components/ui/dev-only";
import { toast } from "@/stores/toast-store";
import { organizationProfileHref } from "@/lib/routing/profiles";

const ABOUT_PREVIEW = 220;

function postedLabel(value: IsoDateTime) {
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / HOUR_MS));
  if (hours < 1) return "Just posted";
  if (hours < 24) return hours === 1 ? "1 hour ago" : hours + " hours ago";
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : days + " days ago";
}

function jobShareUrl(id: Id) {
  return window.location.origin + devCopy("/app/dashboard?post=" + encodeURIComponent(id), "/jobs/" + encodeURIComponent(id));
}

function useCompanyFollow(role: Role, companyId: Id, enabled: boolean) {
  const run = useServiceAction();
  const network = useServiceQuery(["network", role], (s) => s.feed.getNetwork(role), { enabled });
  const following = !!network.data?.companies.some((company) => company.id === companyId);
  const toggle = async () => {
    const next = await run((s) => s.feed.toggleFollowCompany(role, companyId), { invalidate: ["network", "feed", "job"] });
    if (next === undefined) return;
    toast(next ? "Following company." : "Unfollowed company.");
  };
  return { following, toggle };
}

function JobSheetMenu({
  job,
  company,
  role,
  saved,
  ownedByViewer,
  onSave,
}: {
  job: Job;
  company: CompanySummary;
  role: Role;
  saved: boolean;
  ownedByViewer: boolean;
  onSave: () => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(ref, { closeOnAction: true });
  const router = useRouter();
  const canFollow = !company.confidential && !ownedByViewer;
  const { following, toggle } = useCompanyFollow(role, company.id, canFollow);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(jobShareUrl(job.id));
      toast("Job link copied.");
    } catch {
      toast("The link could not be copied. Please allow clipboard access.", "error");
    }
  };
  return (
    <details className="activity-post-menu job-sheet-menu" ref={ref}>
      <summary aria-label={"Actions for " + job.title}>
        <Icon name="more" />
      </summary>
      <div className="activity-post-menu-items">
        {role === "professional" && (
          <Button variant="text sm" icon="bookmark" onClick={onSave} aria-pressed={saved}>
            {saved ? "Unsave" : "Save"}
          </Button>
        )}
        <Button variant="text sm" icon="link" onClick={() => void copyLink()}>
          Copy link
        </Button>
        {canFollow && (
          <Button variant="text sm" icon={following ? "userMinus" : "plus"} onClick={() => void toggle()}>
            {following ? "Unfollow company" : "Follow company"}
          </Button>
        )}
        {ownedByViewer && role === "recruiter" && (
          <>
            <Button variant="text sm" icon="edit" onClick={() => router.push("/recruiter/jobs/new?id=" + encodeURIComponent(job.id))}>
              Edit job
            </Button>
            <Button variant="text sm" icon="users" onClick={() => router.push("/recruiter/applications?job=" + encodeURIComponent(job.id))}>
              View applications
            </Button>
          </>
        )}
      </div>
    </details>
  );
}

function CompanyIdentity({
  job,
  company,
  role,
  saved,
  ownedByViewer,
  onSave,
}: {
  job: Job;
  company: CompanySummary;
  role: Role;
  saved: boolean;
  ownedByViewer: boolean;
  onSave: () => void;
}) {
  const href = organizationProfileHref(role, company.confidential ? undefined : company.slug) ?? "";
  return (
    <div className="job-sheet-company">
      <div className="job-sheet-company-identity">
        <CompanyAvatar company={company} />
        {href ? (
          <Link href={href}>{company.name}</Link>
        ) : (
          <span>{company.name}</span>
        )}
      </div>
      <JobSheetMenu job={job} company={company} role={role} saved={saved} ownedByViewer={ownedByViewer} onSave={onSave} />
    </div>
  );
}

function JobTitle({ title }: { title: string }) {
  return <h3 className="job-sheet-title">{title}</h3>;
}

function JobMetadata({ job }: { job: Job }) {
  const posted = job.publishedAt || job.createdAt;
  const experienceMin = job.wizardValues?.experienceMin;
  const experienceMax = job.wizardValues?.experienceMax;
  const experience = experienceMin != null && experienceMax != null && String(experienceMin) !== "" && String(experienceMax) !== ""
    ? `${experienceMin}–${experienceMax} years`
    : "";
  const parts = [job.location, postedLabel(posted), experience, job.hideSalary ? "" : job.salary].filter(Boolean);
  return <p className="job-sheet-meta">{parts.join(" · ")}</p>;
}

function EmploymentBadges({ job }: { job: Job }) {
  const badges = [job.arrangement, job.employment].filter(Boolean);
  if (!badges.length) return null;
  return (
    <div className="job-sheet-badges">
      {badges.map((badge) => (
        <span className="job-sheet-badge" key={badge}>
          {badge}
        </span>
      ))}
    </div>
  );
}

function JobHeader({
  job,
  company,
  role,
  saved,
  ownedByViewer,
  onSave,
}: {
  job: Job;
  company: CompanySummary;
  role: Role;
  saved: boolean;
  ownedByViewer: boolean;
  onSave: () => void;
}) {
  return (
    <header className="job-sheet-header">
      <CompanyIdentity job={job} company={company} role={role} saved={saved} ownedByViewer={ownedByViewer} onSave={onSave} />
      <JobTitle title={job.title} />
      <JobMetadata job={job} />
      <EmploymentBadges job={job} />
    </header>
  );
}

function ApplyButton({ job, applied, onApply }: { job: Job; applied: boolean; onApply: () => void }) {
  const open = isOpenJob(job);
  return (
    <Button variant="primary" icon="arrow" disabled={!open && !applied} onClick={onApply}>
      {applied ? "View application" : open ? "Apply" : "Applications closed"}
    </Button>
  );
}

function SaveJobButton({ saved, onSave }: { saved: boolean; onSave: () => void }) {
  return (
    <Button icon="bookmark" aria-pressed={saved} onClick={onSave}>
      {saved ? "Saved" : "Save"}
    </Button>
  );
}

function JobActionBar({
  job,
  role,
  saved,
  applied,
  ownedByViewer,
  onApply,
  onSave,
}: {
  job: Job;
  role: Role;
  saved: boolean;
  applied: boolean;
  ownedByViewer: boolean;
  onApply: () => void;
  onSave: () => void;
}) {
  if (role === "recruiter") {
    return ownedByViewer ? (
      <div className="job-sheet-actions">
        <LinkButton href={"/recruiter/applications?job=" + job.id} variant="primary" icon="users">
          View applications
        </LinkButton>
      </div>
    ) : null;
  }
  return (
    <div className="job-sheet-actions">
      <ApplyButton job={job} applied={applied} onApply={onApply} />
      <SaveJobButton saved={saved} onSave={onSave} />
    </div>
  );
}

function DescriptionBlock({ title, children }: { title: string; children: string }) {
  if (!children.trim()) return null;
  return (
    <section className="job-sheet-section">
      <h4>{title}</h4>
      <p>{children}</p>
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="job-sheet-section job-sheet-list">
      <h4>{title}</h4>
      <ul>
        {items.map((item, index) => (
          <li key={title + "-" + index}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function JobDescription({ job, hideCompanyCopy }: { job: Job; hideCompanyCopy: boolean }) {
  const about = splitJobAbout(job.description);
  return (
    <div className="job-sheet-about">
      <h3>About the job</h3>
      {!hideCompanyCopy && <DescriptionBlock title="Company Description">{about.company}</DescriptionBlock>}
      <DescriptionBlock title="Role Description">{about.role}</DescriptionBlock>
      <ListBlock title="Responsibilities" items={job.responsibilities} />
      <ListBlock title="Requirements" items={toBulletItems(job.requirements)} />
      {!!job.skills.length && (
        <section className="job-sheet-section">
          <h4>Skills</h4>
          <Tags items={job.skills} />
        </section>
      )}
      <DescriptionBlock title="Benefits & perks">{job.benefits ?? ""}</DescriptionBlock>
      <DescriptionBlock title="Application instructions">{job.applicationInstructions ?? ""}</DescriptionBlock>
    </div>
  );
}

function SimilarJobsAlert({ job }: { job: Job }) {
  const run = useServiceAction();
  const locked = useRef(false);
  const { data: alerts, isError } = useServiceQuery(["job-alerts"], (s) => s.jobs.listAlerts());
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const input = similarJobAlertInput(job);
  const match = alerts?.find((alert) => isSimilarJobAlert(alert, job));
  const on = optimistic ?? !!match?.enabled;
  const caption = [job.title, (job.location || "").replace(/\s*·\s*/g, ", ")].filter(Boolean).join(", ");
  useEffect(() => {
    if (optimistic !== null && optimistic === !!match?.enabled) setOptimistic(null);
  }, [optimistic, match?.enabled]);
  const toggle = async () => {
    if (locked.current) return;
    const desired = !on;
    if (desired) {
      const checked = jobAlertSchema.safeParse({
        ...input,
        ...(match ? { name: match.name, days: match.days, keywords: match.keywords, location: match.location, arrangement: match.arrangement } : {}),
        enabled: true,
      });
      if (!checked.success) {
        toast(checked.error.issues[0]?.message || "Enter a job title to set this alert.", "error");
        return;
      }
      locked.current = true;
      setBusy(true);
      setOptimistic(true);
      const saved = await run(async (s) => {
        await s.jobs.saveAlert({ ...checked.data, ...(match ? { id: match.id } : {}) });
        return true;
      }, { invalidate: ["job-alerts", "recommendations", "applications"] });
      locked.current = false;
      setBusy(false);
      if (!saved) {
        setOptimistic(null);
        return;
      }
      track("job_alert_saved", { arrangement: checked.data.arrangement, days: checked.data.days });
      toast("Job alert on. Similar roles in this location will appear in Your job alerts.");
      return;
    }
    if (!match?.enabled) return;
    locked.current = true;
    setBusy(true);
    setOptimistic(false);
    const enabled = await run((s) => s.jobs.toggleAlert(match.id), { invalidate: ["job-alerts", "recommendations", "applications"] });
    locked.current = false;
    setBusy(false);
    if (enabled === undefined) {
      setOptimistic(null);
      return;
    }
    toast("Job alert paused.");
  };
  return (
    <section className="job-sheet-alert" aria-labelledby="job-sheet-alert-title">
      <div>
        <h3 id="job-sheet-alert-title">Set alert for similar jobs</h3>
        {caption && <p>{caption}</p>}
      </div>
      <div className={"job-sheet-alert-control" + (on ? " is-on" : "")}>
        <span>{on ? "On" : "Off"}</span>
        <label className="switch">
          <input type="checkbox" checked={on} disabled={busy || (alerts === undefined && !isError)} aria-label="Set alert for similar jobs" onChange={() => void toggle()} />
          <span />
        </label>
      </div>
    </section>
  );
}

function AboutCopy({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > ABOUT_PREVIEW;
  const shown = !long || expanded ? text : text.slice(0, ABOUT_PREVIEW).trimEnd();
  return (
    <p className="job-sheet-about-copy">
      {shown}
      {long && !expanded ? "… " : " "}
      {long && (
        <button type="button" className="job-sheet-about-more" onClick={() => setExpanded((open) => !open)}>
          {expanded ? "less" : "more"}
        </button>
      )}
    </p>
  );
}

function AboutCompany({
  company,
  fallbackDescription,
  role,
  ownedByViewer,
}: {
  company: CompanySummary;
  fallbackDescription: string;
  role: Role;
  ownedByViewer: boolean;
}) {
  const canFollow = !company.confidential && !ownedByViewer;
  const { following, toggle } = useCompanyFollow(role, company.id, canFollow);
  const description = (company.description || fallbackDescription).trim();
  const facts = [company.industry, company.companySize].filter(Boolean);
  const href = organizationProfileHref(role, company.confidential ? undefined : company.slug) ?? "";
  const name = href ? <Link href={href}>{company.name}</Link> : <strong>{company.name}</strong>;
  return (
    <section className="job-sheet-about-company" aria-labelledby="job-sheet-about-company-title">
      <h3 id="job-sheet-about-company-title">About the company</h3>
      <div className="job-sheet-about-company-card">
        <div className="job-sheet-about-company-head">
          <CompanyAvatar company={company} />
          <div className="job-sheet-about-company-copy">
            <div className="job-sheet-about-company-name">{name}</div>
            {company.followerCount != null && <p>{formatFollowers(company.followerCount)}</p>}
          </div>
          {canFollow && (
            <Button unstyled type="button" icon={following ? "check" : "plus"} className={"job-sheet-follow" + (following ? " is-following" : "")} onClick={() => void toggle()} aria-pressed={following}>
              {following ? "Following" : "Follow"}
            </Button>
          )}
        </div>
        {facts.length > 0 && <p className="job-sheet-about-company-facts">{facts.join(" · ")}</p>}
        {description && <AboutCopy text={description} />}
      </div>
    </section>
  );
}

/** LinkedIn-style job details drawer opened from View opportunity. */
export function JobDetailsSideSheet({ id, role, onApply, onSave }: { id: Id; role: Role; onApply: () => void; onSave: () => void }) {
  const { data, isError, refetch } = useServiceQuery(["job", id, role], (s) => s.jobs.getJob(id, role));
  if (!data) return <div className="job-details-sheet"><QueryFeedback data={data} error={isError} retry={refetch} layout="profile" label="Loading opportunity" /></div>;
  const { job, company, saved, application, ownedByViewer } = data;
  const about = splitJobAbout(job.description);
  const companyDescription = (company.description || about.company).trim();
  return (
    <div className="job-details-sheet">
      <JobHeader job={job} company={company} role={role} saved={saved} ownedByViewer={ownedByViewer} onSave={onSave} />
      <JobActionBar
        job={job}
        role={role}
        saved={saved}
        applied={!!application}
        ownedByViewer={ownedByViewer}
        onApply={onApply}
        onSave={onSave}
      />
      <JobDescription job={job} hideCompanyCopy={!company.confidential && !!companyDescription} />
      {!company.confidential && <AboutCompany company={company} fallbackDescription={about.company} role={role} ownedByViewer={ownedByViewer} />}
      {role === "professional" && <SimilarJobsAlert job={job} />}
      {role === "professional" && (
        <DevOnly>
          <Badge tone="purple">Fictional demo opportunity</Badge>
          <InfoBadge label="Job preview information">
            {application
              ? "Your demo application is saved in this browser. It has not been sent to this fictional company."
              : "Fictional role and salary. Applying saves a local demonstration; no real application is submitted."}
          </InfoBadge>
        </DevOnly>
      )}
    </div>
  );
}
