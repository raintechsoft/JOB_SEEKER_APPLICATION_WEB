"use client";

import { InfoBadge } from "@/components/ui/info-badge";

import { usePathname,useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {apiConfig} from "@/services/api/config";
import {ApiError,errorMessage} from "@/services/api/client";
import type {AuthSession} from "@/services/auth/auth.service";
import type {JobDetail} from "@/services/jobs/jobs.service";
import type {ProfileService} from "@/services/profile/profile.service";
import { useState } from "react";
import { applicationSchema } from "@/lib/validation/application";
import { validationFields } from "@/lib/validation/profile";
import { useFormAction } from "@/hooks/use-form-action";
import type { Id, Role } from "@/types/domain";
import { formatLocaleDate } from "@/lib/utils/date";
import { devCopy } from "@/lib/env/app-env";
import { isPrototype } from "@/lib/env/app-env";
import { track } from "@/lib/analytics";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Button, LinkButton } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { JobDetailsSideSheet } from "./job-details-sheet";
import {applicationWizardPath} from "@/lib/domain/application-wizard";
import {applicationWizardEnabled} from "@/features/applications/application-wizard-policy";

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
  const { data,isError } = useServiceQuery(["job", jobId, "professional"], (s) => s.jobs.getJob(jobId, "professional"));
  const { data: profile,isError:profileError } = useServiceQuery(["profile"], (s) => s.profile.getProfile());
  if(isError||profileError)return <p role="alert">The application could not be loaded. Check that your professional profile is ready and try again.</p>;
  if (!data || !profile) return null;
  return <ApplicationFields initialJob={data} initialProfile={profile}/>;
}

