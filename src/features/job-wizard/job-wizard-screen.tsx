"use client";

import { JOB_V2_RULES } from "@/lib/validation/job-v2";
import { jobEditorErrors } from "@/lib/domain/job-editor";
import { CompensationFields, DeadlineFields } from "./job-value-fields";
import { JobValueSummary } from "@/components/jobs/job-value-summary";
import { InfoBadge } from "@/components/ui/info-badge";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {useQueryClient} from "@tanstack/react-query";
import type { JobDraft, JobWizardValues } from "@/types/domain";
import type { JobDraftContext } from "@/services/job-posts/job-posts.service";
import { formatSalary, JOB_THUMBNAIL_TEMPLATES } from "@/lib/domain/jobs";
import { draftJobFromBrief, type JobBrief } from "@/lib/domain/job-draft-generator";
import { today } from "@/lib/utils/date";
import { IMAGE_TYPES, MB, readAsDataUrl } from "@/lib/utils/files";
import { uid } from "@/lib/utils/id";
import { useServiceQuery, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Icon } from "@/components/ui/icon";
import { Button, EmptyState, IconButton, LinkButton } from "@/components/ui/primitives";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { ScreenFallback } from "@/components/ui/feedback";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { isPrototype } from "@/lib/env/app-env";
import { validateJobFiles } from "@/lib/validation/job";
import { errorMessage, fieldErrors } from "@/services/api/client";
import { useFormAction } from "@/hooks/use-form-action";
import { JobArtwork, JobMediaExtras, type JobVisualData } from "@/components/jobs/job-visuals";

const STEPS = ["Job details", "Preferred candidate details", "Job description", "Screening questions", "Advanced options", "Media & thumbnail", "Review & publish"];
const DEPARTMENTS = ["Design", "Engineering", "Product", "Data & analytics", "Sales & retail", "Marketing", "Operations", "Human resources", "Finance", "Other"];
const EDUCATION = JOB_V2_RULES.education;
type Errors = Record<string, string>;
type ChipKey = "locations" | "skills" | "education" | "industries";

function validate(step: number, v: JobWizardValues): Errors {
  if (v.schemaVersion===2 || !isPrototype) return jobEditorErrors(v, step);
  const e: Errors = {};
  if (step === 0) {
    for (const [key, label] of [
      ["companyName", "Company name"],
      ["title", "Job title"],
      ["department", "Department"],
      ["role", "Role"],
    ] as const)
      if (!String(v[key] || "").trim()) e[key] = label + " is required.";
    if (v.experienceMin === "" || v.experienceMax === "" || Number(v.experienceMin) < 0 || Number(v.experienceMax) > 50 || Number(v.experienceMin) > Number(v.experienceMax)) e.experience = "Choose a valid experience range (0–50 years).";
    if (v.salaryMin === "" || v.salaryMax === "" || Number(v.salaryMin) < 0 || Number(v.salaryMin) > Number(v.salaryMax)) e.salary = "Maximum salary must be at least the minimum salary.";
    if (v.variableEnabled && (Number(v.variablePercent) < 0 || Number(v.variablePercent) > 100)) e.salary = "Variable pay must be between 0 and 100%.";
    if (!v.locations.length) e.locations = "Add at least one job location.";
    if (Number(v.vacancies) < 1 || Number(v.vacancies) > 999) e.vacancies = "Enter between 1 and 999 vacancies.";
  }
  if (step === 1) {
    if (!v.skills.length) e.skills = "Add at least one skill.";
    if (!v.education.length) e.education = "Add at least one educational qualification.";
  }
  if (step === 2) for (const key of ["description", "responsibilities", "requirements"] as const) if (!v[key].trim()) e[key] = "Complete all required description fields.";
  if (step === 3 && v.questions.some((q) => !q.text.trim())) e.questions = "Add text to each question or remove empty questions.";
  if (step === 4) {
    if (!/^\S+@\S+\.\S+$/.test(v.contactEmail)) e.contactEmail = "Enter a valid recruiter email.";
    if (v.expiresAt && v.expiresAt < today()) e.expiresAt = "Closing date must be today or later.";
  }
  if (step === 5) {
    if (v.thumbnail.image && !v.thumbnail.alt.trim()) e.imageAlt = "Add a description for your uploaded thumbnail.";
    if (v.jobMedia.video) {
      try {
        const u = new URL(v.jobMedia.video);
        if (!["http:", "https:"].includes(u.protocol) || !/\.(mp4|webm)$/i.test(u.pathname)) e.video = "Use a direct HTTP or HTTPS MP4 or WebM video link.";
      } catch {
        e.video = "Use a valid video URL.";
      }
    }
  }
  return e;
}

const visual = (v: JobWizardValues): JobVisualData => ({ title: v.title || "Your next chapter starts here.", companyName: v.hideCompany ? "Confidential company" : v.companyName, location: v.locations.join(" · "), arrangement: v.arrangement, thumbnail: v.thumbnail, jobMedia: v.jobMedia });

