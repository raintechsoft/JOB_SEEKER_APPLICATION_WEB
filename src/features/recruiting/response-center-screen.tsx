"use client";
import { useHiringQuery } from "@/hooks/use-hiring-query";

import { InfoBadge } from "@/components/ui/info-badge";
import {ApplicationSharingDetails,sharedPayLabel,SubmittedDocumentViewer} from "@/features/applications/application-sharing-details";

import { QueryFeedback } from "@/components/ui/query-view";

import Link from "next/link";
import Image from "next/image";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {outreachSchema} from "@/lib/validation/application";
import {responseFiltersSchema,RECRUITING_RULES} from "@/lib/validation/recruiting";
import {validationFields} from "@/lib/validation/profile";
import {useFormAction} from "@/hooks/use-form-action";
import { useRouter, useSearchParams } from "next/navigation";
import type { HiringStage, Id } from "@/types/domain";
import { RESPONSE_FILTER_KEYS, RESPONSE_TABS, type ResponseItem, type ResponseParams, type ResponseTab } from "@/services/recruiting/recruiting.service";
import { formatLocaleDate, formatLongDate } from "@/lib/utils/date";
import { downloadFile } from "@/lib/utils/files";
import { devCopy,isPrototype } from "@/lib/env/app-env";
import { track } from "@/lib/analytics";
import { useServiceAction, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, EmptyState, IconButton, LinkButton } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/pagination";
import { DevOnly } from "@/components/ui/dev-only";
import { FloatingInput, FloatingSelect, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { CatalogPicker } from "@/components/ui/skill-picker";
import { useContactCandidate } from "@/features/talent/dialogs";
import { MatchBadge } from "@/components/jobs/match-badge";
import { useImpression } from "@/hooks/use-impression";
import { useInteractionTracking } from "@/hooks/use-interaction-tracking";
import { openReview } from "./review-dialog";
import {ExportRequest,OutreachDeliveryReview} from "./delivery-dialogs";
import { RESPONSE_KEYWORD_MATCHING_ENABLED } from "@/lib/feature-flags";
import { ResponseDataGrid } from "./response-data-grid";

const CARDS_BASE = "/recruiter/applications";
const TABLE_BASE = "/recruiter/applications/table";
/** @deprecated Prefer CARDS_BASE / TABLE_BASE; kept for filter clear links that land on cards. */
const BASE = CARDS_BASE;

export type ResponseCenterMode = "cards" | "table";

function tableHref(params: URLSearchParams) {
  const q = new URLSearchParams(params);
  q.delete("rows");
  q.delete("view");
  const s = q.toString();
  return s ? TABLE_BASE + "?" + s : TABLE_BASE;
}

function cardsHref(params: URLSearchParams, rows?: "compact" | "") {
  const q = new URLSearchParams(params);
  q.set("view", "responses");
  q.delete("rows");
  if (rows === "compact") q.set("rows", "compact");
  return CARDS_BASE + "?" + q;
}

function measureStageOverflow(el: HTMLElement) {
  const { scrollLeft, scrollWidth, clientWidth } = el;
  return {
    left: scrollLeft > 1,
    right: scrollLeft + clientWidth < scrollWidth - 1,
  };
}

function ResponseStageTabs({
  stage,
  tabCounts,
  hrefFor,
}: {
  stage?: string;
  tabCounts?: Partial<Record<ResponseTab, number>>;
  hrefFor: (key: ResponseTab) => string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  function syncOverflow() {
    const el = listRef.current;
    if (!el) return;
    setOverflow(measureStageOverflow(el));
  }

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>("a.active");
    active?.scrollIntoView?.({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [stage]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    syncOverflow();
    const onScroll = () => syncOverflow();
    el.addEventListener("scroll", onScroll, { passive: true });
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncOverflow()) : null;
    resize?.observe(el);
    window.addEventListener("resize", syncOverflow);
    return () => {
      el.removeEventListener("scroll", onScroll);
      resize?.disconnect();
      window.removeEventListener("resize", syncOverflow);
    };
  }, [tabCounts]);

  function scrollStages(direction: -1 | 1) {
    const el = listRef.current;
    if (!el) return;
    const step = Math.max(140, Math.floor(el.clientWidth * 0.7));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <div
      className={
        "response-stage-tabs-shell" +
        (overflow.left ? " has-overflow-left" : "") +
        (overflow.right ? " has-overflow-right" : "")
      }
    >
      {overflow.left ? (
        <button type="button" className="response-stage-tabs-arrow is-prev" aria-label="Show previous sections" onClick={() => scrollStages(-1)}>
          <Icon name="chevron" />
        </button>
      ) : null}
      <div ref={listRef} className="response-stage-tabs" aria-label="Response sections">
        {(Object.entries(RESPONSE_TABS) as [ResponseTab, string][]).map(([key, label]) => (
          <Link key={key} href={hrefFor(key)} className={stage === key ? "active" : ""} aria-current={stage === key ? "page" : undefined}>
            {label}
            {!!tabCounts?.[key] && <span>{tabCounts[key]}</span>}
          </Link>
        ))}
      </div>
      {overflow.right ? (
        <button type="button" className="response-stage-tabs-arrow is-next" aria-label="Show more sections" onClick={() => scrollStages(1)}>
          <Icon name="chevron" />
        </button>
      ) : null}
    </div>
  );
}

function useResponseUrl(mode: ResponseCenterMode) {
  const params = useSearchParams();
  return (changes: Record<string, string | number | null>) => {
    const q = new URLSearchParams(params);
    q.delete("rows");
    if (mode === "cards") q.set("view", "responses");
    else q.delete("view");
    for (const [key, value] of Object.entries(changes)) {
      q.delete(key);
      if (value !== "" && value != null) q.set(key, String(value));
    }
    const base = mode === "table" ? TABLE_BASE : CARDS_BASE;
    const s = q.toString();
    return s ? base + "?" + s : base;
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

const RESPONSE_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "relevance", label: "Best match" },
  { value: "experience", label: "Experience" },
];

function ResponseFilterFields({ q }: { q: ResponseParams }) {
  const router = useRouter();
  const setResponses = useUiStore((s) => s.setResponses);
  const params = useSearchParams();
  const job = q.job || "";
  const clearHref = BASE + "?view=responses" + (job ? "&job=" + job : "");
  const num = (label: string, name: string, max?: number) => <TextField label={label} name={name} type="number" min={0} max={max} defaultValue={q[name] || ""} />;
  const openKeywordMatch = () => modal.show(devCopy("AI filter · Keyword matching demo", "Keyword matching"), <AiFilterForm q={q} />, "project");
  return (
    <div className="response-filter-fields is-sheet">
      {RESPONSE_KEYWORD_MATCHING_ENABLED ? (
        <>
          <Button variant="primary response-ai-button" icon="spark" onClick={openKeywordMatch}>
            {devCopy("AI filter", "Keyword matching")}
          </Button>
          <DevOnly>
            <span className="response-ai-label">Keyword-matching demo</span>
          </DevOnly>
        </>
      ) : null}
      <form
        id="response-advanced-filter-sheet"
        key={params.toString()}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const get = (k: string) => String(f.get(k) || "").trim();
          if (get("distance") && !q.job) return toast("Choose a job before using the distance filter.");
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
          const sort = get("sort") || q.sort || "newest";
          if (sort && sort !== "newest") next.set("sort", sort);
          else next.delete("sort");
          next.set("view", "responses");
          next.delete("page");
          if (!isPrototype) {
            const checked = responseFiltersSchema.safeParse(Object.fromEntries(next));
            if (!checked.success) return toast(checked.error.issues[0].message);
          }
          setResponses({ selection: [] });
          track("search_performed", { surface: "responses", hasQuery: !!get("keywords") });
          modal.close();
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
          <div className="response-filter-range">
            <TextField label="Location / city" name="location" type="search" defaultValue={q.location || ""} />
            <TextField label="Locality" name="locality" type="search" defaultValue={q.locality || ""} />
          </div>
          <SelectField label="Distance from job" name="distance" defaultValue={q.distance || ""} options={[{ value: "", label: "Any distance" }, ...[5, 10, 25, 50, 100, 500].map((v) => ({ value: String(v), label: "Within " + v + " km" }))]} />
          <p className="response-filter-help">Choose a job in the list header to use distance. City-centre estimates are used where precise coordinates are unavailable.</p>
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
          <div className="response-filter-range">
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
          </div>
        </Panel>
        <Panel title="Professional background">
          <CatalogPicker catalog="industry" name="industry" label="Industry" defaultValue={q.industry || ""} />
          <div className="response-filter-range">
            <CatalogPicker catalog="role" name="designation" label="Designation" defaultValue={q.designation || ""} />
            <CatalogPicker catalog="department" name="department" label="Department" defaultValue={q.department || ""} />
          </div>
        </Panel>
        <p className="response-filter-help">Active filters exclude records with missing details. Private profile salary, notice, phone, and address are not read.</p>
        <SelectField label="Sort by" name="sort" defaultValue={q.sort || "newest"} options={RESPONSE_SORT_OPTIONS} />
        <div className="response-filter-actions">
          <LinkButton
            href={clearHref}
            variant="text sm"
            onClick={() => {
              modal.close();
            }}
          >
            Clear
          </LinkButton>
          <button className="btn primary" type="submit">
            Apply filters
          </button>
        </div>
      </form>
    </div>
  );
}

function AiFilterForm({ q }: { q: ResponseParams }) {
  const run = useServiceAction();
  const router = useRouter();
  const setResponses = useUiStore((s) => s.setResponses);
  const { data: page, isError, error, refetch } = useHiringQuery(["responses", "jobs"], (s, scope) => s.recruiting.listResponses({}, scope));
  if (!page) return <QueryFeedback data={page} error={isError} cause={error} retry={refetch} compact label="Loading job scopes" />;
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
        if(!isPrototype){const checked=responseFiltersSchema.safeParse(Object.fromEntries(next));if(!checked.success)return toast(checked.error.issues[0].message);}
        const result = await run((s) => s.recruiting.runKeywordMatch(Object.fromEntries(next), f.has("shortlist")),{invalidate:["jobs-manager","responses","review","hiring-summary","jobs","job","feed","applications"]});
        if (!result) return;
        setResponses({ selection: [] });
        modal.close();
        router.push(BASE + "?" + next);
        toast(result.matches + " keyword matches · " + result.shortlisted + devCopy(" responses shortlisted in this demo.", " responses shortlisted."));
      }}
    >
      <SelectField label="Job scope" name="job" defaultValue={q.job || ""} options={[{ value: "", label: "All job responses" }, ...page.jobs.map((j) => ({ value: j.id, label: j.title }))]} />
      <TextAreaField label="Match keywords (comma separated)" name="terms" defaultValue={q.keywords || q.fitTerms || job?.skills.join(", ") || ""} maxLength={500} />
      <p className="small muted">Leave blank to use each job’s listed skills. Matches inspect the submitted profile and explicitly shared portfolio. Uploaded CV files are not parsed.</p>
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
      <InfoBadge label="Recruiting information">This uses transparent keyword matching, not an assessment of candidate ability. Match reasons are shown on each result. Rejected, hired, and interview decisions are preserved.</InfoBadge>
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
  const [errors,setErrors]=useState<Record<string,string>>({});
  const {execute,pending}=useFormAction(setErrors);
  return (
    <form
      id="response-note-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const note=String(new FormData(e.currentTarget).get("note")||"").trim();
        if(note.length>5000)return setErrors({note:"Use at most 5000 characters."});
        if(!await execute((s)=>s.recruiting.saveNote(item.application.id,note,item.application.version)))return;
        modal.close();
        toast("Hiring note saved.");
      }}
    >
      <h3>{item.profile.name}</h3>
      {errors._form&&<p role="alert">{errors._form}</p>}
      <TextAreaField label="Your note" name="note" error={errors.note} defaultValue={item.application.recruiterNote} maxLength={2000} />
      <p className="small muted">{devCopy("Private hiring notes are saved in this browser.", "Hiring notes are private.")}</p>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" loading={pending} disabled={pending}>
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
        <InfoBadge label="Recruiting information">These are fictional or applicant-supplied demo details. No call or email is sent.</InfoBadge>
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
  const [errors,setErrors]=useState<Record<string,string>>({});
  const {execute,pending}=useFormAction(setErrors);
  return (
    <form
      id="response-outreach-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const checked=outreachSchema.omit({ids:true}).safeParse({subject:String(f.get("subject")||"").trim(),message:String(f.get("message")||"").trim()});
        if(!checked.success)return setErrors(validationFields(checked.error));
        let draftId:string|undefined;
        if(!await execute(async(s)=>{const saved=await s.recruiting.saveOutreach(ids,checked.data.subject,checked.data.message);draftId=saved?.draftId;}))return;
        if(draftId){modal.show("Review outreach recipients and message",<OutreachDeliveryReview id={draftId}/>);return;}
        modal.close();
        toast(devCopy("Outreach draft saved locally. No email was sent.", "Outreach draft saved."));
      }}
    >
      <p className="small muted">For {names.join(", ")}</p>
      {Object.entries(errors).filter(([key])=>key!=="subject"&&key!=="message").map(([key,error])=><p role="alert" className="error" key={key}>{error}</p>)}
      <TextField label="Subject" name="subject" required maxLength={150} disabled={pending} error={errors.subject}/>
      <TextAreaField label="Message draft" name="message" required maxLength={3000} disabled={pending} error={errors.message}/>
      <InfoBadge label="Recruiting information">{devCopy("This saves a local draft only. It does not send email.","Save a draft first, then review recipients and explicitly queue delivery.")}</InfoBadge>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" loading={pending} disabled={pending}>
          Save outreach draft
        </Button>
      </div>
    </form>
  );
}

