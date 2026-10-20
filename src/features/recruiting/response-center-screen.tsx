"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { HiringStage, Id } from "@/types/domain";
import { RESPONSE_FILTER_KEYS, RESPONSE_TABS, type ResponseItem, type ResponseParams, type ResponseTab } from "@/services/recruiting/recruiting.service";
import { formatLocaleDate, formatLongDate } from "@/lib/utils/date";
import { downloadFile } from "@/lib/utils/files";
import { devCopy } from "@/lib/env/app-env";
import { track } from "@/lib/analytics";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, EmptyState, IconButton, LinkButton, PageHeading } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { FloatingInput, FloatingSelect, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { useContactCandidate } from "@/features/talent/dialogs";
import { openReview } from "./review-dialog";

const BASE = "/recruiter/applications";

function useResponseUrl() {
  const params = useSearchParams();
  return (changes: Record<string, string | number | null>) => {
    const q = new URLSearchParams(params);
    q.set("view", "responses");
    for (const [key, value] of Object.entries(changes)) {
      q.delete(key);
      if (value !== "" && value != null) q.set(key, String(value));
    }
    return BASE + "?" + q;
  };
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="response-filter-group" open>
      <summary>
        {title}
        <Icon name="down" />
      </summary>
      {children}
    </details>
  );
}

function Filters({ q }: { q: ResponseParams }) {
  const router = useRouter();
  const { showFilters } = useUiStore((s) => s.responses);
  const setResponses = useUiStore((s) => s.setResponses);
  const params = useSearchParams();
  const job = q.job || "";
  const num = (label: string, name: string, max?: number) => <TextField label={label} name={name} type="number" min={0} max={max} defaultValue={q[name] || ""} />;
  return (
    <aside className={"card response-filter-sidebar" + (showFilters ? " show-filters" : "")}>
      <div className="response-filter-title">
        <h2>
          <Icon name="sliders" />
          Advanced filters
        </h2>
        <button type="button" className="response-mobile-filter" aria-expanded={showFilters} onClick={() => setResponses({ showFilters: !showFilters })}>
          <Icon name="sliders" />
          Filters
          <Icon name="down" />
        </button>
        <LinkButton href={BASE + "?view=responses" + (job ? "&job=" + job : "")} variant="text sm">
          Clear
        </LinkButton>
      </div>
      <Button variant="primary response-ai-button" icon="spark" onClick={() => modal.show(devCopy("AI filter · Keyword matching demo", "AI filter"), <AiFilterForm q={q} />, "project")}>
        AI filter
      </Button>
      <DevOnly>
        <span className="response-ai-label">Keyword-matching demo</span>
      </DevOnly>
      <form
        id="response-advanced-filter"
        key={params.toString()}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const get = (k: string) => String(f.get(k) || "").trim();
          if (get("distance") && !q.job) return toast("Choose a job on the right before using the distance filter.");
          for (const [min, max, label] of [
            ["expMin", "expMax", "experience"],
            ["salaryMin", "salaryMax", "salary"],
          ])
            if (get(min) && get(max) && Number(get(min)) > Number(get(max))) return toast("Maximum " + label + " must be at least the minimum.");
          const next = new URLSearchParams(params);
          for (const key of RESPONSE_FILTER_KEYS) {
            next.delete(key);
            if (get(key)) next.set(key, get(key));
          }
          next.set("view", "responses");
          next.delete("page");
          setResponses({ selection: [], showFilters: false });
          track("search_performed", { surface: "responses", hasQuery: !!get("keywords") });
          router.push(BASE + "?" + next);
        }}
      >
        <div className="response-keywords">
          <TextAreaField label="CV / profile keywords" name="keywords" defaultValue={q.keywords || ""} maxLength={500} rows={2} />
          <SelectField
            label="Match keywords"
            name="keywordMode"
            defaultValue={q.keywordMode || "any"}
            options={[
              { value: "any", label: "Any keyword" },
              { value: "all", label: "All keywords" },
            ]}
          />
        </div>
        <Panel title="Location">
          <TextField label="Location / city" name="location" type="search" defaultValue={q.location || ""} />
          <TextField label="Locality" name="locality" type="search" defaultValue={q.locality || ""} />
          <SelectField label="Distance from job" name="distance" defaultValue={q.distance || ""} options={[{ value: "", label: "Any distance" }, ...[5, 10, 25, 50, 100, 500].map((v) => ({ value: String(v), label: "Within " + v + " km" }))]} />
          <p className="response-filter-help">Choose a job on the right to use distance. City-centre estimates are used where precise coordinates are unavailable.</p>
        </Panel>
        <Panel title="Experience">
          <div className="response-filter-range">
            {num("Min. years", "expMin", 50)}
            {num("Max. years", "expMax", 50)}
          </div>
        </Panel>
        <Panel title="Expected salary">
          <div className="response-filter-range">
            {num("Min. LPA", "salaryMin")}
            {num("Max. LPA", "salaryMax")}
          </div>
          <p className="response-filter-help">Annual INR LPA, where shared by the applicant.</p>
        </Panel>
        <Panel title="Education">
          <SelectField
            label="Qualification"
            name="education"
            defaultValue={q.education || ""}
            options={[
              { value: "", label: "Any qualification" },
              { value: "school", label: "School" },
              { value: "diploma", label: "Diploma" },
              { value: "bachelor", label: "Bachelor / Graduate" },
              { value: "master", label: "Master / Postgraduate" },
              { value: "doctorate", label: "Doctorate" },
            ]}
          />
        </Panel>
        <Panel title="Joining preferences">
          <SelectField
            label="Notice period"
            name="notice"
            defaultValue={q.notice || ""}
            options={[
              { value: "", label: "Any notice period" },
              { value: "0", label: "Immediate" },
              { value: "15", label: "Up to 15 days" },
              { value: "30", label: "Up to 30 days" },
              { value: "60", label: "Up to 60 days" },
              { value: "90", label: "Up to 90 days" },
              { value: "90+", label: "More than 90 days" },
            ]}
          />
          <SelectField
            label="Availability to join"
            name="joining"
            defaultValue={q.joining || ""}
            options={[
              { value: "", label: "Any availability" },
              { value: "0", label: "Immediate" },
              { value: "15", label: "Within 15 days" },
              { value: "30", label: "Within 30 days" },
              { value: "60", label: "Within 60 days" },
              { value: "90", label: "Within 90 days" },
            ]}
          />
        </Panel>
        <Panel title="Professional background">
          <TextField label="Industry" name="industry" type="search" defaultValue={q.industry || ""} />
          <TextField label="Designation" name="designation" type="search" defaultValue={q.designation || ""} />
          <TextField label="Department" name="department" type="search" defaultValue={q.department || ""} />
        </Panel>
        <p className="response-filter-help">Active filters exclude records with missing details. Private profile salary, notice, phone, and address are not read.</p>
        <button className="btn primary" type="submit">
          Apply filters
        </button>
      </form>
    </aside>
  );
}

