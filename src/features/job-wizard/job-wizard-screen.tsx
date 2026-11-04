"use client";
import { useHiringQuery } from "@/hooks/use-hiring-query";

import { JOB_V2_RULES } from "@/lib/validation/job-v2";
import { jobEditorErrors } from "@/lib/domain/job-editor";
import { CompensationFields, DeadlineFields, NoticeFields } from "./job-value-fields";
import { JobValueSummary } from "@/components/jobs/job-value-summary";
import { JobNoticeDetails } from "@/components/jobs/job-notice-details";
import { InfoBadge } from "@/components/ui/info-badge";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ErrorState } from "@/components/ui/state-views";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { JobWizardSkeleton } from "./job-wizard-skeleton";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { isPrototype } from "@/lib/env/app-env";
import { validateJobFiles } from "@/lib/validation/job";
import { errorMessage, fieldErrors } from "@/services/api/client";
import { useFormAction } from "@/hooks/use-form-action";
import { JobArtwork, JobMediaExtras, type JobVisualData } from "@/components/jobs/job-visuals";
import { PhotoEditor } from "@/components/profile/photo-editor";
import { JOB_TEMPLATE_CREATE_ENABLED } from "@/lib/feature-flags";

const STEPS = ["Job details", "Preferred candidate details", "Job description", "Screening questions", "Advanced options", "Media & thumbnail", "Review & publish"];
const DEPARTMENTS = ["Design", "Engineering", "Product", "Data & analytics", "Sales & retail", "Marketing", "Operations", "Human resources", "Finance", "Other"];
const EDUCATION = JOB_V2_RULES.education;
/** One conflict toast per draft key for this page session (survives wizard remounts). */
const draftConflictNotices = new Set<string>();
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
  const live=useHiringQuery(["job-editor-live",ctx.key,ctx.draft.editorToken],(s,scope)=>s.jobPosts.draftState!(ctx.key,d,scope),{enabled:!isPrototype&&!!services.jobPosts.draftState});
  const jobVersionConflict=!!ctx.latestJobVersion&&d.jobVersion!==ctx.latestJobVersion;
  const blocked=live.isError||!!live.data?.changed||jobVersionConflict;
  const blockedRef=useRef(blocked);blockedRef.current=blocked;
  const conflictToastShown=useRef(false);
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

  const store = async (next: JobDraft, rebased = false) => {
    if(blockedRef.current&&!rebased){setSavedNote("Your input is retained. Reload the current draft before saving.");return false;}
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

  // Toast once and sync in place. Avoid remounting the wizard — that re-fired the toast in a loop.
  useEffect(() => {
    if (!blocked || conflictToastShown.current || draftConflictNotices.has(ctx.key)) return;
    conflictToastShown.current = true;
    draftConflictNotices.add(ctx.key);
    toast("This job draft changed. Reload the saved draft to continue.");
    if (!jobVersionConflict || !services.jobPosts.rebaseJobDraft || !ctx.latestJobVersion) return;
    const draft = latestDraft.current;
    const latest = ctx.latestJobVersion;
    void (async () => {
      try {
        const next = await services.jobPosts.rebaseJobDraft!(ctx.key, draft, latest);
        setD(next);
        await store(next, true);
        void live.refetch();
      } catch {
        /* stay blocked; toast already shown */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store/live are stable enough; remounting must not re-fire
  }, [blocked, jobVersionConflict, ctx.key, ctx.latestJobVersion]);
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
    if(blockedRef.current)return toast("Reload the current draft before continuing. Your input is retained.");
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
    if (invalid) {
      if (thumbnail) throw new Error(invalid);
      return toast(invalid);
    }
    const allowed = thumbnail ? IMAGE_TYPES : [...IMAGE_TYPES, "application/pdf", "video/mp4", "video/webm"];
    if (isPrototype && files.some((f) => !allowed.includes(f.type) || f.size > MB)) {
      if (thumbnail) throw new Error("Choose supported files up to 1 MB each.");
      return toast("Choose supported files up to 1 MB each.");
    }
    if (isPrototype && !thumbnail && (v.jobMedia.files.length + files.length > 3 || v.jobMedia.files.reduce((n, f) => n + f.size, 0) + files.reduce((n, f) => n + f.size, 0) > 1.5 * MB)) return toast("Use up to three supporting files, totaling 1.5 MB or less.");
    setUploadBusy(true);
    try {
      const added = await Promise.all(files.map(async (f) => {
        if (isPrototype) return { id: uid(), name: f.name, type: f.type, size: f.size, data: await readAsDataUrl(f) };
        const asset = await services.media.upload(f, thumbnail ? "job_thumbnail" : "job_attachment", ctx.companyId);
        return { id: asset.id, name: f.name, type: f.type, size: f.size, data: asset.url };
      }));
      const current = latestDraft.current.values;
      if (thumbnail) {
        const alt = current.thumbnail.alt.trim() || (current.title.trim() ? current.title.trim() + " hiring announcement" : "Hiring announcement");
        set({ thumbnail: { ...current.thumbnail, image: added[0].data, alt } });
      } else set({ jobMedia: { ...current.jobMedia, files: [...current.jobMedia.files, ...added] } });
    } catch (e) {
      if (thumbnail) throw e instanceof Error ? e : new Error("That file could not be read. Please try again.");
      toast("That file could not be read. Please try again.");
    } finally {
      setUploadBusy(false);
    }
  };

  const openThumbnailEditor = () => {
    const imageUrl = latestDraft.current.values.thumbnail.image;
    modal.show(
      imageUrl ? "Job thumbnail" : "Upload job thumbnail",
      <PhotoEditor
        purpose="job_thumbnail"
        sources="computer"
        imageUrl={imageUrl}
        savedMessage="Thumbnail updated."
        removedMessage="Thumbnail removed."
        onSave={async (file) => {
          await upload([file], true);
        }}
        onRemove={async () => {
          const current = latestDraft.current.values;
          set({ thumbnail: { ...current.thumbnail, image: "" } });
        }}
      />,
      "photo",
    );
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
    if(blockedRef.current)return toast("Reload the current draft before continuing. Your input is retained.");
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
    if(blockedRef.current)return toast("Reload the current draft before saving. Your input is retained.");
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
            {/* New drafts start without an employment type; an explicit empty choice shows that nothing is selected yet. */}
            <SelectField label="Employment type" name="employment" error={errors.employment} value={v.employment ?? ""} onChange={(e) => set({ employment: e.target.value } as Partial<JobWizardValues>)} options={[{ value: "", label: "Choose an employment type" }, ...JOB_V2_RULES.employment]} required />
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
        {v.schemaVersion===2&&<NoticeFields value={v.notice} onChange={notice=>set({notice},{debounce:true})} errors={errors}/>}
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
            {v.thumbnail.image ? (
              <button type="button" className="wizard-template active" aria-pressed={true} onClick={openThumbnailEditor}>
                <span className="wizard-template-art">
                  <JobArtwork job={visual(v)} />
                </span>
                <strong>Uploaded</strong>
                <span>Your custom 16:9 thumbnail</span>
              </button>
            ) : null}
          </div>
          <div className="row gap8 wrap">
            <Button variant="sm" icon={v.thumbnail.template === "none" && !v.thumbnail.image ? "check" : "close"} onClick={() => set({ thumbnail: { ...v.thumbnail, template: "none", image: "" } })}>
              No thumbnail
            </Button>
            <Button variant="sm" icon="upload" disabled={uploadBusy} onClick={openThumbnailEditor}>
              {v.thumbnail.image ? "Edit thumbnail" : "Upload thumbnail"}
            </Button>
            {v.thumbnail.image && (
              <Button variant="text sm" icon="trash" disabled={uploadBusy} onClick={() => set({ thumbnail: { ...v.thumbnail, image: "" } })}>
                Remove uploaded thumbnail
              </Button>
            )}
          </div>
          <p className="wizard-help">PNG, JPEG, or WebP. Cropped to  1280×720 before saving.</p>
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
                <JobNoticeDetails notice={v.notice} />
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
        ["Media & thumbnail", v.thumbnail.image ? "Uploaded thumbnail" : JOB_THUMBNAIL_TEMPLATES.find((t) => t.id === v.thumbnail.template)?.name || "No thumbnail"],
      ];
      return (
        <>
          {artwork}
          <JobValueSummary compensation={v.compensation} deadline={v.deadline}/>
          {sections.map(([title, copy], i) => reviewSection(title, i, <><p>{copy}</p>{i === 4 && <JobNoticeDetails notice={v.notice} />}</>))}
          <DevOnly>
            <InfoBadge label="Publishing information">Publishing saves this demo job in your local feed. It does not publish to an external job board or send notifications.</InfoBadge>
          </DevOnly>
        </>
      );
    },
  ];

  return (
    <div className="job-wizard-workspace">
      <div className="job-wizard-top">
        <div>
          <h1>{ctx.editingPublished ? "Edit job" : "Post a job"}</h1>
        </div>
        <div className="job-wizard-top-actions">
          {JOB_TEMPLATE_CREATE_ENABLED ? (
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
          ) : null}
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
          <Button icon="file" disabled={pending || uploadBusy || blocked} onClick={saveAndExit}>
            Save draft & exit
          </Button>
          <div className="grow" />
          {d.step > 0 && (
            <Button icon="chevron" onClick={() => move(Math.max(0, d.step - 1))}>
              Back
            </Button>
          )}
          <button type="submit" form="job-wizard-form" className="btn primary" disabled={uploadBusy || pending || blocked}>
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
  const { data, isPending,isError,error,isPlaceholderData,refetch } = useServiceQuery(["job-draft", id ?? "new",entryKey], (s) => s.jobPosts.openJobDraft(id,entryKey),{refetchOnWindowFocus:false,staleTime:Infinity,keepPreviousData:false});
  // A new post is always titled "Post a job"; an existing one waits for the draft to know.
  const pending = <JobWizardSkeleton steps={STEPS} title={id ? undefined : "Post a job"} />;
  if(isError)return <JobWizardSkeleton steps={STEPS} title={id ? undefined : "Post a job"}><ErrorState error={error} onRetry={()=>refetch()} homeHref="/recruiter/jobs" homeLabel="Back to jobs" title="This job draft couldn’t load" description="Check your organization access, then try again." /></JobWizardSkeleton>;
  if (isPending) return pending;
  if(isPlaceholderData&&(!id||data?.draft.id!==id))return pending;
  if (data === null)
    return (
      <EmptyState
        icon="compass"
        title="Job not found"
        description="This job is not available in your company workspace."
        action={
          <LinkButton href="/recruiter/jobs" variant="primary">
            Back to jobs
          </LinkButton>
        }
      />
    );
  // Keyed by draft so the wizard seeds its local state once per job.
  return data ? <Wizard key={`${data.key}:${data.draft.editorToken??"mock"}`} ctx={data} /> : pending;
}