function CandidateCard({ item, q, selected, onSelect, actions }: { item: ResponseItem; q: ResponseParams; selected: boolean; onSelect: (c: boolean) => void; actions: ReturnType<typeof useResponseActions> }) {
  const contact = useContactCandidate();
  const { application: a, profile: p, fit, distance } = item;
  const canMove=(stage:HiringStage)=>isPrototype||!a.withdrawnAt&&(a.status===stage||(RECRUITING_RULES.transitions[a.status] as string[]).includes(stage));
  const fitOn = RESPONSE_KEYWORD_MATCHING_ENABLED && q.fit === "1";
  // A best-match list is a recommendation list (U9): exposure, and opening an applicant, teach the ranking.
  const context = item.analyticsContext;
  const seenRef = useImpression<HTMLElement>(() => { if (context) track("recommendation_exposed", context); }, context?.requestId);
  const { ref: watchRef, click: watchClick } = useInteractionTracking<HTMLElement>(item.ranking ? { kind: "professional", id: a.candidate } : null, { surface: "applicants", position: context?.position, requestId: context?.requestId });
  const setRef = (el: HTMLElement | null) => { seenRef.current = el; watchRef.current = el; };
  const open = () => { if (context) track("recommendation_clicked", context); watchClick(); actions.view(a.id); };
  return (
    <article ref={setRef} className={"card response-candidate" + (q.rows === "compact" ? " is-compact" : "")} data-response-id={a.id}>
      <div className="response-candidate-main">
        <div className="response-candidate-heading">
          <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={"Select " + p.name} />
          <button type="button" onClick={open}>
            <h2>{p.name}</h2>
          </button>
          {item.ranking?.match ? <MatchBadge match={item.ranking.match} /> : fitOn ? <span className="response-fit-badge">{fit.score}% keyword match</span> : a.portfolio ? <span className="response-portfolio-badge">Portfolio included</span> : null}
          <span className="response-status">{a.withdrawnAt?"Withdrawn · Previously "+a.status:a.status}</span>
        </div>
        {item.ranking && <p className="response-match-reason">{item.ranking.reason}</p>}
        <div className="response-facts">
          <span>
            <Icon name="briefcase" />
            {p.years} years
          </span>
          <span>
            <Icon name="file" />
            {item.sharing ? sharedPayLabel(item.sharing.expectedCompensation) : p.expectedSalary == null ? "Salary not provided" : "₹" + p.expectedSalary + " LPA expected"}
          </span>
          <span>
            <Icon name="clock" />
            {p.notice == null ? "Notice not provided" : p.notice === 0 ? "Immediate notice" : p.notice + " days notice"}
          </span>
          {p.location?.trim() || p.locality ? (
            <span>
              <Icon name="location" />
              {[p.location?.trim(), p.locality].filter(Boolean).join(" · ")}
            </span>
          ) : null}
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
          <Button variant="sm response-shortlist" icon="check" disabled={!canMove("Shortlisted")} onClick={() => actions.status([a.id], "Shortlisted")}>
            Shortlist
          </Button>
          <Button variant="sm" icon="folder" disabled={!canMove("Reviewing")} onClick={() => actions.status([a.id], "Reviewing")}>
            Maybe
          </Button>
          <Button variant="sm response-reject" icon="close" disabled={!canMove("Rejected")} onClick={() => actions.status([a.id], "Rejected")}>
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
        <SubmittedResumeButton item={item} />
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

/** Opens the resume the candidate submitted in the browser; downloading is optional from the viewer. */
function SubmittedResumeButton({item}:{item:ResponseItem}){
  const resume=item.sharing?.attachments.find(file=>file.kind==="resume");
  if(!resume)return null;
  return <Button variant="sm" icon="eye" className="response-resume-download" onClick={()=>modal.show("Resume · "+item.profile.name,<SubmittedDocumentViewer file={resume} applicationId={item.application.id} reviewer/>,"project")} aria-label={"View submitted resume: "+resume.name} title={resume.name}>View resume</Button>;
}

function SubmittedProfile({item}:{item:ResponseItem}){
  const {profile:p,application:a,portfolio}=item;
  return <div className="stack"><div className="row"><Avatar person={p} size="lg"/><div><h2>{p.name}</h2><p>{p.headline}</p></div></div><InfoBadge label="Submitted application information">Submitted with this application on {formatLongDate(a.createdAt.slice(0,10))}. This copy retains what the applicant shared at submission.</InfoBadge><p>{p.location} · {p.years} years of experience</p><p style={{whiteSpace:"pre-line"}}>{p.summary}</p><p>{p.skills.join(" · ")}</p><h3>Experience</h3><p style={{whiteSpace:"pre-line"}}>{p.experience||"Not provided"}</p><h3>Education</h3><p style={{whiteSpace:"pre-line"}}>{p.educationText||"Not provided"}</p><h3>Shared contact and recruitment details</h3><p>{p.email}{p.phone?" · "+p.phone:""}</p>{!item.sharing&&<p>Expected salary: {p.expectedSalary===null?"Not shared":p.expectedSalary+" LPA"}</p>}<p>Notice: {p.notice===null?"Not shared":p.notice+" days"}</p>{item.sharing&&<ApplicationSharingDetails sharing={item.sharing} applicationId={a.id} reviewer/>}{portfolio&&<><h3>Included portfolio</h3>{portfolio.person.summary&&<p>{portfolio.person.summary}</p>}{portfolio.projects.map((project)=><section className="card stack" style={{padding:16}} key={project.id}>{project.cover&&<Image src={project.cover} width={400} height={240} unoptimized alt={project.title} style={{maxWidth:"100%",height:"auto"}}/>}<h4>{project.title}</h4><p>{project.description}</p><p>{project.contribution}</p><p>{project.skills.join(" · ")}</p></section>)}{portfolio.updates.map((update)=><section key={update.id}><h4>{update.title}</h4><p>{update.description}</p></section>)}</>}<div className="modal-footer"><Button onClick={()=>modal.close()}>Close</Button><Button variant="primary" onClick={()=>openReview(a.id)}>Review application</Button></div></div>;
}

const validBulkSelection=(ids:Id[])=>{if(!ids.length||ids.length>100||new Set(ids).size!==ids.length){toast("Choose 1–100 distinct records for this action.");return false;}return true;};

function useResponseActions() {
  const run = useServiceAction();
  const services = useServices();
  const router = useRouter();
  const { selection } = useUiStore((s) => s.responses);
  const setResponses = useUiStore((s) => s.setResponses);
  return {
    status: async (ids: Id[], status: HiringStage) => {
      if(!validBulkSelection(ids))return;
      const n = await run((s) => s.recruiting.setStatus(ids, status),{invalidate:["jobs-manager","responses","review","hiring-summary","jobs","job","feed","applications"]});
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
                if(!validBulkSelection(ids))return;
                if(!await run(async(s)=>{await s.recruiting.remove(ids);return true;},{invalidate:["jobs-manager","responses","review","hiring-summary","jobs","job","feed","applications"]}))return;
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
      if(!isPrototype){const item=await run((s)=>s.recruiting.getApplicant(id),{refresh:false});if(!item)return;const marked=await run((s)=>s.recruiting.markViewed(id),{refresh:false});if(!marked)return;modal.show("Submitted profile",<SubmittedProfile item={item}/>,"project");return;}
      const candidate = await run((s) => s.recruiting.markViewed(id), { refresh: false });
      if (candidate) router.push("/recruiter/talent/" + candidate);
    },
    contact: async (item: ResponseItem) => {
      await run((s) => s.recruiting.markViewed(item.application.id),{invalidate:["jobs-manager","responses","review","hiring-summary","jobs","job","feed","applications"]});
      modal.show("Candidate contact", <ContactDialog item={item} />);
    },
    exportProfile: async (id: Id) => {
      const file = await services.recruiting.exportProfile(id);
      if (file) downloadFile(file.fileName, file.text);
    },
    outreach: async (ids: Id[]) => {
      if(!validBulkSelection(ids))return;
      const names = await services.recruiting.applicantNames(ids);
      if (names.length) modal.show("Prepare an outreach draft", <OutreachForm ids={ids} names={names} />);
    },
    exportCsv: async (ids: Id[]) => {
      if(!validBulkSelection(ids))return;
      downloadFile("skillora-responses.csv", await services.recruiting.exportCsv(ids), "text/csv;charset=utf-8");
      toast("Selected responses exported as CSV.");
    },
  };
}

export function ResponseCenterScreen({ mode = "cards" }: { mode?: ResponseCenterMode }) {
  const params = useSearchParams();
  const router = useRouter();
  const url = useResponseUrl(mode);
  const q = Object.fromEntries(params) as ResponseParams;
  const isTable = mode === "table";
  const { selection } = useUiStore((s) => s.responses);
  const setResponses = useUiStore((s) => s.setResponses);
  const actions = useResponseActions();
  const { data: m,isError,error,refetch } = useHiringQuery(["responses", params.toString()], (s, scope) => s.recruiting.listResponses(q, scope));
  // Job scope and stage tabs are views, not filters; "no matches" is reserved for real narrowing.
  const filtered = !!(q.q || q.fit === "1" || RESPONSE_FILTER_KEYS.some((key) => q[key as keyof ResponseParams]));
  const filterCount = RESPONSE_FILTER_KEYS.reduce((n, key) => n + (q[key as keyof ResponseParams] ? 1 : 0), 0) + (q.fit === "1" ? 1 : 0);
  const openFilterSheet = () => modal.show("Advanced filters", <ResponseFilterFields q={q} />, "following");
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
    ...(!isPrototype?[["Queue CSV",()=>modal.show("Prepare background export",<ExportRequest ids={selection}/>),"download"] as [string,()=>void,Parameters<typeof Button>[0]["icon"]]]:[]),
    ["Remove", () => actions.remove(selection), "trash"],
  ];
  return (
    <div className={"response-center" + (isTable ? " is-table-page" : "")}>
      <div className="response-center-layout">
        <section className="response-center-content" aria-label={isTable ? "Applicant responses table" : "Applicant responses"}>
          <div className="response-filter-toolbar">
            <div className="response-view-toggle" role="group" aria-label="Applicant detail view">
              <Button variant={"sm" + (!isTable && q.rows === "compact" ? " active" : "")} icon="menu" aria-pressed={!isTable && q.rows === "compact"} onClick={() => router.push(cardsHref(params, "compact"))}>
                Collapse
              </Button>
              <Button variant={"sm" + (!isTable && !q.rows ? " active" : "")} icon="layout" aria-pressed={!isTable && !q.rows} onClick={() => router.push(cardsHref(params, ""))}>
                Expand
              </Button>
              <Button variant={"sm" + (isTable ? " active" : "")} icon="grid" aria-pressed={isTable} onClick={() => router.push(tableHref(params))}>
                Table
              </Button>
            </div>
            <label className="response-sort-label">
              <FloatingSelect label="Sort by" id="response-sort" aria-label="Sort responses" value={m?.sort ?? "newest"} onChange={(e) => router.push(url({ sort: e.target.value, page: "" }))} options={RESPONSE_SORT_OPTIONS} />
            </label>
            <Button className="response-filter-toggle" variant="sm" icon="sliders" onClick={openFilterSheet} aria-haspopup="dialog">
              Advanced{filterCount ? ` (${filterCount})` : ""}
            </Button>
            <Button className="response-post-job" variant="primary" icon="plus" onClick={() => router.push("/recruiter/jobs/new")}>
              Post a job
            </Button>
          </div>
          <ResponseStageTabs stage={m?.stage} tabCounts={m?.tabCounts} hrefFor={(key) => url({ stage: key, page: "" })} />
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
              <FloatingSelect label="Filter by job" compact id="response-job-select" name="job" defaultValue={q.job || ""} options={[{ value: "", label: "All job posts" }, ...(m?.jobs ?? []).map((j) => ({ value: j.id, label: j.title }))]} />
              <button type="submit" className="btn sm search-button">
                <Icon name="search" />
                Search
              </button>
              <Button
                variant="text sm"
                className="response-search-clear"
                disabled={!(q.q || q.job)}
                onClick={() => {
                  setResponses({ selection: [] });
                  router.push(url({ q: "", job: "", distance: "", page: "" }));
                }}
              >
                Clear
              </Button>
            </form>
          </div>
          {RESPONSE_KEYWORD_MATCHING_ENABLED && q.fit === "1" && (
            <div className="response-ai-summary">
              <Icon name="spark" />
              <div>
                <strong>Keyword match filter is on · {q.threshold || 60}% minimum</strong>
                <p>{q.fitTerms ? "Terms: " + q.fitTerms : "Uses the skills listed on each applicant’s job post."}{devCopy(" Matches use saved profile/project text and any supplied resume text. This is a local matching demo.", " Matches use the submitted profile and explicitly shared portfolio.")}</p>
              </div>
              <Button variant="text sm" icon="close" onClick={() => router.push(url({ fit: "", fitTerms: "", threshold: "", page: "" }))}>
                Clear match filter
              </Button>
            </div>
          )}
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
          <QueryFeedback data={m} error={isError} cause={error} retry={refetch} label="Loading applicants" />
            {m &&
              (visible.length ? (
                isTable ? (
                  <ResponseDataGrid
                    items={visible}
                    selection={selection}
                    allChecked={allChecked}
                    onSelect={select}
                    onSelectAll={(checked) => {
                      const ids = visible.map(({ application }) => application.id);
                      setResponses({ selection: checked ? [...new Set([...selection, ...ids])] : selection.filter((id) => !ids.includes(id)) });
                    }}
                    actions={actions}
                    sort={m?.sort ?? q.sort ?? "newest"}
                    onSortChange={(next) => router.push(url({ sort: next === "newest" ? "" : next, page: "" }))}
                    filterParams={Object.fromEntries(params.entries())}
                    onFilterPatch={(patch) => {
                      const next: Record<string, string | number | null> = { page: "" };
                      for (const [key, value] of Object.entries(patch)) next[key] = value.trim() ? value.trim() : "";
                      router.push(url(next));
                    }}
                    total={m?.total}
                  />
                ) : (
                  visible.map((item) => <CandidateCard key={item.application.id} item={item} q={q} selected={selection.includes(item.application.id)} onSelect={(c) => select(item.application.id, c)} actions={actions} />)
                )
              ) : (
                <div className="card">
                  {filtered ? (
                    <EmptyState
                      icon="search"
                      title="No responses match these filters"
                      description="Try different filters. Applicants missing optional profile details are excluded by active filters."
                      action={
                        <LinkButton href={BASE + "?view=responses" + (q.job ? "&job=" + q.job : "")} variant="primary">
                          Clear filters
                        </LinkButton>
                      }
                    />
                  ) : m.stage !== "all" ? (
                    <EmptyState
                      icon="folder"
                      title={"Nothing in " + RESPONSE_TABS[m.stage as ResponseTab] + " yet"}
                      description="Responses move here as you review them."
                      action={<LinkButton href={url({ stage: "all", page: "" })} variant="primary">View all responses</LinkButton>}
                    />
                  ) : (
                    <EmptyState
                      icon="inbox"
                      title={q.job ? "No responses for this job yet" : "No responses yet"}
                      description="Applications appear here as soon as candidates apply to your job posts."
                      action={q.job ? <LinkButton href={url({ job: "", distance: "", page: "" })} variant="primary">View all job responses</LinkButton> : <LinkButton href={BASE} variant="primary" icon="briefcase">Manage jobs</LinkButton>}
                    />
                  )}
                </div>
              ))}
          </div>
          <Pagination
            id="response-page-size"
            page={m?.page ?? 1}
            pages={m?.pages ?? 1}
            pageSize={m?.pageSize ?? 10}
            pageSizeOptions={[10, 20, 40]}
            pageSizeLabel="Responses per page"
            summary={"Showing " + from + " of " + (m?.total ?? 0) + " responses"}
            previousHref={m && m.page > 1 ? url({ page: m.page - 1 }) : null}
            nextHref={m && m.page < m.pages ? url({ page: m.page + 1 }) : null}
            onPageSizeChange={(next) => router.push(url({ size: next, page: "" }))}
          />
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