function AiFilterForm({ q }: { q: ResponseParams }) {
  const run = useServiceAction();
  const router = useRouter();
  const setResponses = useUiStore((s) => s.setResponses);
  const { data: page } = useServiceQuery(["responses", "jobs"], (s) => s.recruiting.listResponses({}));
  if (!page) return null;
  const job = page.jobs.find((j) => j.id === q.job);
  return (
    <form
      id="response-ai-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const get = (k: string) => String(f.get(k) || "").trim();
        const next = new URLSearchParams(q);
        next.set("view", "responses");
        next.set("fit", "1");
        next.set("threshold", get("threshold"));
        next.set("stage", "all");
        next.delete("page");
        if (get("job")) next.set("job", get("job"));
        else {
          next.delete("job");
          next.delete("distance");
        }
        if (get("terms")) next.set("fitTerms", get("terms"));
        else next.delete("fitTerms");
        const result = await run((s) => s.recruiting.runKeywordMatch(Object.fromEntries(next), f.has("shortlist")));
        if (!result) return;
        setResponses({ selection: [] });
        modal.close();
        router.push(BASE + "?" + next);
        toast(result.matches + " keyword matches · " + result.shortlisted + devCopy(" responses shortlisted in this demo.", " responses shortlisted."));
      }}
    >
      <SelectField label="Job scope" name="job" defaultValue={q.job || ""} options={[{ value: "", label: "All job responses" }, ...page.jobs.map((j) => ({ value: j.id, label: j.title }))]} />
      <TextAreaField label="Match keywords (comma separated)" name="terms" defaultValue={q.keywords || q.fitTerms || job?.skills.join(", ") || ""} maxLength={500} />
      <p className="small muted">Leave blank to use each job’s listed skills. Matches inspect saved public profile/project text and any resume text supplied with an application. Uploaded CV files are not parsed.</p>
      <SelectField
        label="Minimum keyword match"
        name="threshold"
        defaultValue={q.threshold || "60"}
        options={[
          { value: "30", label: "30% of keywords" },
          { value: "50", label: "50% of keywords" },
          { value: "60", label: "60% of keywords" },
          { value: "80", label: "80% of keywords" },
          { value: "100", label: "All keywords" },
        ]}
      />
      <label className="response-ai-check">
        <input type="checkbox" name="shortlist" defaultChecked />
        Automatically shortlist matching New / In review responses
      </label>
      <p className="notice">This is a local keyword matcher, not a connected AI service or an assessment of candidate ability. Match reasons are shown on each result. Rejected, hired, and interview decisions are preserved.</p>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary">
          Run filter
        </Button>
      </div>
    </form>
  );
}

