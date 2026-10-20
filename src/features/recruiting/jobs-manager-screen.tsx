"use client";

import Link from "next/link";
import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Id } from "@/types/domain";
import type { ManagedJob } from "@/services/recruiting/recruiting.service";
import { formatLongDate } from "@/lib/utils/date";
import { track } from "@/lib/analytics";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { useDismissableDetails } from "@/hooks/use-dismissable";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Button, EmptyState, IconButton, LinkButton, PageHeading } from "@/components/ui/primitives";
import { FloatingSelect, TextAreaField, TextField } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/feedback";
import { JobArtwork, JobMediaExtras } from "@/components/jobs/job-visuals";

const BASE = "/recruiter/applications";
const STATUS_LABELS: Record<string, string> = { Active: "Active jobs", Closed: "Closed jobs", Expired: "Expired jobs" };

function useUrl() {
  const params = useSearchParams();
  return (changes: Record<string, string | number | null>) => {
    const q = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      q.delete(key);
      if (value !== "" && value != null) q.set(key, String(value));
    }
    return BASE + (q.size ? "?" + q : "");
  };
}

function JobPreview({ job }: { job: ManagedJob }) {
  const router = useRouter();
  const visual = { title: job.title, companyName: job.companyDisplayName || "Northstar Labs", location: job.location, arrangement: job.arrangement, thumbnail: job.thumbnail, jobMedia: job.jobMedia };
  return (
    <div className="stack job-preview">
      <div>
        <span className={"job-preview-status job-status-" + job.status.toLowerCase()}>{job.status}</span>
        <h3>{job.title}</h3>
        <p className="small muted">
          {visual.companyName} · {job.location || "Location not added"}
        </p>
      </div>
      <JobArtwork job={visual} />
      <JobMediaExtras job={visual} />
      <div className="row wrap">
        <span className="tag">{job.employment || "Full-time"}</span>
        <span className="tag">{job.arrangement || "Not specified"}</span>
        {job.salary && <span className="tag">{job.salary}</span>}
      </div>
      <div>
        <h3>About the role</h3>
        <p className="job-preview-copy">{job.description || "Add a job description before publishing."}</p>
      </div>
      <div>
        <h3>Responsibilities</h3>
        {job.responsibilities?.length ? (
          <ul className="job-preview-list">
            {job.responsibilities.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Not added yet.</p>
        )}
      </div>
      <div>
        <h3>Requirements</h3>
        <p className="job-preview-copy">{job.requirements || "Not added yet."}</p>
      </div>
      {!!job.skills?.length && (
        <div className="row wrap">
          {job.skills.map((skill) => (
            <span className="tag" key={skill}>
              {skill}
            </span>
          ))}
        </div>
      )}
      {job.draft && <p className="notice">Private draft preview. This job is not visible in the job seeker feed.</p>}
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Close</Button>
        <Button
          variant="primary"
          icon="edit"
          onClick={() => {
            modal.close();
            router.push("/recruiter/jobs/new?id=" + encodeURIComponent(job.id));
          }}
        >
          Edit job
        </Button>
      </div>
    </div>
  );
}

function ShareJob({ job }: { job: ManagedJob }) {
  const url = window.location.origin + "/app/dashboard?post=" + encodeURIComponent(job.id);
  return (
    <div className="stack">
      <h3>{job.title}</h3>
      <TextField label="Job link" name="job-share-link" defaultValue={url} readOnly />
      <p className="notice">This link opens the demo job in the job seeker feed. Local changes and jobs created in this browser are not synchronized to other devices.</p>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Close</Button>
        <Button
          variant="primary"
          icon="copy"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast("Job link copied.");
            } catch {
              const input = document.querySelector<HTMLInputElement>('[name="job-share-link"]');
              input?.focus();
              input?.select();
              toast("Select and copy the job link with your keyboard.");
            }
          }}
        >
          Copy link
        </Button>
      </div>
    </div>
  );
}

