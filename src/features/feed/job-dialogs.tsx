"use client";

import { usePathname } from "next/navigation";
import type { Id, Role } from "@/types/domain";
import { formatLocaleDate } from "@/lib/utils/date";
import { devCopy } from "@/lib/env/app-env";
import { track } from "@/lib/analytics";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Badge, Button, LinkButton, Tags } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { CompanyAvatar } from "@/components/jobs/job-visuals";

function CandidatePreferences({ values }: { values: Record<string, unknown> | undefined }) {
  if (!values) return null;
  const education = Array.isArray(values.education) ? values.education.join(", ") : "";
  return (
    <div>
      <h3>Candidate preferences</h3>
      <p className="small muted">
        {String(values.experienceMin ?? "")}–{String(values.experienceMax ?? "")} years · {education || "Any qualification"}
        <br />
        {String(values.vacancies ?? "")} vacancies
      </p>
    </div>
  );
}

function JobDetails({ id, role }: { id: Id; role: Role }) {
  const { data } = useServiceQuery(["job", id, role], (s) => s.jobs.getJob(id, role));
  const actions = useJobActions();
  if (!data) return null;
  const { job, company, saved, application } = data;
  if (role === "recruiter") {
    return (
      <div className="stack">
        <h3>{company.name}</h3>
        <p className="small muted">
          {job.location} · {job.arrangement} · {job.employment}
        </p>
        <p>{job.description}</p>
        <Tags items={job.skills} />
        <CandidatePreferences values={job.wizardValues as Record<string, unknown> | undefined} />
        {job.benefits && (
          <div>
            <h3>Benefits & perks</h3>
            <p>{job.benefits}</p>
          </div>
        )}
        <h3>Responsibilities</h3>
        <ul className="feed-job-list">
          {job.responsibilities.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p>{job.requirements}</p>
        {data.ownedByViewer && (
          <LinkButton href={"/recruiter/applications?job=" + job.id} variant="primary" icon="users">
            View applications
          </LinkButton>
        )}
      </div>
    );
  }
  return (
    <div className="stack">
      <div className="row">
        <CompanyAvatar company={company} />
        <div>
          <h3>{company.name}</h3>
          <p className="small muted">
            {job.location} · {job.arrangement} · {job.employment}
          </p>
        </div>
      </div>
      <div className="row wrap">
        <DevOnly>
          <Badge tone="purple">Fictional demo opportunity</Badge>
        </DevOnly>
        <span className="tag">{job.salary}</span>
      </div>
      <p className="small muted">{job.description}</p>
      <div>
        <h3>What you’ll work on</h3>
        <ul className="feed-job-list">
          {job.responsibilities.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3>What you’ll bring</h3>
        <p className="small muted" style={{ marginTop: 10 }}>
          {job.requirements}
        </p>
      </div>
      <Tags items={job.skills} />
      <CandidatePreferences values={job.wizardValues as Record<string, unknown> | undefined} />
      {job.benefits && (
        <div>
          <h3>Benefits & perks</h3>
          <p>{job.benefits}</p>
        </div>
      )}
      {job.applicationInstructions && (
        <div>
          <h3>Application instructions</h3>
          <p>{job.applicationInstructions}</p>
        </div>
      )}
      <DevOnly>
        <p className="notice">{application ? "Your demo application is saved in this browser. It has not been sent to this fictional company." : "Fictional role and salary. Applying saves a local demonstration; no real application is submitted."}</p>
      </DevOnly>
      <div className="modal-footer">
        <Button icon="bookmark" onClick={() => actions.toggleSave("professional", job.id, "job")}>
          {saved ? "Saved" : "Save job"}
        </Button>
        <Button variant="primary" icon="arrow" onClick={() => actions.apply(job.id)}>
          {application ? "View saved application" : devCopy("Apply in demo", "Apply")}
        </Button>
      </div>
    </div>
  );
}

function SavedApplication({ jobId }: { jobId: Id }) {
  const { data } = useServiceQuery(["job", jobId, "professional"], (s) => s.jobs.getJob(jobId, "professional"));
  if (!data?.application) return null;
  const a = data.application;
  return (
    <div className="stack">
      <h3>
        {data.job.title} · {data.company.name}
      </h3>
      <p className="small muted">
        {a.name} · {a.email}
      </p>
      <p className="small muted">{a.note || "No introduction added."}</p>
      <p className="notice">{devCopy("Saved locally " + formatLocaleDate(a.createdAt) + ". Nothing was sent to a real employer.", "Applied " + formatLocaleDate(a.createdAt) + ".")}</p>
      <LinkButton href="/app/applications" variant="primary" icon="briefcase">
        Track application
      </LinkButton>
      <Button onClick={() => modal.close()}>Close</Button>
    </div>
  );
}

function ApplyForm({ jobId }: { jobId: Id }) {
  const run = useServiceAction();
  const { data } = useServiceQuery(["job", jobId, "professional"], (s) => s.jobs.getJob(jobId, "professional"));
  const { data: profile } = useServiceQuery(["profile"], (s) => s.profile.getProfile());
  if (!data || !profile) return null;
  const { job, company } = data;
  const me = profile.person;
  return (
    <form
      id="feed-application-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const get = (k: string) => String(f.get(k) || "").trim();
        const answers = Object.fromEntries((job.screeningQuestions || []).map((q) => [q.id, get("screen-" + q.id)]));
        await run((s) =>
          s.jobs.apply({
            jobId,
            name: get("name"),
            email: get("email"),
            note: get("note"),
            portfolio: f.has("portfolio"),
            answers,
            recruitmentDetails: { location: get("appLocation"), locality: get("appLocality"), expectedSalaryLpa: get("appSalary"), noticeDays: get("appNotice"), joiningDays: get("appJoining"), industry: get("appIndustry"), designation: get("appDesignation"), department: get("appDepartment"), preferredLocations: get("appPreferred"), phone: get("appPhone") },
          }),
        );
        track("job_application_completed", { jobId, screeningQuestions: job.screeningQuestions?.length ?? 0 });
        modal.close();
        toast(devCopy("Demo application saved locally. Nothing was sent to an employer.", "Application submitted."));
      }}
    >
      <h3>
        {job.title} · {company.name}
      </h3>
      <TextField label="Name" name="name" defaultValue={me.name} required />
      <TextField label="Email" name="email" type="email" defaultValue={me.email} required />
      <TextAreaField label="A short introduction (optional)" name="note" maxLength={1500} />
      {(job.screeningQuestions || []).map((q) =>
        q.type === "yesno" ? (
          <SelectField
            key={q.id}
            label={q.text}
            name={"screen-" + q.id}
            required={q.required}
            defaultValue=""
            options={[
              { value: "", label: "Choose an answer" },
              { value: "Yes", label: "Yes" },
              { value: "No", label: "No" },
            ]}
          />
        ) : (
          <TextField key={q.id} label={q.text} name={"screen-" + q.id} type={q.type === "number" ? "number" : "text"} required={q.required} maxLength={1000} />
        ),
      )}
      {job.applicationInstructions && <p className="notice">{job.applicationInstructions}</p>}
      <details className="application-shared-details">
        <summary>Recruiting details for this application (optional)</summary>
        <p className="small muted">Only details entered here are shared with this application. Private profile salary, notice, phone, and address are not copied.</p>
        <div className="grid cols2">
          <TextField label="Location / city" name="appLocation" defaultValue={me.location} />
          <TextField label="Locality (optional)" name="appLocality" />
          <TextField label="Expected annual salary (INR LPA)" name="appSalary" type="number" min={0} step={0.1} />
          <TextField label="Notice period (days)" name="appNotice" type="number" min={0} max={365} />
          <TextField label="Available to join in (days)" name="appJoining" type="number" min={0} max={365} />
          <TextField label="Industry" name="appIndustry" />
          <TextField label="Designation" name="appDesignation" defaultValue={me.headline} />
          <TextField label="Department" name="appDepartment" defaultValue={me.category} />
          <TextField label="Preferred locations" name="appPreferred" />
          <TextField label="Phone for this application" name="appPhone" type="tel" />
        </div>
      </details>
      <label className="check-row">
        <input name="portfolio" type="checkbox" defaultChecked required={job.requirePortfolio} />
        {devCopy("Include my current portfolio in this demo application", "Include my current portfolio in this application")}
      </label>
      <DevOnly>
        <p className="notice">This fictional application is saved only in your browser. No CV, profile, or message is sent to an employer.</p>
      </DevOnly>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check">
          {devCopy("Save demo application", "Submit application")}
        </Button>
      </div>
    </form>
  );
}