function NoteForm({ item }: { item: ResponseItem }) {
  const run = useServiceAction();
  return (
    <form
      id="response-note-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await run((s) => s.recruiting.saveNote(item.application.id, String(new FormData(e.currentTarget).get("note") || "").trim()));
        modal.close();
        toast("Hiring note saved.");
      }}
    >
      <h3>{item.profile.name}</h3>
      <TextAreaField label="Your note" name="note" defaultValue={item.application.recruiterNote} maxLength={2000} />
      <p className="small muted">{devCopy("Private hiring notes are saved in this browser.", "Hiring notes are private.")}</p>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save note
        </Button>
      </div>
    </form>
  );
}

function ContactDialog({ item }: { item: ResponseItem }) {
  const contact = useContactCandidate();
  const p = item.profile;
  return (
    <div className="stack">
      <div className="row">
        <Avatar person={p} size="lg" />
        <div>
          <h3>{p.name}</h3>
          <p className="small muted">{p.designation}</p>
        </div>
      </div>
      <TextField label="Application email" name="email" defaultValue={p.email} readOnly />
      {p.phone ? <TextField label="Shared phone number" name="phone" defaultValue={p.phone} readOnly /> : <p className="small muted">Phone number not shared with this application.</p>}
      <DevOnly>
        <p className="notice">These are fictional or applicant-supplied demo details. No call or email is sent.</p>
      </DevOnly>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Close</Button>
        <Button variant="primary" icon="message" onClick={() => contact(p.id)}>
          {devCopy("Open demo message", "Send message")}
        </Button>
      </div>
    </div>
  );
}

function OutreachForm({ ids, names }: { ids: Id[]; names: string[] }) {
  const run = useServiceAction();
  return (
    <form
      id="response-outreach-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await run((s) => s.recruiting.saveOutreach(ids, String(f.get("subject") || "").trim(), String(f.get("message") || "").trim()));
        modal.close();
        toast(devCopy("Outreach draft saved locally. No email was sent.", "Outreach draft saved."));
      }}
    >
      <p className="small muted">For {names.join(", ")}</p>
      <TextField label="Subject" name="subject" required maxLength={150} />
      <TextAreaField label="Message draft" name="message" required maxLength={3000} />
      <p className="notice">This saves a local draft only. It does not send email.</p>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save outreach draft
        </Button>
      </div>
    </form>
  );
}