function Collaborate({ jobs }: { jobs: ManagedJob[] }) {
  const run = useServiceAction();
  const emails = [...new Set(jobs.flatMap((j) => j.collaborators || []))];
  return (
    <form
      id="jobs-collaboration-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const list = [...new Set(String(f.get("emails") || "").split(",").map((s) => s.trim()).filter(Boolean))];
        if (list.some((x) => !/^\S+@\S+\.\S+$/.test(x))) return toast("Enter valid email addresses separated by commas.");
        await run((s) => s.recruiting.saveCollaboration(jobs.map((j) => j.id), list, String(f.get("note") || "").trim()));
        modal.close();
        toast("Local collaboration settings saved. No invitations were sent.");
      }}
    >
      <h3>{jobs.length === 1 ? jobs[0].title : jobs.length + " selected job posts"}</h3>
      <TextField label="Collaborator emails (comma separated)" name="emails" defaultValue={emails.join(", ")} placeholder="colleague@example.com" />
      <TextAreaField label="Team handoff note (optional)" name="note" defaultValue={jobs.length === 1 ? jobs[0].collaborationNote || "" : ""} maxLength={1500} />
      <p className="notice">These are local demo collaboration settings. No invitations or emails are sent.</p>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save collaboration
        </Button>
      </div>
    </form>
  );
}

function JobMenu({ job }: { job: ManagedJob }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(ref, { closeOnAction: true });
  const run = useServiceAction();
  const router = useRouter();
  return (
    <details className="job-card-menu" ref={ref}>
      <summary aria-label={"More actions for " + job.title}>
        <Icon name="more" />
      </summary>
      <div>
        {job.draft ? (
          <Button variant="text sm" icon="edit" onClick={() => router.push("/recruiter/jobs/new?id=" + encodeURIComponent(job.id))}>
            Edit & publish
          </Button>
        ) : (
          <Button
            variant="text sm"
            icon="briefcase"
            onClick={async () => {
              const status = await run((s) => s.recruiting.toggleJob(job.id));
              if (status) toast(status === "Active" ? "Job reopened." : "Job closed. Existing responses are retained.");
            }}
          >
            {job.status === "Active" ? "Close job" : "Reopen job"}
          </Button>
        )}
        <Button variant="text sm" icon="eye" onClick={() => modal.show("Job preview", <JobPreview job={job} />, "project")}>
          Preview
        </Button>
        {job.draft ? (
          <Button
            variant="text sm"
            icon="trash"
            onClick={() =>
              confirmAction("Delete draft?", "This unpublished draft will be removed from this browser.", async () => {
                await run((s) => s.recruiting.deleteDraft(job.id));
                useUiStore.getState().setJobsManager({ selected: useUiStore.getState().jobsManager.selected.filter((x) => x !== job.id) });
                modal.close();
                toast("Draft deleted.");
              }, "Delete draft", { textClassName: "" })
            }
          >
            Delete draft
          </Button>
        ) : (
          <Button variant="text sm" icon="send" onClick={() => modal.show("Share job", <ShareJob job={job} />)}>
            Share
          </Button>
        )}
      </div>
    </details>
  );
}