function AiForm({ values, replace, onGenerate }: { values: JobWizardValues; replace: boolean; onGenerate: (brief: JobBrief) => Promise<boolean> }) {
  const [error, setError] = useState("");
  const [busy,setBusy]=useState(false);
  const [currency, setCurrency] = useState(values.currency);
  return (
    <form
      id="wizard-ai-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if(busy)return;
        const f = new FormData(e.currentTarget);
        const t = (n: string) => String(f.get(n) || "").trim();
        const brief = { role: t("role"), location: t("location"), arrangement: t("arrangement"), employment: t("employment"), currency: t("currency") as JobBrief["currency"], skills: t("skills"), hideSalary: values.compensation?.hidden??values.hideSalary, ...(values.compensation?{compensation:values.compensation}:{}), experienceMin: t("experienceMin"), experienceMax: t("experienceMax"), salaryMin: t("salaryMin"), salaryMax: t("salaryMax") };
        let message = "";
        if (!brief.role || brief.role.length > 100 || !brief.location || brief.location.length > 250) message = "Add a role name and job location.";
        else if ((values.schemaVersion===2 ? ["experienceMin"] as const : ["experienceMin", "experienceMax", "salaryMin", "salaryMax"] as const).some((k) => brief[k] === "" || !Number.isFinite(Number(brief[k])))) message = "Enter valid numbers for experience and salary.";
        else if (Number(brief.experienceMin) < 0 || Number(brief.experienceMax) > 50 || (brief.experienceMax!==""&&Number(brief.experienceMin) > Number(brief.experienceMax))) message = "Choose an experience range from 0 to 50 years, with the maximum at least the minimum.";
        else if (values.schemaVersion!==2 && (Number(brief.salaryMin) < 0 || Number(brief.salaryMin) > Number(brief.salaryMax))) message = "Maximum salary must be at least the minimum salary.";
        else if (!["INR", "USD", "EUR", "GBP"].includes(brief.currency) || !["On-site", "Hybrid", "Remote"].includes(brief.arrangement) || !JOB_V2_RULES.employment.includes(brief.employment)) message = "Choose valid salary and work options.";
        else if (replace && !f.has("replace")) message = "Confirm replacing the job content in this draft to continue.";
        if (message) return setError(message);
        setBusy(true);try{if(!await onGenerate(brief))setError("The draft could not be saved. Keep this form open to retry, or close it to correct the highlighted job details.");}finally{setBusy(false);}
      }}
    >
      <p className="job-ai-intro">Give us the essentials. We’ll prepare the job text, suggested skills, and screening questions for your final review.</p>
      <span className="job-ai-demo-label">{devCopy("Demo generator · Role-based templates", "Template helper · Review every suggestion")}</span>
      <TextField label="Role name" name="role" defaultValue={values.role || values.title} required maxLength={100} />
      <div className="grid cols2">
        <TextField label="Minimum experience (years)" name="experienceMin" type="number" defaultValue={String(values.experienceMin)} required min={0} max={50} step={1} />
        <TextField label="Maximum experience (years)" name="experienceMax" type="number" defaultValue={String(values.experienceMax)} required={values.schemaVersion!==2} min={0} max={50} step={1} />
      </div>
      {values.schemaVersion!==2&&<>
      <SelectField required label="Salary currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as JobWizardValues["currency"])} options={["INR", "USD", "EUR", "GBP"]} />
      <div className="grid cols2">
        <TextField label="Minimum annual salary" name="salaryMin" type="number" defaultValue={values.salaryMin} required min={0} step={0.1} />
        <TextField label="Maximum annual salary" name="salaryMax" type="number" defaultValue={values.salaryMax} required min={0} step={0.1} />
      </div>
      <p className="job-ai-salary-help" id="job-ai-salary-unit">
        {currency === "INR" ? "INR amounts are in lakhs per year (LPA)." : "Amounts are annual salaries in " + currency + "."}
      </p>
      </>}
      {values.compensation&&<JobValueSummary compensation={values.compensation}/>}
      <TextField label="Job location" name="location" defaultValue={values.locations.join("; ")} required maxLength={250} />
      <details className="job-ai-options">
        <summary>
          More options <span>Work mode, employment & skills</span>
        </summary>
        <div className="job-ai-options-fields">
          <div className="grid cols2">
            <SelectField required label="Work mode" name="arrangement" defaultValue={values.arrangement} options={["On-site", "Hybrid", "Remote"]} />
            <SelectField required label="Employment type" name="employment" defaultValue={values.employment} options={JOB_V2_RULES.employment} />
          </div>
          <TextField label="Key skills (comma separated)" name="skills" maxLength={400} />
        </div>
      </details>
      <p className="small muted">Your role, experience, and salary limits are kept exactly as entered. Location and work mode are used in the draft. You can edit or remove every suggestion.</p>
      {replace && (
        <label className="wizard-check">
          <input type="checkbox" name="replace" required />
          Replace this draft’s job text, skills, and screening questions. Keep existing media and posting settings. <span aria-hidden="true">*</span>
        </label>
      )}
      <div id="job-ai-error" role="alert">
        {error}
      </div>
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="spark" loading={busy} disabled={busy}>
          Generate draft
        </Button>
      </div>
    </form>
  );
}