function CandidateCard({ item, q, selected, onSelect, actions }: { item: ResponseItem; q: ResponseParams; selected: boolean; onSelect: (c: boolean) => void; actions: ReturnType<typeof useResponseActions> }) {
  const contact = useContactCandidate();
  const { application: a, profile: p, fit, distance } = item;
  const fitOn = q.fit === "1";
  return (
    <article className={"card response-candidate" + (q.rows === "compact" ? " is-compact" : "")} data-response-id={a.id}>
      <div className="response-candidate-main">
        <div className="response-candidate-heading">
          <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={"Select " + p.name} />
          <button type="button" onClick={() => actions.view(a.id)}>
            <h2>{p.name}</h2>
          </button>
          {fitOn ? <span className="response-fit-badge">{fit.score}% keyword match</span> : a.portfolio ? <span className="response-portfolio-badge">Portfolio included</span> : null}
          <span className="response-status">{a.status}</span>
        </div>
        <div className="response-facts">
          <span>
            <Icon name="briefcase" />
            {p.years} years
          </span>
          <span>
            <Icon name="file" />
            {p.expectedSalary == null ? "Salary not provided" : "₹" + p.expectedSalary + " LPA expected"}
          </span>
          <span>
            <Icon name="clock" />
            {p.notice == null ? "Notice not provided" : p.notice === 0 ? "Immediate notice" : p.notice + " days notice"}
          </span>
          <span>
            <Icon name="location" />
            {p.location}
            {p.locality ? " · " + p.locality : ""}
          </span>
          {distance && (
            <span>
              {distance.km} km{distance.estimated ? " · City-centre estimate" : ""}
            </span>
          )}
        </div>
        <div className="response-quick-view">
          <strong>{p.designation}</strong>
          <span>Applied for {item.jobTitle}</span>
          <p>{p.skills.slice(0, 4).join(" · ")}</p>
        </div>
        <div className="response-detail-grid">
          <span>Applied for</span>
          <strong>{item.jobTitle}</strong>
          <span>Current</span>
          <p>{p.currentRole || "Not provided"}</p>
          <span>Previous</span>
          <p>{p.previousRole || "Not provided"}</p>
          <span>Education</span>
          <p>{p.educationText || "Not provided"}</p>
          <span>Preferred locations</span>
          <p>{p.preferredLocations || "Not provided"}</p>
          <span>Key skills</span>
          <p>{p.skills.join(" · ") || "Not provided"}</p>
          {p.industry && (
            <>
              <span>Industry</span>
              <p>{p.industry}</p>
            </>
          )}
          <span>Department</span>
          <p>{p.department || "Not provided"}</p>
          {fitOn && (
            <>
              <span>Matched terms</span>
              <p className="response-matched-terms">{fit.matched.join(" · ")}</p>
            </>
          )}
        </div>
        {a.recruiterNote && (
          <div className="response-saved-note">
            <Icon name="message" />
            <p>{a.recruiterNote}</p>
          </div>
        )}
        <div className="response-card-actions">
          <Button variant="text sm" icon="message" onClick={() => modal.show("Recruiter note", <NoteForm item={item} />)}>
            {a.recruiterNote ? "Edit note" : "Add note"}
          </Button>
          <div className="grow" />
          <Button variant="sm response-shortlist" icon="check" onClick={() => actions.status([a.id], "Shortlisted")}>
            Shortlist
          </Button>
          <Button variant="sm" icon="folder" onClick={() => actions.status([a.id], "Reviewing")}>
            Maybe
          </Button>
          <Button variant="sm response-reject" icon="close" onClick={() => actions.status([a.id], "Rejected")}>
            Reject
          </Button>
          <IconButton icon="trash" label={"Remove " + p.name + " from recruiter inbox"} onClick={() => actions.remove([a.id])} />
        </div>
      </div>
      <aside className="response-candidate-profile">
        <Avatar person={p} size="xl" />
        <p>{p.summary || p.headline}</p>
        <Button variant="sm" icon="phone" onClick={() => actions.contact(item)}>
          Contact
        </Button>
        <Button variant="text sm" icon="message" onClick={() => contact(p.id)}>
          Message
        </Button>
        <Button variant="text sm" icon="user" onClick={() => actions.view(a.id)}>
          View profile
        </Button>
        <Button variant="text sm" icon="download" onClick={() => actions.exportProfile(a.id)}>
          Download profile
        </Button>
        <span>{a.viewedAt ? "Viewed " + formatLocaleDate(a.viewedAt) : "Not viewed yet"}</span>
      </aside>
      <footer className="response-candidate-footer">
        <span>
          {devCopy(a.sample ? "Sample application" : "Local demo response", "Application")} · Applied {formatLongDate(a.createdAt.slice(0, 10))}
        </span>
        <Button variant="text sm" icon="edit" onClick={() => openReview(a.id)}>
          Review tracking
        </Button>
      </footer>
    </article>
  );
}