/** Opening jobs, saving and applying — shared by the feed, job rail, applications and organization pages. */
export function useJobActions() {
  const run = useServiceAction();
  const services = useServices();
  const pathname = usePathname();
  const role: Role = pathname.startsWith("/recruiter/") ? "recruiter" : "professional";
  const view = async (id: Id, surface = "feed") => {
    await run((s) => s.jobs.markSeen(id));
    const data = await services.jobs.getJob(id, role);
    if (!data) return;
    track("job_viewed", { jobId: id, surface });
    modal.show(data.job.title, <JobDetails id={id} role={role} />);
  };
  const apply = async (id: Id) => {
    const data = await services.jobs.getJob(id, "professional");
    if (!data) return;
    if (data.application) {
      modal.show(devCopy("Your saved demo application", "Your application"), <SavedApplication jobId={id} />);
      return;
    }
    track("job_application_started", { jobId: id });
    modal.show("A first step toward your next chapter.", <ApplyForm jobId={id} />);
  };
  const toggleSave = async (saveRole: Role, id: Id, kind: "job" | "post" = "post") => {
    const result = await run((s) => s.feed.toggleSave(saveRole, id));
    if (!result) return;
    if (kind === "job") track("job_saved", { jobId: id, saved: result.saved });
    else track("post_saved", { postId: id, saved: result.saved });
    toast(!result.persisted ? "Saved for this page only. Browser storage is full or unavailable." : result.saved ? "Saved. Find it in your Saved feed." : "Removed from saved posts.");
  };
  return { view, apply, toggleSave, role };
}