export function Wizard({ ctx }: { ctx: JobDraftContext }) {
  const services = useServices();
  const cache=useQueryClient();
  const router = useRouter();
  const [d, setD] = useState<JobDraft>(ctx.draft);
  const latestDraft = useRef(d);
  useEffect(() => { latestDraft.current = d; }, [d]);
  const [errors, setErrors] = useState<Errors>({});
  const { execute, pending } = useFormAction(setErrors);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [moving,setMoving]=useState(false);
  const [savedNote, setSavedNote] = useState(ctx.draft.savedAt ? devCopy("Progress saved in this browser", "Progress saved") : "Your progress is saved as you work.");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const navigationLock = useRef(false);
  const v = d.values;

  useEffect(()=>{if(!isPrototype&&!new URLSearchParams(window.location.search).has("id"))router.replace("/recruiter/jobs/new?id="+encodeURIComponent(ctx.draft.id));},[ctx.draft.id,router]);

  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="step"]');
    if (nav && current && matchMedia("(max-width:680px)").matches) nav.scrollLeft = current.offsetLeft - nav.offsetLeft - (nav.clientWidth - current.clientWidth) / 2;
  }, [d.step]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const store = async (next: JobDraft) => {
    if (next.values.schemaVersion===2 || !isPrototype) { const invalid=jobEditorErrors(next.values,"draft"); if(Object.keys(invalid).length){setErrors(invalid);setSavedNote("Unsaved changes. Check the entered values.");return false;} }
    try {
      const ok = await services.jobPosts.storeJobDraft(ctx.key, next);
      if (ok) setSavedNote(devCopy("Progress saved in this browser", "Progress saved"));
      return ok;
    } catch (error) {
      setErrors({ ...Object.fromEntries(Object.entries(fieldErrors(error)).map(([key, messages]) => [key.replace(/^values\./, ""), messages[0]])), _form: errorMessage(error) });
      setSavedNote("Changes have not been saved. Keep this page open and retry.");
      return false;
    }
  };
  /** Updates values; any edit invalidates a generated draft's verification, as in the prototype. */
  const set = (patch: Partial<JobWizardValues>, opts: { debounce?: boolean; keepVerification?: boolean } = {}) => {
    const current = latestDraft.current;
    const next = { ...current, values: { ...current.values, ...patch, ...(current.generated && !opts.keepVerification && !("aiVerified" in patch) ? { aiVerified: false } : {}) } };
    latestDraft.current = next;
    setD(next);
    setSavedNote("Saving your changes…");
    if (timer.current) clearTimeout(timer.current);
    if (opts.debounce) timer.current = setTimeout(() => void store(next), 700);
    else void store(next);
  };
  const move = async (step: number) => {
    if (navigationLock.current || pending || uploadBusy) return;
    if (step > d.step) {
      const e = Object.assign({}, ...Array.from({ length: step }, (_, index) => validate(index, v)));
      setErrors(e);
      if (Object.keys(e).length) return requestAnimationFrame(() => document.querySelector(".wizard-errors")?.scrollIntoView({ block: "center" }));
    } else setErrors({});
    const next = { ...d, step, reached: Math.max(d.reached, step), values: d.generated && step < 6 ? { ...v, aiVerified: false } : v };
    if (timer.current) clearTimeout(timer.current);
    navigationLock.current = true;
    setMoving(true);
    const ok = await store(next);
    navigationLock.current = false;
    setMoving(false);
    if (!ok) return;
    setD(next);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => titleRef.current?.focus());
  };
  const addChip = (name: ChipKey, value: string) => {
    value = String(value || "").trim();
    const items = name === "locations" ? [value] : value.split(",").map((x) => x.trim()).filter(Boolean);
    const list = [...v[name]];
    for (const item of items) if (item && !list.includes(item) && list.length < 20) list.push(item);
    set({ [name]: list });
  };
  const removeChip = (name: ChipKey, i: number) => {
    const list = [...v[name]];
    const [removed] = list.splice(i, 1);
    set({ [name]: list, ...(name === "skills" ? { essentialSkills: v.essentialSkills.filter((s) => s !== removed) } : {}) });
  };

  const upload = async (files: File[], thumbnail: boolean) => {
    if (!files.length) return;
    const invalid = validateJobFiles(files, v.jobMedia.files, thumbnail);
    if (invalid) return toast(invalid);
    const allowed = thumbnail ? IMAGE_TYPES : [...IMAGE_TYPES, "application/pdf", "video/mp4", "video/webm"];
    if (isPrototype && files.some((f) => !allowed.includes(f.type) || f.size > MB)) return toast("Choose supported files up to 1 MB each.");
    if (isPrototype && !thumbnail && (v.jobMedia.files.length + files.length > 3 || v.jobMedia.files.reduce((n, f) => n + f.size, 0) + files.reduce((n, f) => n + f.size, 0) > 1.5 * MB)) return toast("Use up to three supporting files, totaling 1.5 MB or less.");
    setUploadBusy(true);
    try {
      const added = await Promise.all(files.map(async (f) => {
        if (isPrototype) return { id: uid(), name: f.name, type: f.type, size: f.size, data: await readAsDataUrl(f) };
        const asset = await services.media.upload(f, thumbnail ? "job_thumbnail" : "job_attachment", ctx.companyId, {manual:true});
        return { id: asset.id, name: f.name, type: f.type, size: f.size, data: asset.url };
      }));
      const current = latestDraft.current.values;
      if (thumbnail) set({ thumbnail: { ...current.thumbnail, image: added[0].data, alt: current.thumbnail.alt || current.title + " hiring announcement" } });
      else set({ jobMedia: { ...current.jobMedia, files: [...current.jobMedia.files, ...added] } });
    } catch {
      toast("That file could not be read. Please try again.");
    } finally {
      setUploadBusy(false);
    }
  };

  const generate = async (brief: JobBrief) => {
    const changes = draftJobFromBrief(brief);
    if(v.schemaVersion===2){ for(const key of ["currency","salaryMin","salaryMax","hideSalary","variableEnabled","variablePercent"] as const) delete (changes as Partial<JobWizardValues>)[key]; }
    const values = { ...changes, questions: changes.questions.map((q) => ({ ...q, id: uid() })), aiVerified: false };
    const previousValues = Object.fromEntries(Object.keys(values).map((k) => [k, structuredClone(v[k as keyof JobWizardValues] ?? (k === "aiVerified" ? false : ""))])) as Partial<JobWizardValues>;
    const next: JobDraft = { ...d, aiPrevious: { values: previousValues, step: d.step, reached: d.reached, generated: d.generated || false }, values: { ...v, ...values }, generated: { mode: "template-demo", role: brief.role, at: new Date().toISOString() }, step: 6, reached: 6 };
    if (!isPrototype) { const invalid = jobEditorErrors(next.values, "publish"); if (Object.keys(invalid).length) { setErrors(invalid); return false; } }
    if (timer.current) clearTimeout(timer.current);
    if (!await store(next)) return false;
    setD(next);
    setErrors({});
    modal.close();
    window.scrollTo(0, 0);
    toast(devCopy("Demo draft ready. Review, edit, and verify before publishing.", "Draft ready. Review, edit, and verify before publishing."));
    return true;
  };

  const submit = async () => {
    if (pending || navigationLock.current) return;
    if (uploadBusy) return toast("Wait for the media upload to finish.");
    const e = validate(d.step, v);
    setErrors(e);
    if (Object.keys(e).length) return requestAnimationFrame(() => document.querySelector(".wizard-errors")?.scrollIntoView({ block: "center" }));
    if (d.step < 6) return move(d.step + 1);
    if (d.generated && !v.aiVerified) return setErrors({ verification: "Verify the generated job details before publishing." });
    for (let i = 0; i < 6; i++) {
      const stepErrors = validate(i, v);
      if (Object.keys(stepErrors).length) {
        setErrors(stepErrors);
        const next = { ...d, step: i };
        setD(next);
        void store(next);
        return toast("Complete the highlighted details before publishing.");
      }
    }
    if (timer.current) clearTimeout(timer.current);
    if (!await execute((s) => s.jobPosts.publishJob(ctx.key, d),{invalidate:["jobs-manager","responses","jobs","job","feed","hiring-summary"]})) return;
    cache.removeQueries({queryKey:["job-draft"]});
    router.push("/recruiter/applications");
    toast(devCopy("Your job is published in the local demo feed.", "Your job is published."));
  };

  const saveAndExit = async () => {
    if (pending || navigationLock.current) return;
    if (uploadBusy) return toast("Wait for the media upload to finish.");
    if (!v.title.trim()) {
      toast("Add a job title before saving a draft.");
      return document.querySelector<HTMLElement>("[name=title]")?.focus();
    }
    const invalid = isPrototype && v.schemaVersion!==2 ? {} : jobEditorErrors(v, "draft");
    if (Object.keys(invalid).length) return setErrors(invalid);
    if (timer.current) clearTimeout(timer.current);
    if (!await execute(async (s) => (await s.jobPosts.saveJobAsDraft(ctx.key, d)).ok,{invalidate:["jobs-manager"]})) return;
    if (ctx.editingPublished) {
      router.push("/recruiter/applications");
      return toast("Changes saved privately. Publish changes to update the visible job.");
    }
    router.push("/recruiter/applications?tab=drafts");
    toast("Draft saved. Continue from the same stage when you edit it.");
  };

  const chips = (name: ChipKey, { stars = false, suggestions = [] as string[] } = {}) => (
    <>
      <div className="wizard-chip-box" aria-label={name}>
        {v[name].map((value, i) => (
          <span className="wizard-chip" key={value}>
            {stars && (
              <button type="button" className={v.essentialSkills.includes(value) ? "is-essential" : ""} aria-pressed={v.essentialSkills.includes(value)} aria-label={(v.essentialSkills.includes(value) ? "Unmark " : "Mark ") + value + " as essential"} onClick={() => set({ essentialSkills: v.essentialSkills.includes(value) ? v.essentialSkills.filter((s) => s !== value) : [...v.essentialSkills, value] })}>
                <Icon name="star" />
              </button>
            )}
            <span>{value}</span>
            <IconButton icon="close" label={"Remove " + value} onClick={() => removeChip(name, i)} />
          </span>
        ))}
        <div className="wizard-add-chip">
          <label className="sr-only" htmlFor={"wizard-add-" + name}>
            Add {name}
          </label>
          <input
            id={"wizard-add-" + name}
            placeholder={name === "locations" ? "Add a location" : "Add " + name}
            maxLength={100}
            data-no-floating-label
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              addChip(name, e.currentTarget.value);
              e.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            className="btn text sm"
            onClick={() => {
              const el = document.getElementById("wizard-add-" + name) as HTMLInputElement | null;
              if (el) {
                addChip(name, el.value);
                el.value = "";
              }
            }}
          >
            <Icon name="plus" />
            Add
          </button>
        </div>
      </div>
      {suggestions.length > 0 && (
        <div className="wizard-suggestions">
          <span>Suggestions</span>
          {suggestions
            .filter((s) => !v[name].includes(s))
            .map((s) => (
              <button type="button" key={s} onClick={() => addChip(name, s)}>
                <Icon name="plus" />
                {s}
              </button>
            ))}
        </div>
      )}
    </>
  );
  const err = (name: string) => (errors[name] ? <p className="wizard-error" role="alert">{errors[name]}</p> : null);
  const input = (label: string, name: keyof JobWizardValues, props: Record<string, unknown> = {}) => <TextField label={label} name={name} error={errors[name]} value={String(v[name] ?? "")} onChange={(e) => set({ [name]: e.target.value } as Partial<JobWizardValues>, { debounce: true })} {...props} />;
  const area = (label: string, name: keyof JobWizardValues, props: Record<string, unknown> = {}) => <TextAreaField label={label} name={name} error={errors[name]} value={String(v[name] ?? "")} onChange={(e) => set({ [name]: e.target.value } as Partial<JobWizardValues>, { debounce: true })} {...props} />;
  const dropdown = (label: string, name: keyof JobWizardValues, options: string[], props: Record<string, unknown> = {}) => <SelectField label={label} name={name} error={errors[name]} value={String(v[name] ?? "")} onChange={(e) => set({ [name]: e.target.value } as Partial<JobWizardValues>)} options={options} {...props} />;
  const check = (label: string, name: keyof JobWizardValues) => (
    <label className="wizard-check">
      <input type="checkbox" name={name} checked={!!v[name]} onChange={(e) => set({ [name]: e.target.checked } as Partial<JobWizardValues>)} />
      {label}
    </label>
  );

  const reviewSection = (title: string, step: number, body: ReactNode, editLabel = "Edit") => (
    <section className="wizard-review-section" key={title}>
      <div className="row between">
        <h2>{title}</h2>
        <Button variant="text sm" icon="edit" onClick={() => move(step)}>
          {editLabel}
        </Button>
      </div>
      {body}
    </section>
  );

  const compareValue=(key:keyof JobWizardValues,values:Partial<JobWizardValues>)=>{
    const value=values[key];
    if(key==="questions")return (values.questions??[]).map((q)=><p key={q.id}>{q.text} · {q.type} · {q.required?"Required":"Optional"}{q.ideal?" · Ideal: "+q.ideal:""}</p>);
    if(key==="thumbnail")return <>{values.thumbnail?.image&&<Image src={values.thumbnail.image} alt={values.thumbnail.alt} width={160} height={100} unoptimized style={{maxWidth:160,height:"auto"}}/>}<p>{values.thumbnail?.headline||values.thumbnail?.alt||JOB_THUMBNAIL_TEMPLATES.find((t)=>t.id===values.thumbnail?.template)?.name||"No thumbnail"}</p></>;
    if(key==="jobMedia")return <>{values.jobMedia?.video&&<p>{values.jobMedia.video}</p>}{values.jobMedia?.files.map((file)=><p key={file.id}>{file.name}</p>)}</>;
    if(Array.isArray(value))return value.join(", ")||"Not set";
    if(typeof value==="boolean")return value?"Yes":"No";
    if(value && typeof value==="object")return JSON.stringify(value);
    return String(value??"")||"Not set";
  };

  const stages: (() => ReactNode)[] = [
    () => (
      <>
        <div className="wizard-section">
          <h2>The opportunity</h2>
          <div className="grid cols2">
            {input("Company you’re hiring for", "companyName", { required: true, maxLength: 100 })}
            {input("Job title", "title", { required: true, maxLength: 120 })}
          </div>
          {check("Hide company information from candidates", "hideCompany")}
          <p className="wizard-help">{v.hideCompany ? "Your public job will show “Confidential company”." : "This post belongs to your current company account."}</p>
          <div className="grid cols2">
            {dropdown("Department", "department", DEPARTMENTS, { required: true })}
            {input("Role", "role", { required: true, maxLength: 100 })}
            {dropdown("Employment type", "employment", JOB_V2_RULES.employment, { required: true })}
          </div>
        </div>
        <div className="wizard-section">
          <h2>Experience & compensation</h2>
          <div className="grid cols2">
            {input("Minimum experience (years)", "experienceMin", { type: "number", required: true, min: 0, max: 50, step: 1 })}
            {input("Maximum experience (years)", "experienceMax", { type: "number", required: v.schemaVersion!==2, min: 0, max: 50, step: 1 })}
          </div>
          {err("experience")}
          {v.compensation ? <CompensationFields value={v.compensation} onChange={compensation=>set({compensation},{debounce:true})} errors={errors}/> : <>
          <div className="wizard-salary-row">
            {dropdown("Currency", "currency", ["INR", "USD", "EUR", "GBP"], { required: true })}
            {input(v.currency === "INR" ? "Minimum annual salary (LPA)" : "Minimum annual salary", "salaryMin", { type: "number", required: true, min: 0, step: 0.1 })}
            {input(v.currency === "INR" ? "Maximum annual salary (LPA)" : "Maximum annual salary", "salaryMax", { type: "number", required: true, min: 0, step: 0.1 })}
          </div>
          {err("salary")}
          <Button variant="text sm" icon={v.variableEnabled ? "close" : "plus"} onClick={() => set({ variableEnabled: !v.variableEnabled })}>
            {v.variableEnabled ? "Remove variable component" : "Add variable component"}
          </Button>
          {v.variableEnabled && input("Variable component (%)", "variablePercent", { type: "number", required: true, min: 0, max: 100, step: 0.1 })}
          {check("Hide salary details from candidates", "hideSalary")}
          </>}
        </div>
        <div className="wizard-section">
          <h2>Where & how you’ll work</h2>
          <fieldset className="wizard-mode">
            <legend>Work mode <span aria-hidden="true">*</span></legend>
            {["On-site", "Hybrid", "Remote"].map((mode) => (
              <label key={mode}>
                <input type="radio" name="arrangement" value={mode} checked={v.arrangement === mode} onChange={() => set({ arrangement: mode })} />
                {mode}
              </label>
            ))}
          </fieldset>
          <h3>
            Job locations <span aria-hidden="true">*</span>
          </h3>
          {chips("locations", { suggestions: ["Bengaluru, India", "Mumbai, India", "Remote, India"] })}
          {err("locations")}
          {check("Include candidates ready to relocate to these locations", "relocate")}
          {v.schemaVersion===2 ? <><TextField label="Number of vacancies" name="vacancies" type="number" min={1} max={1000000} value={v.vacancies} error={errors.vacancies} onChange={e=>set({vacancies:e.target.value},{debounce:true})}/><p className="small muted">Leave blank when the count is unknown.</p></> : <div className="wizard-vacancies">
            {input("Number of vacancies", "vacancies", {type:"number",required:true,min:1,max:999})}
          </div>}
        </div>
      </>
    ),
    () => {
      const suggestions = v.department === "Engineering" ? ["React", "TypeScript", "JavaScript", "Accessibility"] : v.department === "Sales & retail" ? ["Retail operations", "Visual merchandising", "Sales", "Customer service"] : ["Product design", "Figma", "UX research", "Communication"];
      return (
        <>
          <div className="wizard-section">
            <h2>Skills that matter <span aria-hidden="true">*</span></h2>
            <p className="wizard-help">Add skills, then use the star to mark the essentials. Add at least one skill.</p>
            {chips("skills", { stars: true, suggestions })}
            {err("skills")}
          </div>
          <div className="wizard-section">
            <h2>Educational qualification <span aria-hidden="true">*</span></h2>
            {chips("education", { suggestions: EDUCATION })}
            {err("education")}
          </div>
          <div className="wizard-section">
            <h2>
              Preferred industries
            </h2>
            <p className="wizard-help">Add industries relevant to the role.</p>
            {chips("industries", { suggestions: ["Software & technology", "Retail", "Financial services", "Design services"] })}
          </div>
        </>
      );
    },
    () => (
      <div className="wizard-section">
        <h2>Tell candidates about the role</h2>
        {area("Job description", "description", { required: true, maxLength: 5000 })}
        {area("Responsibilities (one per line)", "responsibilities", { required: true, maxLength: 3000 })}
        {area("Requirements", "requirements", { required: true, maxLength: 3000 })}
        {area("Benefits & perks", "benefits", { maxLength: 2000 })}
        <p className="wizard-help">Describe the work clearly, include the essentials, and help candidates understand your team.</p>
      </div>
    ),
    () => (
      <div className="wizard-section">
        <h2>A few useful questions</h2>
        <p className="wizard-help">Add up to six questions. Candidates answer these when they apply. Ideal answers are notes for your review and do not automatically reject anyone.</p>
        {v.questions.length ? (
          v.questions.map((q, i) => {
            const patch = (p: Partial<typeof q>) => set({ questions: v.questions.map((x, n) => (n === i ? { ...x, ...p } : x)) }, { debounce: true });
            return (
              <section className="wizard-question" key={q.id}>
                <div className="row between">
                  <h3>Question {i + 1}</h3>
                  <IconButton icon="trash" label={"Remove question " + (i + 1)} onClick={() => set({ questions: v.questions.filter((_, n) => n !== i) })} />
                </div>
                <TextField label="Question" name={"qtext-" + i} value={q.text} onChange={(e) => patch({ text: e.target.value })} required maxLength={240} />
                <SelectField required
                  label="Answer format"
                  name={"qtype-" + i}
                  value={q.type}
                  onChange={(e) => patch({ type: e.target.value as typeof q.type })}
                  options={[
                    { value: "text", label: "Short text" },
                    { value: "yesno", label: "Yes / No" },
                    { value: "number", label: "Number" },
                  ]}
                />
                <label className="wizard-check">
                  <input type="checkbox" checked={q.required} onChange={(e) => patch({ required: e.target.checked })} />
                  Answer is required
                </label>
                <TextField label="Ideal answer (for recruiters only)" name={"qideal-" + i} value={q.ideal || ""} onChange={(e) => patch({ ideal: e.target.value })} maxLength={200} />
              </section>
            );
          })
        ) : (
          <div className="wizard-empty-inline">No screening questions yet. You can continue without any.</div>
        )}
        {v.questions.length < 6 && (
          <Button icon="plus" onClick={() => set({ questions: [...v.questions, { id: uid(), text: "", type: "text", required: true, ideal: "" }] })}>
            Add a question
          </Button>
        )}
        {err("questions")}
      </div>
    ),
    () => (
      <div className="wizard-section">
        <h2>Posting preferences</h2>
        {v.schemaVersion===2&&<DeadlineFields value={v.deadline??null} onChange={deadline=>set({deadline,expiresAt:deadline?.date??""},{debounce:true})} errors={errors}/>}
        <div className="grid cols2">
          {v.schemaVersion!==2 && input("Closing date", "expiresAt", { type: "date", min: today() })}
          {input("Reference code", "reference", { maxLength: 40 })}
          {input("Recruiter email", "contactEmail", { type: "email", required: true, maxLength: 150 })}
        </div>
        <p className="wizard-help">Recruiter contact details are kept out of the public feed.</p>
        {check("Require candidates to include their portfolio", "requirePortfolio")}
        {check(devCopy("Keep response notifications enabled in this demo", "Keep response notifications enabled"), "notifyResponses")}
        {area("Application instructions", "applicationInstructions", { maxLength: 1500 })}
        <DevOnly>
          <InfoBadge label="Publishing information">Applications and notification preferences are simulated in this browser. No emails are sent.</InfoBadge>
        </DevOnly>
      </div>
    ),
    () => (
      <>
        <div className="wizard-section">
          <h2>Make the opportunity stand out</h2>
          <p className="wizard-help">Choose a thumbnail template or upload your own. This is the visual candidates will see in the feed.</p>
          <div className="wizard-template-grid">
            {JOB_THUMBNAIL_TEMPLATES.map((t) => {
              const active = !v.thumbnail.image && v.thumbnail.template === t.id;
              return (
                <button type="button" key={t.id} className={"wizard-template" + (active ? " active" : "")} aria-pressed={active} onClick={() => set({ thumbnail: { ...v.thumbnail, template: t.id, image: "" } })}>
                  <span className="wizard-template-art">
                    <JobArtwork job={{ ...visual(v), thumbnail: { template: t.id, image: "", alt: "", headline: "" } }} />
                  </span>
                  <strong>{t.name}</strong>
                  <span>{t.description}</span>
                </button>
              );
            })}
          </div>
          <div className="row gap8 wrap">
            <Button variant="sm" icon={v.thumbnail.template === "none" ? "check" : "close"} onClick={() => set({ thumbnail: { ...v.thumbnail, template: "none", image: "" } })}>
              No thumbnail
            </Button>
            <label className="btn wizard-upload-button">
              <Icon name="upload" />
              Upload thumbnail
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  void upload([...(e.target.files || [])], true);
                  e.target.value = "";
                }}
              />
            </label>
            {v.thumbnail.image && (
              <Button variant="text sm" icon="trash" onClick={() => set({ thumbnail: { ...v.thumbnail, image: "" } })}>
                Remove uploaded thumbnail
              </Button>
            )}
          </div>
          <p className="wizard-help">PNG, JPEG, or WebP. A landscape image works best.</p>
          <TextField label="Thumbnail headline" name="thumbnailHeadline" value={v.thumbnail.headline} onChange={(e) => set({ thumbnail: { ...v.thumbnail, headline: e.target.value } }, { debounce: true })} maxLength={100} />
          <TextField label="Image description" name="imageAlt" value={v.thumbnail.alt} onChange={(e) => set({ thumbnail: { ...v.thumbnail, alt: e.target.value } }, { debounce: true })} required={!!v.thumbnail.image} maxLength={220} />
          <div className="wizard-media-preview" aria-label="Thumbnail preview">
            {v.thumbnail.template === "none" && !v.thumbnail.image ? <div className="wizard-empty-inline">No thumbnail selected.</div> : <JobArtwork job={visual(v)} />}
          </div>
        </div>
        <div className="wizard-section">
          <h2>
            Supporting media
          </h2>
          <TextField label="Video URL (direct MP4 or WebM)" name="video" type="url" value={v.jobMedia.video} onChange={(e) => set({ jobMedia: { ...v.jobMedia, video: e.target.value } }, { debounce: true })} placeholder="https://example.com/team.mp4" />
          {err("video")}
          <label className="btn wizard-upload-button">
            <Icon name="file" />
            Add supporting media
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf,video/mp4,video/webm"
              hidden
              multiple
              onChange={(e) => {
                void upload([...(e.target.files || [])], false);
                e.target.value = "";
              }}
            />
          </label>
          <p className="wizard-help">Images, PDFs, MP4, or WebM. Up to three files within your upload allowance.{devCopy(" Files stay in this browser.", "")}</p>
          <div className="wizard-supporting-files">
            {v.jobMedia.files.map((f, i) => (
              <div key={f.id}>
                <Icon name={f.type.startsWith("image/") ? "image" : "file"} />
                <span>
                  {f.name} <small>{Math.ceil(f.size / 1024)} KB</small>
                </span>
                <IconButton icon="trash" label={"Remove " + f.name} onClick={() => set({ jobMedia: { ...v.jobMedia, files: v.jobMedia.files.filter((_, n) => n !== i) } })} />
              </div>
            ))}
          </div>
        </div>
      </>
    ),
    () => {
      const details = `${v.title} · ${v.role}\n${v.hideCompany ? "Confidential company" : v.companyName}\n${v.locations.join(" · ")} · ${v.arrangement} · ${v.employment}\n${v.experienceMin}${v.experienceMax!==""?"–"+v.experienceMax:"+"} years · ${v.vacancies||"Unknown"} `;
      const artwork = (
        <div className="wizard-review-preview">
          <JobArtwork job={visual(v)} />
          <JobMediaExtras job={visual(v)} />
        </div>
      );
      if (d.generated) {
        const lines = (name: "responsibilities" | "requirements", label: string) => {
          const rows = v[name].split("\n").filter((s) => s.trim());
          return (
            <div className="job-ai-lines">
              <h3>{label}</h3>
              {rows.map((line, i) => (
                <div key={i}>
                  <TextField
                    label={(name === "responsibilities" ? "Responsibility" : "Requirement") + " " + (i + 1)}
                    name={"review-" + name + "-" + i}
                    value={line}
                    required
                    maxLength={600}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = e.target.value;
                      set({ [name]: next.join("\n") } as Partial<JobWizardValues>, { debounce: true });
                    }}
                  />
                  <IconButton
                    icon="trash"
                    label={"Remove " + (name === "responsibilities" ? "responsibility" : "requirement") + " " + (i + 1)}
                    onClick={() => {
                      if (rows.length <= 1) return toast("Keep at least one " + (name === "responsibilities" ? "responsibility" : "requirement") + ". You can edit its text.");
                      set({ [name]: rows.filter((_, n) => n !== i).join("\n") } as Partial<JobWizardValues>);
                    }}
                  />
                </div>
              ))}
            </div>
          );
        };
        return (
          <>
            <div className="job-ai-ready">
              <div>
                <Icon name="spark" />
                <div>
                  <strong>{devCopy("Your demo draft is ready", "Your draft is ready")}</strong>
                  <p>Review the role-based suggestions below. Edit the text or remove individual items, then verify before publishing.</p>
                </div>
              </div>
              <Button
                variant="text sm"
                icon="refresh"
                onClick={() => {
                  if (!d.aiPrevious) return;
                  const next: JobDraft = { ...d, values: { ...v, ...structuredClone(d.aiPrevious.values) }, step: d.aiPrevious.step, reached: d.aiPrevious.reached, generated: d.aiPrevious.generated, aiPrevious: undefined };
                  setD(next);
                  setErrors({});
                  void store(next);
                  toast("Previous draft restored.");
                }}
              >
                Undo generated draft
              </Button>
            </div>
            {reviewSection("Your job details", 0, <p>{details + (Number(v.vacancies) === 1 ? "vacancies" : "vacancies") + "\n" + formatSalary({ ...v, hideSalary: false }) + (v.hideSalary ? " (hidden from candidates)" : "")}</p>)}
            <section className="wizard-review-section job-ai-review-edit">
              <h2>Job description</h2>
              {area("Description", "description", { required: true, maxLength: 5000 })}
              {lines("responsibilities", "Responsibilities")}
              {lines("requirements", "Requirements")}
              <p className="wizard-help">Remove suggestions with the bin button. Use Job description in the steps to add more lines.</p>
            </section>
            {reviewSection(
              "Suggested skills",
              1,
              <>
                {chips("skills", { stars: true })}
                <p className="small muted">Qualification: {v.education.join(", ")}</p>
              </>,
              "Candidate preferences",
            )}
            <section className="wizard-review-section">
              <div className="row between">
                <h2>
                  Screening questions
                </h2>
                <Button variant="text sm" icon="edit" onClick={() => move(3)}>
                  Edit questions
                </Button>
              </div>
              <div className="job-ai-questions">
                {v.questions.length ? (
                  v.questions.map((q, i) => (
                    <div key={q.id}>
                      <p>
                        {q.text}
                        {q.required && <span aria-hidden="true"> *</span>}
                      </p>
                      <IconButton icon="trash" label={"Remove question " + (i + 1)} onClick={() => set({ questions: v.questions.filter((_, n) => n !== i) })} />
                    </div>
                  ))
                ) : (
                  <p>No screening questions.</p>
                )}
              </div>
            </section>
            {reviewSection(
              "Posting settings",
              4,
              <>
                <p>
                  Recruiter email: {v.contactEmail}
                  <br />
                  Closing date: {v.deadline ? `${v.deadline.date}${v.deadline.time?" at "+v.deadline.time:""} (${v.deadline.timezone})` : v.expiresAt || "Not set"}
                  <br />
                  Portfolio: {v.requirePortfolio ? "Required" : "Optional"}
                  <br />
                  Response notifications: {v.notifyResponses ? "Enabled" : "Disabled"}
                  {v.reference && (
                    <>
                      <br />
                      Reference: {v.reference}
                    </>
                  )}
                </p>
                {v.applicationInstructions && <p>{v.applicationInstructions}</p>}
                {v.benefits && (
                  <>
                    <h3>Benefits</h3>
                    <p>{v.benefits}</p>
                  </>
                )}
              </>,
            )}
            {reviewSection("Media & thumbnail", 5, artwork)}
            <label className="wizard-check job-ai-verification">
              <input type="checkbox" name="aiVerified" required checked={!!v.aiVerified} onChange={(e) => set({ aiVerified: e.target.checked })} />
              I’ve checked the job details and removed anything unnecessary. <span aria-hidden="true">*</span>
            </label>
            <DevOnly>
              <InfoBadge label="Publishing information">This demo uses role-based templates rather than a connected AI service. Publishing saves the job in this browser’s demo feed.</InfoBadge>
            </DevOnly>
          </>
        );
      }
      const sections: [string, string][] = [
        ["Job details", details + (Number(v.vacancies) === 1 ? "vacancy" : "vacancies") + "\n" + formatSalary(v)],
        ["Preferred candidate details", `${v.skills.join(", ")}\nEssential: ${v.essentialSkills.join(", ") || "Not marked"}\nEducation: ${v.education.join(", ")}${v.industries.length ? "\nIndustries: " + v.industries.join(", ") : ""}`],
        ["Job description", v.description + "\n\nResponsibilities\n" + v.responsibilities + "\n\nRequirements\n" + v.requirements + (v.benefits ? "\n\nBenefits\n" + v.benefits : "")],
        ["Screening questions", v.questions.length ? v.questions.map((q, i) => i + 1 + ". " + q.text + (q.required ? " (required)" : "")).join("\n") : "No screening questions."],
        ["Advanced options", `Closing date: ${v.deadline ? `${v.deadline.date}${v.deadline.time?" at "+v.deadline.time:""} (${v.deadline.timezone})` : v.expiresAt || "Not set"}\nReference: ${v.reference || "Not set"}\nPortfolio: ${v.requirePortfolio ? "Required" : "Optional"}\nResponse notifications: ${v.notifyResponses ? "Enabled" : "Disabled"}\nRecruiter email: ${v.contactEmail}${v.applicationInstructions ? "\nInstructions: " + v.applicationInstructions : ""}`],
        ["Media & thumbnail", `${v.thumbnail.image ? "Uploaded thumbnail" : JOB_THUMBNAIL_TEMPLATES.find((t) => t.id === v.thumbnail.template)?.name || "No thumbnail"}\n${v.jobMedia.files.length} supporting files${v.jobMedia.video ? " · Video included" : ""}`],
      ];
      return (
        <>
          {artwork}
          <JobValueSummary compensation={v.compensation} deadline={v.deadline}/>
          {sections.map(([title, copy], i) => reviewSection(title, i, <p>{copy}</p>))}
          <DevOnly>
            <InfoBadge label="Publishing information">Publishing saves this demo job in your local feed. It does not publish to an external job board or send notifications.</InfoBadge>
          </DevOnly>
        </>
      );
    },
  ];

  return (
    <div className="job-wizard-workspace">
      {!!ctx.latestJobVersion&&d.jobVersion!==ctx.latestJobVersion&&<section className="card stack" style={{padding:24,marginBottom:24}}><h2>The current job changed</h2><p>Your private draft is retained. Compare it with the latest job before continuing. Keeping your entire draft does not publish it; publishing later replaces the current job details.</p><details><summary>Compare current job and your draft</summary><div style={{overflowX:"auto"}}><table><thead><tr><th>Field</th><th>Current job</th><th>Your draft</th></tr></thead><tbody>{(Object.keys(v) as (keyof JobWizardValues)[]).filter((key)=>key!=="aiVerified"&&JSON.stringify(v[key])!==JSON.stringify(ctx.latestJob?.wizardValues?.[key])).map((key)=><tr key={key}><th>{key.replace(/([A-Z])/g," $1")}</th><td style={{whiteSpace:"pre-wrap"}}>{compareValue(key,ctx.latestJob?.wizardValues??{})}</td><td style={{whiteSpace:"pre-wrap"}}>{compareValue(key,v)}</td></tr>)}</tbody></table></div></details><form onSubmit={async(e)=>{e.preventDefault();if(!new FormData(e.currentTarget).has("confirmed"))return setErrors({_form:"Confirm that you reviewed the comparison."});const invalid=jobEditorErrors(v,"draft");if(Object.keys(invalid).length)return setErrors(invalid);if(timer.current)clearTimeout(timer.current);if(!await execute(async(s)=>{if(!s.jobPosts.rebaseJobDraft)throw new Error("Draft recovery is unavailable.");const next=await s.jobPosts.rebaseJobDraft(ctx.key,d,ctx.latestJobVersion!);setD(next);return store(next);},{invalidate:[]}))return;toast("Your private draft can be edited again. Review it before publishing.");}}><label className="check-row"><input name="confirmed" type="checkbox" required/>I compared the job and draft and will reconcile changes before publishing. <span aria-hidden="true">*</span></label><Button type="submit" loading={pending} disabled={pending} variant="primary">Keep my private draft</Button></form></section>}
      <div className="job-wizard-top">
        <div>
          <span className="eyebrow">YOUR NEXT TEAMMATE STARTS HERE</span>
          <h1>{ctx.editingPublished ? "Edit job" : "Post a job"}</h1>
        </div>
        <div className="job-wizard-top-actions">
          <Button
            variant="primary job-ai-create"
            icon="spark"
            onClick={() => {
              if (uploadBusy) return toast("Wait for the media upload to finish.");
              void store(d);
              modal.show(devCopy("Create with AI", "Create from a template"), <AiForm values={v} replace={!!(v.description || v.skills.length)} onGenerate={generate} />);
            }}
          >
            {devCopy("Create with AI", "Create from a template")}
          </Button>
          <LinkButton href="/recruiter/applications" variant="text sm" icon="arrow">
            Back to jobs
          </LinkButton>
        </div>
      </div>
      <div className="job-wizard-layout">
        <aside className="card job-wizard-stepper">
          <h2>Your job post</h2>
          <nav aria-label="Job posting stages" ref={navRef}>
            {STEPS.map((label, i) => {
              const complete = i < d.reached && !Object.keys(validate(i, v)).length;
              return (
                <button type="button" key={label} onClick={() => i <= d.reached && move(i)} className={i === d.step ? "active" : complete ? "completed" : ""} aria-current={i === d.step ? "step" : undefined} disabled={i > d.reached}>
                  <span>{complete ? <Icon name="check" /> : i + 1}</span>
                  <strong>{label}</strong>
                </button>
              );
            })}
          </nav>
          <div className="wizard-save-note">
            <Icon name="shield" />
            <p id="job-wizard-save-status">{savedNote}</p>
          </div>
        </aside>
        <section className="card job-wizard-content">
          <div className="wizard-stage-heading">
            <span>
              STEP {d.step + 1} OF {STEPS.length}
            </span>
            <h2 id="wizard-stage-title" tabIndex={-1} ref={titleRef}>
              {STEPS[d.step]}
            </h2>
            <p>{d.step === 6 ? "Check the details before publishing your opportunity." : "A few considered details help the right people find you."}</p>
          </div>
          {Object.keys(errors).length > 0 && (
            <div className="wizard-errors" role="alert">
              <strong>Check the following details</strong>
              <ul>
                {[...new Set(Object.values(errors))].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          <form
            id="job-wizard-form"
            data-step={d.step}
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <fieldset disabled={pending || moving} style={{border:0,padding:0,margin:0,minWidth:0}}>{stages[d.step]()}</fieldset>
          </form>
        </section>
      </div>
      <footer className="job-wizard-footer">
        <div>
          <span className="wizard-footer-progress">
            {d.step + 1} / {STEPS.length}
          </span>
          <Button icon="file" disabled={pending || uploadBusy} onClick={saveAndExit}>
            Save draft & exit
          </Button>
          <div className="grow" />
          {d.step > 0 && (
            <Button icon="chevron" onClick={() => move(Math.max(0, d.step - 1))}>
              Back
            </Button>
          )}
          <button type="submit" form="job-wizard-form" className="btn primary" disabled={uploadBusy || pending}>
            {d.step === 6 ? (ctx.editingPublished ? "Publish changes" : "Publish job") : "Next"}
            <Icon name={d.step === 6 ? "check" : "arrow"} />
          </button>
        </div>
      </footer>
    </div>
  );
}

export function JobWizardScreen() {
  const id = useSearchParams().get("id");
  const [entryKey]=useState(()=>crypto.randomUUID());
  const { data, isPending,isError,isPlaceholderData,refetch } = useServiceQuery(["job-draft", id ?? "new",entryKey], (s) => s.jobPosts.openJobDraft(id,entryKey));
  if(isError)return <EmptyState title="The job draft could not be loaded" description="Check your organization access and retry. Your saved draft is retained." action={<Button onClick={()=>void refetch()}>Retry</Button>}/>;
  if (isPending) return <ScreenFallback layout="form" />;
  if(isPlaceholderData&&(!id||data?.draft.id!==id))return <ScreenFallback layout="form"/>;
  if (data === null)
    return (
      <EmptyState
        title="Job not found."
        description="This job is not available in your company workspace."
        action={
          <LinkButton href="/recruiter/applications" variant="primary">
            Back to jobs
          </LinkButton>
        }
      />
    );
  // Keyed by draft so the wizard seeds its local state once per job.
  return data ? <Wizard key={data.key} ctx={data} /> : <ScreenFallback layout="form" />;
}