function useResponseActions() {
  const run = useServiceAction();
  const services = useServices();
  const router = useRouter();
  const { selection } = useUiStore((s) => s.responses);
  const setResponses = useUiStore((s) => s.setResponses);
  return {
    status: async (ids: Id[], status: HiringStage) => {
      const n = await run((s) => s.recruiting.setStatus(ids, status));
      if (n !== undefined) toast(n + " response" + (n === 1 ? "" : "s") + " updated.");
    },
    remove: (ids: Id[]) =>
      modal.show(
        "Remove responses from your inbox?",
        <>
          <p>
            {ids.length} response{ids.length === 1 ? "" : "s"} will be hidden from the recruiter inbox. The job seeker’s self-tracked application will remain.
          </p>
          <div className="modal-footer">
            <Button onClick={() => modal.close()}>Cancel</Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                await run((s) => s.recruiting.remove(ids));
                setResponses({ selection: selection.filter((id) => !ids.includes(id)) });
                modal.close();
                toast("Responses removed from the recruiter inbox.");
              }}
            >
              Remove responses
            </Button>
          </div>
        </>,
      ),
    view: async (id: Id) => {
      const candidate = await run((s) => s.recruiting.markViewed(id), { refresh: false });
      if (candidate) router.push("/recruiter/talent/" + candidate);
    },
    contact: async (item: ResponseItem) => {
      await run((s) => s.recruiting.markViewed(item.application.id));
      modal.show("Candidate contact", <ContactDialog item={item} />);
    },
    exportProfile: async (id: Id) => {
      const file = await services.recruiting.exportProfile(id);
      if (file) downloadFile(file.fileName, file.text);
    },
    outreach: async (ids: Id[]) => {
      const names = await services.recruiting.applicantNames(ids);
      if (names.length) modal.show("Prepare an outreach draft", <OutreachForm ids={ids} names={names} />);
    },
    exportCsv: async (ids: Id[]) => {
      downloadFile("skillora-responses.csv", await services.recruiting.exportCsv(ids), "text/csv;charset=utf-8");
      toast("Selected responses exported as CSV.");
    },
  };
}