function JobCard({ job, selected, onSelect }: { job: ManagedJob; selected: boolean; onSelect: (checked: boolean) => void }) {
  const run = useServiceAction();
  const router = useRouter();
  const link = BASE + "?job=" + job.id;
  const edit = () => router.push("/recruiter/jobs/new?id=" + encodeURIComponent(job.id));
  return (
    <article className="card managed-job-card" data-job-id={job.id}>
      <label className="job-row-select">
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={"Select " + job.title} />
      </label>
      <div className="managed-job-info">
        <h2>
          {job.draft ? (
            <button type="button" onClick={edit}>
              {job.title}
            </button>
          ) : (
            <Link href={link}>{job.title}</Link>
          )}
        </h2>
        <p>
          <Icon name="location" />
          {job.location || "Location not added"}
        </p>
        <div className="managed-job-tags">
          <span className={"job-status job-status-" + job.status.toLowerCase()}>{job.status}</span>
          <span>{job.employment || "Full-time"}</span>
          {!!job.collaborators?.length && (
            <span title={job.collaborators.join(", ")}>
              <Icon name="users" />
              {job.collaborators.length} collaborators
            </span>
          )}
        </div>
      </div>
      <div className="managed-job-metrics">
        {job.draft ? (
          <span className="job-draft-hint">
            Finish your draft
            <br />
            when you’re ready.
          </span>
        ) : (
          <>
            <Link href={link}>
              <span>
                <strong>{job.responses}</strong>
                {job.fresh > 0 && <i>{job.fresh} new</i>}
              </span>
              <small>Total responses</small>
            </Link>
            <Link href={link + "&stage=Shortlisted"}>
              <strong>{job.shortlisted}</strong>
              <small>Shortlisted</small>
            </Link>
          </>
        )}
      </div>
      <div className="managed-job-actions">
        <div>
          {!job.draft && (
            <IconButton
              icon="refresh"
              label={"Refresh posting date for " + job.title}
              onClick={async () => {
                const ok = await run((s) => s.recruiting.repostJob(job.id));
                toast(ok ? "Posting date refreshed in the local feed." : "Reopen this job before refreshing its posting date.");
              }}
            />
          )}
          <IconButton icon="edit" label={"Edit " + job.title} onClick={edit} />
          <JobMenu job={job} />
        </div>
        <p className="job-posting-meta">
          <span>Posted by {job.author}</span>
          <b aria-hidden="true">|</b>
          <time>
            {job.draft ? "Saved" : "Posted"} {formatLongDate(job.posted.slice(0, 10))}
          </time>
        </p>
      </div>
    </article>
  );
}