export function ApplicationFields({initialJob,initialProfile}:{initialJob:JobDetail;initialProfile:Awaited<ReturnType<ProfileService["getProfile"]>>}){
  const [data]=useState(initialJob),[profile]=useState(initialProfile);
  const [errors,setErrors]=useState<Record<string,string>>({});
  const {execute,pending}=useFormAction(setErrors);
  const {job,company}=data,jobId=job.id,me=profile.person;
  return (
    <form
      id="feed-application-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const get = (k: string) => String(f.get(k) || "").trim();
        const answers = Object.fromEntries((job.screeningQuestions || []).map((q) => [q.id, get("screen-" + q.id)]));
        const input = {
            jobId,
            name: get("name"),
            email: get("email"),
            note: get("note"),
            portfolio: f.has("portfolio"),
            answers,
            recruitmentDetails: { location: get("appLocation"), locality: get("appLocality"), expectedSalaryLpa: get("appSalary"), noticeDays: get("appNotice"), joiningDays: get("appJoining"), industry: get("appIndustry"), designation: get("appDesignation"), department: get("appDepartment"), preferredLocations: get("appPreferred"), phone: get("appPhone") },
        };
        const checked=applicationSchema(job.screeningQuestions??[],job.requirePortfolio??false).safeParse(input);
        if(!checked.success)return setErrors(validationFields(checked.error));
        setErrors({});
        if(!await execute((s)=>s.jobs.apply({...checked.data,questionsVersion:job.questionsVersion})))return;
        track("job_application_completed", { jobId, screeningQuestions: job.screeningQuestions?.length ?? 0 });
        modal.close();
        toast(devCopy("Demo application saved locally. Nothing was sent to an employer.", "Application submitted."));
      }}
    >
      <h3>
        {job.title} · {company.name}
      </h3>
      {errors._form && <p role="alert">{errors._form}</p>}
      <TextField label="Name" name="name" defaultValue={me.name} required error={errors.name} maxLength={150} />
      <TextField label="Email" name="email" type="email" defaultValue={me.email} required error={errors.email} maxLength={254} />
      <TextAreaField label="A short introduction" name="note" maxLength={1500} error={errors.note} />
      {(job.screeningQuestions || []).map((q) =>
        q.type === "yesno" ? (
          <SelectField
            key={q.id}
            label={q.text}
            name={"screen-" + q.id}
            error={errors["answers."+q.id]}
            required={q.required}
            defaultValue=""
            options={[
              { value: "", label: "Choose an answer" },
              { value: "Yes", label: "Yes" },
              { value: "No", label: "No" },
            ]}
          />
        ) : (
          <TextField key={q.id} label={q.text} name={"screen-" + q.id} error={errors["answers."+q.id]} type={q.type === "number" ? "number" : "text"} required={q.required} maxLength={1000} step={q.type === "number" ? "any" : undefined} />
        ),
      )}
      {job.applicationInstructions && <p className="notice">{job.applicationInstructions}</p>}
      {Object.entries(errors).filter(([key])=>key.startsWith("recruitmentDetails.")||key==="portfolio").map(([key,error])=><p key={key} role="alert">{key.replace("recruitmentDetails.","")}: {error}</p>)}
      <details className="application-shared-details">
        <summary>Recruiting details for this application</summary>
        <p className="small muted">Only details entered here are shared with this application. Private profile salary, notice, phone, and address are not copied.</p>
        <div className="grid cols2">
          <TextField label="Location / city" name="appLocation" defaultValue={me.location} />
          <TextField label="Locality" name="appLocality" />
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
        <input name="portfolio" type="checkbox" defaultChecked={isPrototype} required={job.requirePortfolio} />
        {devCopy("Include my current portfolio in this demo application", "Include my current portfolio in this application")}
        {job.requirePortfolio && <span aria-hidden="true">*</span>}
      </label>
      <DevOnly>
        <InfoBadge label="Application sharing information">This fictional application is saved only in your browser. No CV, profile, or message is sent to an employer.</InfoBadge>
      </DevOnly>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check" loading={pending} disabled={pending}>
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
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const role: Role = pathname.startsWith("/recruiter/") ? "recruiter" : "professional";
  const jobQueryKey = (id: Id, viewRole: Role = role) => ["job", id, viewRole] as const;
  const cachedJob = (id: Id) => queryClient.getQueryData<JobDetail>(jobQueryKey(id, "professional")) ?? queryClient.getQueryData<JobDetail>(jobQueryKey(id, role));
  const rememberJob = (id: Id, next: JobDetail | ((current: JobDetail) => JobDetail)) => {
    for (const viewRole of new Set<Role>(["professional", role])) {
      queryClient.setQueryData<JobDetail>(jobQueryKey(id, viewRole), (current) => {
        if (!current && typeof next !== "function") return next;
        if (!current) return current;
        return typeof next === "function" ? next(current) : next;
      });
    }
  };
  const apply = (id: Id) => {
    if (applicationWizardEnabled()) {
      try {
        const destination = applicationWizardPath(id, window.location.pathname + window.location.search);
        modal.close();
        router.push(destination);
      } catch { toast("This job is unavailable.", "error"); }
      return;
    }
    const session = queryClient.getQueryData<AuthSession>(["auth", "session"]);
    if (session && !session.user.email_verified) {
      router.push("/verify-email");
      return;
    }
    if (cachedJob(id)?.application) {
      modal.show(devCopy("Your saved demo application", "Your application"), <SavedApplication jobId={id} />);
      return;
    }
    track("job_application_started", { jobId: id });
    modal.show("A first step toward your next chapter.", <ApplyForm jobId={id} />);
    if (apiConfig.dataSource === "http" && !session) {
      void services.auth.me().then((fresh) => { if (!fresh.user.email_verified) router.push("/verify-email"); }).catch((error) => {
        if (error instanceof ApiError && error.status === 401) router.push("/login?next=" + encodeURIComponent("/jobs/" + id));
        else toast(errorMessage(error));
      });
    }
  };
  const toggleSave = async (saveRole: Role, id: Id, kind: "job" | "post" = "post") => {
    const previous = kind === "job" ? cachedJob(id) : undefined;
    if (previous) rememberJob(id, { ...previous, saved: !previous.saved });
    const result = await run((s) => kind === "job" && saveRole === "professional" && s.jobs.toggleSave ? s.jobs.toggleSave(id) : s.feed.toggleSave(saveRole, id), { refresh: false });
    if (!result) {
      if (previous) rememberJob(id, previous);
      return;
    }
    if (kind === "job") {
      rememberJob(id, (current) => ({ ...current, saved: result.saved }));
      track("job_saved", { jobId: id, saved: result.saved });
      void queryClient.invalidateQueries({ predicate: (query) => ["job", "feed", "feed-saved-count", "applications"].includes(String(query.queryKey[0])) });
    } else {
      track("post_saved", { postId: id, saved: result.saved });
      void queryClient.invalidateQueries({ predicate: (query) => ["feed", "feed-saved-count"].includes(String(query.queryKey[0])) });
    }
    toast(!result.persisted ? "Saved for this page only. Browser storage is full or unavailable." : result.saved ? (kind==="job"?"Job saved. Find it in your applications workspace.":"Saved. Find it in your Saved feed.") : kind==="job"?"Removed from saved jobs.":"Removed from saved posts.");
  };
  const view = (id: Id, surface = "feed") => {
    track("job_viewed", { jobId: id, surface });
    modal.show("Job details", <JobDetailsSideSheet id={id} role={role} onApply={() => apply(id)} onSave={() => void toggleSave("professional", id, "job")} />, "following");
    void queryClient.prefetchQuery({ queryKey: jobQueryKey(id), queryFn: () => services.jobs.getJob(id, role) });
    if (role === "professional") void queryClient.prefetchQuery({ queryKey: ["profile"], queryFn: () => services.profile.getProfile() });
    if (apiConfig.dataSource !== "http") void services.jobs.markSeen(id);
  };
  return { view, apply, toggleSave, role };
}