export function ResponseCenterScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const url = useResponseUrl();
  const q = Object.fromEntries(params) as ResponseParams;
  const { selection } = useUiStore((s) => s.responses);
  const setResponses = useUiStore((s) => s.setResponses);
  const actions = useResponseActions();
  const { data: m } = useServiceQuery(["responses", params.toString()], (s) => s.recruiting.listResponses(q));
  const visible = m?.items ?? [];
  const allChecked = visible.length > 0 && visible.every(({ application }) => selection.includes(application.id));
  const select = (id: Id, checked: boolean) => setResponses({ selection: checked ? [...new Set([...selection, id])] : selection.filter((x) => x !== id) });
  const from = m && m.total ? (m.page - 1) * m.pageSize + 1 + "–" + Math.min(m.page * m.pageSize, m.total) : 0;
  const bulk: [string, () => void, Parameters<typeof Button>[0]["icon"]][] = [
    ["Shortlist", () => actions.status(selection, "Shortlisted"), "check"],
    ["Maybe", () => actions.status(selection, "Reviewing"), "folder"],
    ["Reject", () => actions.status(selection, "Rejected"), "close"],
    ["Email draft", () => actions.outreach(selection), "mail"],
    ["Download", () => actions.exportCsv(selection), "download"],
    ["Remove", () => actions.remove(selection), "trash"],
  ];
  return (
    <div className="response-center">
      <PageHeading
        title="Job responses"
        subtitle="Review applicants with context, filters, and clear next steps."
        actions={
          <>
            <LinkButton href={BASE} icon="arrow">
              Back to jobs
            </LinkButton>
            <Button variant="primary" icon="plus" onClick={() => router.push("/recruiter/jobs/new")}>
              Post a job
            </Button>
          </>
        }
      />
      <div className="response-center-layout">
        <Filters q={q} />
        <section className="response-center-content" aria-label="Applicant responses">
          <div className="response-stage-tabs" aria-label="Response sections">
            {(Object.entries(RESPONSE_TABS) as [ResponseTab, string][]).map(([key, label]) => (
              <Link key={key} href={url({ stage: key, page: "" })} className={m?.stage === key ? "active" : ""} aria-current={m?.stage === key ? "page" : undefined}>
                {label}
                {!!m?.tabCounts[key] && <span>{m.tabCounts[key]}</span>}
              </Link>
            ))}
          </div>
          <div className="response-right-search">
            <form
              id="response-search-form"
              key={params.toString()}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const job = String(f.get("job") || "");
                setResponses({ selection: [] });
                router.push(url({ q: String(f.get("q") || "").trim(), job, distance: job ? q.distance || "" : "", page: "" }));
              }}
            >
              <label className="application-search">
                <Icon name="search" />
                <FloatingInput label="Search applicants" compact type="search" name="q" defaultValue={q.q || ""} placeholder="Search applicants" aria-label="Search applicants" />
              </label>
              <label className="sr-only" htmlFor="response-job-select">
                Filter by job
              </label>
              <FloatingSelect label="Filter by job" id="response-job-select" name="job" defaultValue={q.job || ""} options={[{ value: "", label: "All job posts" }, ...(m?.jobs ?? []).map((j) => ({ value: j.id, label: j.title }))]} />
              <button type="submit" className="btn sm search-button">
                <Icon name="search" />
                Search
              </button>
              {(q.q || q.job) && (
                <LinkButton href={url({ q: "", job: "", distance: "", page: "" })} variant="text sm">
                  Clear search
                </LinkButton>
              )}
            </form>
          </div>
          {q.fit === "1" && (
            <div className="response-ai-summary">
              <Icon name="spark" />
              <div>
                <strong>Keyword match filter is on · {q.threshold || 60}% minimum</strong>
                <p>{q.fitTerms ? "Terms: " + q.fitTerms : "Uses the skills listed on each applicant’s job post."}{devCopy(" Matches use saved profile/project text and any supplied resume text. This is a local matching demo.", " Matches use saved profile/project text and any supplied resume text.")}</p>
              </div>
              <Button variant="text sm" icon="close" onClick={() => router.push(url({ fit: "", fitTerms: "", threshold: "", page: "" }))}>
                Clear match filter
              </Button>
            </div>
          )}
          <div className="response-results-meta">
            <span>
              Showing {from} of {m?.total ?? 0} responses
            </span>
            <div className="response-view-toggle" role="group" aria-label="Applicant detail view">
              <Button variant={"sm" + (q.rows === "compact" ? " active" : "")} icon="menu" aria-pressed={q.rows === "compact"} onClick={() => router.push(url({ rows: "compact" }))}>
                Collapse
              </Button>
              <Button variant={"sm" + (q.rows !== "compact" ? " active" : "")} icon="layout" aria-pressed={q.rows !== "compact"} onClick={() => router.push(url({ rows: "" }))}>
                Expand
              </Button>
            </div>
            <label>
              <FloatingSelect
                label="Sort by"
                id="response-sort"
                aria-label="Sort responses"
                value={m?.sort ?? "newest"}
                onChange={(e) => router.push(url({ sort: e.target.value, page: "" }))}
                options={[
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                  { value: "relevance", label: "Keyword relevance" },
                  { value: "experience", label: "Experience" },
                ]}
              />
            </label>
            <label>
              <FloatingSelect label="Show" id="response-page-size" aria-label="Responses per page" value={String(m?.pageSize ?? 10)} onChange={(e) => router.push(url({ size: e.target.value, page: "" }))} options={["10", "20", "40"]} />
            </label>
            <span>
              Page {m?.page ?? 1} of {m?.pages ?? 1}
            </span>
            {m && m.page > 1 && (
              <LinkButton href={url({ page: m.page - 1 })} variant="text sm" icon="arrow">
                Previous
              </LinkButton>
            )}
            {m && m.page < m.pages && (
              <LinkButton href={url({ page: m.page + 1 })} variant="text sm" icon="arrow">
                Next
              </LinkButton>
            )}
          </div>
          <div className="card response-bulk-toolbar">
            <label>
              <input
                type="checkbox"
                id="response-select-all"
                checked={allChecked}
                disabled={!visible.length}
                onChange={(e) => {
                  const ids = visible.map(({ application }) => application.id);
                  setResponses({ selection: e.target.checked ? [...new Set([...selection, ...ids])] : selection.filter((id) => !ids.includes(id)) });
                }}
              />
              Select all
            </label>
            <span className="response-selection-count">{selection.length ? selection.length + " selected" : ""}</span>
            <div className="response-bulk-actions">
              {bulk.map(([label, onClick, icon]) => (
                <Button key={label} variant="text sm" icon={icon} disabled={!selection.length} onClick={onClick}>
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="response-candidate-list">
            {m &&
              (visible.length ? (
                visible.map((item) => <CandidateCard key={item.application.id} item={item} q={q} selected={selection.includes(item.application.id)} onSelect={(c) => select(item.application.id, c)} actions={actions} />)
              ) : (
                <div className="card">
                  <EmptyState
                    title="No responses match this view."
                    description="Try another stage, job, or filter. Missing optional profile details are excluded by active filters."
                    action={
                      <LinkButton href={BASE + "?view=responses" + (q.job ? "&job=" + q.job : "")} variant="primary">
                        Clear filters
                      </LinkButton>
                    }
                  />
                </div>
              ))}
          </div>
          <DevOnly>
            <p className="response-local-note">
              <Icon name="shield" />
              Fictional and locally saved applications. Statuses, notes, match results, and outreach drafts stay in this browser. No external messages are sent.
            </p>
          </DevOnly>
        </section>
      </div>
    </div>
  );
}