export function JobsManagerScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const url = useUrl();
  const run = useServiceAction();
  const services = useServices();
  const { selected, mobileFilters } = useUiStore((s) => s.jobsManager);
  const setJobsManager = useUiStore((s) => s.setJobsManager);
  const drafts = params.get("tab") === "drafts";
  const size = [10, 20, 40, 60].includes(Number(params.get("size"))) ? Number(params.get("size")) : 10;
  const query = { drafts, q: params.get("q") || "", statuses: params.getAll("status"), categories: params.getAll("category"), location: params.get("location") || "", days: Number(params.get("days")) || 0, sort: (params.get("sort") || "newest") as "newest", page: Number(params.get("page")) || 1, pageSize: size };
  const { data: m } = useServiceQuery(["jobs-manager", query], (s) => s.recruiting.listManagedJobs(query));
  const visible = m?.items ?? [];
  const allSelected = visible.length > 0 && visible.every((j) => selected.includes(j.id));
  const toggle = (id: Id, checked: boolean) => setJobsManager({ selected: checked ? [...new Set([...selected, id])] : selected.filter((x) => x !== id) });
  const selectedJobs = async () => (await Promise.all(selected.map((id) => services.recruiting.getManagedJob(id)))).filter((j): j is ManagedJob => !!j);

  return (
    <div className="jobs-responses-workspace">
      <div className="jobs-manager-layout">
        <PageHeading
          title="Manage Jobs and Responses"
          subtitle="Manage your job posts and the people responding to them."
          actions={
            <Button variant="primary" icon="plus" onClick={() => router.push("/recruiter/jobs/new")}>
              Post job
            </Button>
          }
        />
        <aside className={"card jobs-manager-filters" + (mobileFilters ? " show-filters" : "")}>
          <div className="jobs-filters-heading">
            <h2>
              <Icon name="sliders" />
              Filters
            </h2>
            <button type="button" className="jobs-mobile-filter-toggle" aria-expanded={mobileFilters} onClick={() => setJobsManager({ mobileFilters: !mobileFilters })}>
              <Icon name="sliders" />
              Filters
              <Icon name="down" />
            </button>
            <LinkButton href={BASE + (drafts ? "?tab=drafts" : "")} variant="text sm">
              Clear
            </LinkButton>
          </div>
          <form
            id="jobs-manager-filter"
            className="stack"
            key={params.toString()}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const q = new URLSearchParams();
              for (const name of ["tab", "q", "location", "days"]) {
                const value = String(f.get(name) || "").trim();
                if (value && !(name === "tab" && value === "all")) q.set(name, value);
              }
              for (const name of ["status", "category"]) for (const value of f.getAll(name)) q.append(name, String(value));
              setJobsManager({ selected: [], mobileFilters: false });
              track("search_performed", { surface: "jobs", hasQuery: !!q.get("q") });
              router.push(BASE + (q.size ? "?" + q : ""));
            }}
          >
            <input type="hidden" name="tab" value={drafts ? "drafts" : "all"} />
            <TextField label="Search title / reference / job ID" name="q" type="search" defaultValue={query.q} />
            {!drafts && (
              <details className="jobs-filter-group" open>
                <summary>
                  Job status
                  <Icon name="down" />
                </summary>
                {["Active", "Closed", "Expired"].map((v) => (
                  <label className="jobs-filter-check" key={v}>
                    <input type="checkbox" name="status" value={v} defaultChecked={query.statuses.includes(v)} />
                    <span>{STATUS_LABELS[v]}</span>
                    <small>{m?.statusCounts[v] ?? 0}</small>
                  </label>
                ))}
              </details>
            )}
            <details className="jobs-filter-group" open>
              <summary>
                Category
                <Icon name="down" />
              </summary>
              {["Full-time", "Part-time", "Contract", "Internship"].map((v) => (
                <label className="jobs-filter-check" key={v}>
                  <input type="checkbox" name="category" value={v} defaultChecked={query.categories.includes(v)} />
                  <span>{v}</span>
                  <small>{m?.categoryCounts[v] ?? 0}</small>
                </label>
              ))}
            </details>
            <details className="jobs-filter-group" open>
              <summary>
                Location & date
                <Icon name="down" />
              </summary>
              <TextField label="Location" name="location" type="search" defaultValue={query.location} />
              <label className="field">
                <FloatingSelect
                  label="Posted within"
                  name="days"
                  defaultValue={params.get("days") || ""}
                  options={[
                    { value: "", label: "Any time" },
                    { value: "7", label: "Last 7 days" },
                    { value: "30", label: "Last 30 days" },
                    { value: "90", label: "Last 90 days" },
                  ]}
                />
              </label>
            </details>
            <button className="btn primary" type="submit">
              Apply filters
            </button>
          </form>
        </aside>
        <section className="jobs-manager-results" aria-label="Job posts">
          <div className="jobs-manager-top">
            <nav className="jobs-manager-tabs" aria-label="Job sections">
              <Link className={!drafts ? "active" : ""} href={BASE}>
                All jobs <span>{m?.publishedCount ?? 0}</span>
              </Link>
              <Link className={drafts ? "active" : ""} href={BASE + "?tab=drafts"}>
                Drafts{!!m?.draftCount && <span>{m.draftCount}</span>}
              </Link>
            </nav>
            <div className="jobs-pagination">
              <label className="jobs-page-size">
                <FloatingSelect
                  label="Show"
                  id="jobs-page-size"
                  aria-label="Jobs per page"
                  value={String(size)}
                  onChange={(e) => {
                    setJobsManager({ selected: [] });
                    router.push(url({ size: e.target.value, page: "" }));
                  }}
                  options={["10", "20", "40", "60"]}
                />
              </label>
              <span>
                Page {m?.page ?? 1} of {m?.pages ?? 1}
              </span>
              {m && m.page > 1 ? (
                <LinkButton href={url({ page: m.page - 1 })} variant="text sm jobs-page-prev" icon="chevron">
                  Previous
                </LinkButton>
              ) : (
                <button type="button" className="iconbtn" disabled aria-label="Previous page">
                  <Icon name="chevron" />
                </button>
              )}
              {m && m.page < m.pages ? (
                <LinkButton href={url({ page: m.page + 1 })} variant="text sm" icon="chevron">
                  Next
                </LinkButton>
              ) : (
                <button type="button" className="iconbtn" disabled aria-label="Next page">
                  <Icon name="chevron" />
                </button>
              )}
            </div>
          </div>
          <div className="card jobs-bulk-toolbar">
            <label className="jobs-select-all">
              <input type="checkbox" id="jobs-select-all" checked={allSelected} disabled={!visible.length} onChange={(e) => setJobsManager({ selected: e.target.checked ? [...new Set([...selected, ...visible.map((j) => j.id)])] : selected.filter((id) => !visible.some((j) => j.id === id)) })} />
              Select all
            </label>
            <Button
              variant="text sm"
              icon="refresh"
              onClick={async () => {
                await run(async () => undefined);
                toast("Job list refreshed from this browser’s saved data.");
              }}
            >
              Refresh
            </Button>
            <Button variant="text sm" icon="users" disabled={!selected.length} onClick={async () => modal.show("Collaborate on job posts", <Collaborate jobs={await selectedJobs()} />, "project")}>
              Collaborate
            </Button>
            {!drafts && (
              <Button
                variant="text sm"
                icon="close"
                disabled={!selected.length}
                onClick={async () => {
                  const active = (await selectedJobs()).filter((j) => j.status === "Active");
                  if (!active.length) return toast("Select active jobs to close.");
                  modal.show(
                    "Close selected jobs?",
                    <>
                      <p>
                        {active.length} job {active.length === 1 ? "post will" : "posts will"} close. Existing responses and hiring notes will remain.
                      </p>
                      <div className="modal-footer">
                        <Button onClick={() => modal.close()}>Cancel</Button>
                        <Button
                          variant="primary"
                          icon="check"
                          onClick={async () => {
                            const count = await run((s) => s.recruiting.closeJobs(selected));
                            setJobsManager({ selected: [] });
                            modal.close();
                            toast((count ?? 0) + " job posts closed.");
                          }}
                        >
                          Close jobs
                        </Button>
                      </div>
                    </>,
                  );
                }}
              >
                Close
              </Button>
            )}
            <span className="jobs-selection-count">{selected.length ? selected.length + " selected" : (m?.total ?? 0) + " " + (drafts ? "drafts" : "jobs")}</span>
            <label className="jobs-sort-label">
              <FloatingSelect
                label="Sort by"
                id="jobs-manager-sort"
                aria-label="Sort jobs"
                value={query.sort}
                onChange={(e) => router.push(url({ sort: e.target.value, page: "" }))}
                options={[
                  { value: "newest", label: "Posted date: newest" },
                  { value: "oldest", label: "Posted date: oldest" },
                  { value: "responses", label: "Total responses" },
                ]}
              />
            </label>
          </div>
          <div className="managed-jobs-list">
            {m &&
              (visible.length ? (
                visible.map((j) => <JobCard key={j.id} job={j} selected={selected.includes(j.id)} onSelect={(c) => toggle(j.id, c)} />)
              ) : (
                <div className="card">
                  <EmptyState
                    title={drafts ? "No drafts in this view." : "No jobs match these filters."}
                    description={drafts ? "Start a job post and choose Save draft to finish it later." : "Clear a filter or create a new opportunity."}
                    action={
                      <>
                        <LinkButton href={BASE + (drafts ? "?tab=drafts" : "")}>Clear filters</LinkButton>
                        <Button variant="primary" icon="plus" onClick={() => router.push("/recruiter/jobs/new")}>
                          Post job
                        </Button>
                      </>
                    }
                  />
                </div>
              ))}
          </div>
          <p className="jobs-manager-note">
            <Icon name="shield" />
            Local prototype · Job posts, responses, and collaboration settings stay in this browser.
          </p>
        </section>
      </div>
    </div>
  );
}
