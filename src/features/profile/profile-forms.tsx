"use client";

import { useState, type FormEvent } from "react";
import type { ProfileCollection, ProfileRecord, Professional, ProfessionalDetails, Project } from "@/types/domain";
import type { ProfileSection } from "@/services/profile/profile.service";
import { ACCOMPLISHMENT_TYPES } from "@/lib/domain/profile";
import { today } from "@/lib/utils/date";
import { devCopy } from "@/lib/env/app-env";
import { useServiceAction } from "@/hooks/use-services";
import { modal, useModalStore } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Avatar, Button } from "@/components/ui/primitives";
import { CheckRow, FileField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { FormError } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";

export const PROFICIENCY = ["Not specified", "Beginner", "Elementary", "Intermediate", "Upper-intermediate", "Advanced", "Fluent", "Native or bilingual"];

/** [name, label, type, options, required] — the prototype's per-collection form configuration. */
type FieldConfig = [name: string, label: string, type?: string, options?: string[] | null, required?: boolean];

const CONFIGS: Record<ProfileCollection, FieldConfig[]> = {
  skills: [["name", "Skill name", "text", null, true], ["category", "Category", "select", ["Technical", "Design", "Business", "Communication", "Leadership", "Other"]], ["level", "Proficiency", "select", PROFICIENCY], ["years", "Years of experience", "number"]],
  employment: [["title", "Job title", "text", null, true], ["company", "Company / organization", "text", null, true], ["type", "Employment type", "select", ["Full-time", "Part-time", "Contract", "Internship", "Freelance", "Temporary", "Other"]], ["arrangement", "Work arrangement", "select", ["On-site", "Hybrid", "Remote", "Flexible"]], ["location", "Location"], ["start", "Start month", "month", null, true], ["end", "End month", "month"], ["description", "Description", "textarea"], ["responsibilities", "Key responsibilities", "textarea"], ["achievements", "Key achievements", "textarea"], ["skills", "Skills used (comma separated)"]],
  education: [["degree", "Qualification / degree", "text", null, true], ["institution", "Institution", "text", null, true], ["field", "Field of study"], ["start", "Start date", "month"], ["end", "Completion / expected date", "month"], ["grade", "Grade / percentage (optional)"], ["type", "Education type", "select", ["Full-time", "Part-time", "Distance", "Other"]], ["description", "Description", "textarea"], ["coursework", "Relevant coursework", "textarea"]],
  technicalSkills: [["name", "Skill / technology", "text", null, true], ["version", "Version (optional)"], ["lastUsed", "Last used", "month"], ["years", "Experience — years", "number"], ["months", "Experience — months", "number"]],
  onlineProfiles: [["title", "Platform name", "text", null, true], ["url", "Profile URL", "url", null, true], ["label", "Display label"]],
  workSamples: [["title", "Work sample title", "text", null, true], ["description", "Description", "textarea"], ["url", "Work sample URL", "url", null, true], ["skills", "Skills demonstrated (comma separated)"]],
  publications: [["title", "Publication title", "text", null, true], ["type", "Publication type", "select", ["Research paper", "Journal entry", "White paper", "Article", "Book", "Other"]], ["authors", "Authors"], ["publisher", "Publisher / journal"], ["date", "Publication date", "date"], ["doi", "DOI (optional)"], ["url", "External URL", "url"], ["description", "Description", "textarea"]],
  presentations: [["title", "Presentation title", "text", null, true], ["event", "Event / organization"], ["date", "Date", "date"], ["url", "Presentation URL", "url"], ["description", "Description", "textarea"]],
  patents: [["title", "Patent title", "text", null, true], ["number", "Patent / application number"], ["authority", "Issuing authority"], ["filing", "Filing date", "date"], ["grant", "Grant date", "date"], ["status", "Status", "select", ["Filed", "Pending", "Granted", "Expired", "Other"]], ["url", "Reference URL", "url"]],
  certifications: [["title", "Certification name", "text", null, true], ["issuer", "Issuing organization", "text", null, true], ["issue", "Issue date", "date"], ["expiry", "Expiry date", "date"], ["credential", "Credential ID"], ["url", "Credential URL", "url"]],
  languages: [["name", "Language", "text", null, true], ["level", "Overall proficiency", "select", PROFICIENCY], ["reading", "Reading", "select", PROFICIENCY], ["writing", "Writing", "select", PROFICIENCY], ["speaking", "Speaking", "select", PROFICIENCY]],
  careerBreaks: [["start", "Start month", "month", null, true], ["end", "End month", "month"], ["description", "Explanation (optional)", "textarea"]],
};

const SECTION_FORMS: Record<ProfileSection, FieldConfig[]> = {
  identity: [["name", "Full name", "text", null, true], ["headline", "Professional headline", "text", null, true], ["location", "General location (city, country)", "text", null, true], ["years", "Total experience — years", "number", null, true], ["email", "Email address", "email", null, true], ["phone", "Phone number", "tel"], ["currentTitle", "Current job title"], ["currentCompany", "Current company / organization"], ["employmentStatus", "Employment status", "select", ["Employed", "Self-employed", "Student", "Seeking opportunities", "Other"]]],
  headline: [["headline", "Professional headline", "text", null, true], ["focus", "Specialization / focus"]],
  summary: [["summary", "Professional summary (up to 1,200 characters)", "textarea", null, true], ["interests", "Professional interests"], ["strengths", "Key strengths"]],
  career: [["industry", "Current industry"], ["department", "Current department / function"], ["category", "Current role category"], ["currentType", "Current employment type", "select", ["Full-time", "Part-time", "Contract", "Freelance", "Internship", "Temporary", "Other"]], ["roles", "Preferred roles (comma separated)"], ["industries", "Preferred industries (comma separated)"], ["departments", "Preferred departments (comma separated)"], ["types", "Preferred employment types (comma separated)"], ["locations", "Preferred work locations (comma separated)"], ["arrangement", "Work arrangement preference", "select", ["On-site", "Hybrid", "Remote", "Flexible"]], ["notice", "Availability / notice period"], ["salary", "Expected annual compensation (optional)", "number"], ["currency", "Currency (required if compensation entered)"], ["interests", "Career interests", "textarea"]],
  personal: [["gender", "Gender (optional)"], ["dob", "Date of birth (optional)", "date"], ["marital", "Marital status (optional)"], ["nationality", "Nationality / citizenship"], ["permit", "Work authorization / permit"], ["address", "Address (private)"], ["city", "City"], ["region", "State / region"], ["country", "Country"], ["postal", "Postal code"], ["contact", "Preferred contact method", "select", ["Email", "Phone", "Messages"]]],
  diversity: [["accessibility", "Accessibility information (optional)", "textarea"], ["military", "Military service (optional)", "textarea"], ["context", "Additional context (optional)", "textarea"]],
};

const COLLECTION_TITLES: Partial<Record<ProfileCollection, string>> = { skills: "key skill", technicalSkills: "technical skill", careerBreaks: "career break" };
export const collectionTitle = (c: ProfileCollection) => (ACCOMPLISHMENT_TYPES as Record<string, string>)[c] ?? COLLECTION_TITLES[c] ?? c;

function Fields({ config, values, disabled = {}, requiredOverride = {}, section }: { config: FieldConfig[]; values: Record<string, unknown>; disabled?: Record<string, boolean>; requiredOverride?: Record<string, boolean>; section?: ProfileSection }) {
  return (
    <div className="grid cols2 profile-form-grid">
      {config.map(([name, label, type = "text", options, required]) => {
        const value = values[name];
        const req = requiredOverride[name] ?? required;
        if (type === "select") return <SelectField key={name} label={label} name={name} defaultValue={String(value || options![0])} options={options!} />;
        if (type === "textarea")
          return (
            <div style={{ gridColumn: "1/-1" }} key={name}>
              <TextAreaField label={label} name={name} defaultValue={String(value ?? "")} maxLength={section === "summary" && name === "summary" ? 1200 : 2500} required={req} />
            </div>
          );
        return (
          <TextField
            key={name}
            label={label}
            name={name}
            type={type}
            defaultValue={value === undefined || value === null ? "" : String(value)}
            required={req}
            disabled={disabled[name]}
            min={type === "number" ? 0 : undefined}
            max={type === "number" ? (name === "salary" ? 1000000000 : name === "months" ? 11 : 60) : name === "dob" ? today() : undefined}
            step={type === "number" ? (name === "salary" ? "any" : name === "years" ? 0.1 : 1) : undefined}
            maxLength={type === "text" ? 200 : undefined}
            list={name === "name" ? "profile-known-skills" : undefined}
          />
        );
      })}
    </div>
  );
}

const formValues = (form: HTMLFormElement) => {
  const values: Record<string, string> = {};
  for (const [k, v] of new FormData(form)) if (typeof v === "string") values[k] = v.trim();
  return values;
};

export function RecordForm({ collection, record, details, projects }: { collection: ProfileCollection; record: ProfileRecord | null; details: ProfessionalDetails; projects: Project[] }) {
  const run = useServiceAction();
  const setDirty = useModalStore((s) => s.setDirty);
  const [error, setError] = useState("");
  const r = (record ?? {}) as Record<string, unknown>;
  const [current, setCurrent] = useState(!!record?.current);
  const [neverExpires, setNeverExpires] = useState(!!record?.neverExpires);
  const publicSupported = ["employment", "education", ...Object.keys(ACCOMPLISHMENT_TYPES), "careerBreaks"].includes(collection);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const item: ProfileRecord = { ...formValues(form), id: record?.id ?? "", current: f.has("current"), neverExpires: f.has("neverExpires"), public: f.has("public"), featured: f.has("featured") };
    if (collection === "employment") item.projects = f.getAll("projects").map(String);
    if (item.skillId === undefined && record?.skillId) item.skillId = record.skillId;
    const result = await run((s) => s.profile.saveRecord(collection, item));
    if (!result) return;
    if (!result.ok) return setError(result.error);
    setDirty(false);
    modal.close();
    toast("Profile changes saved across your workspace.");
  };
  return (
    <form id="profile-record-form" data-profile-editor data-collection={collection} className="stack" onSubmit={submit} onInput={() => setDirty(true)}>
      <Fields config={CONFIGS[collection]} values={r} disabled={{ end: current, expiry: neverExpires }} requiredOverride={{ end: !current && collection === "employment" }} />
      <datalist id="profile-known-skills">
        {details.skills.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
      {["employment", "education", "careerBreaks"].includes(collection) && (
        <CheckRow name="current" checked={current} onChange={(e) => setCurrent(e.target.checked)}>
          {collection === "education" ? "Currently studying" : collection === "careerBreaks" ? "Ongoing career break" : "Currently working here"}
        </CheckRow>
      )}
      {collection === "skills" && (
        <CheckRow name="featured" defaultChecked={record?.featured ?? true}>
          Feature this skill
        </CheckRow>
      )}
      {collection === "certifications" && (
        <CheckRow name="neverExpires" checked={neverExpires} onChange={(e) => setNeverExpires(e.target.checked)}>
          Does not expire
        </CheckRow>
      )}
      {collection === "employment" && (
        <div className="profile-related-projects">
          <h3>Related projects</h3>
          {projects.map((p) => (
            <label className="check-row" key={p.id}>
              <input type="checkbox" name="projects" value={p.id} defaultChecked={record?.projects?.includes(p.id)} />
              {p.title}
            </label>
          ))}
        </div>
      )}
      {collection === "workSamples" && <SelectField label="Related project" name="project" defaultValue={String(r.project ?? "")} options={[{ value: "", label: "None" }, ...projects.map((p) => ({ value: p.id, label: p.title }))]} />}
      {publicSupported && (
        <CheckRow name="public" defaultChecked={record?.public ?? ["employment", "education"].includes(collection)}>
          Show this record on my public professional profile
        </CheckRow>
      )}
      {collection === "careerBreaks" && <p className="notice">Optional, private by default. Sharing career-break context does not affect profile completion or ranking.</p>}
      <div id="profile-form-error" aria-live="polite">
        <FormError message={error} />
      </div>
      <div className="modal-footer">
        <Button onClick={() => modal.requestClose()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check">
          Save {record ? "changes" : "entry"}
        </Button>
      </div>
    </form>
  );
}

export function SectionForm({ section, person: p, details: d }: { section: ProfileSection; person: Professional; details: ProfessionalDetails }) {
  const run = useServiceAction();
  const setDirty = useModalStore((s) => s.setDirty);
  const [error, setError] = useState("");
  const values: Record<string, unknown> = section === "career" ? { ...d.career } : section === "personal" ? { ...d.personal } : section === "diversity" ? { ...d.diversity } : { ...p, ...d, interests: d.career.interests || p.interests };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input: Record<string, string | boolean> = { ...formValues(e.currentTarget) };
    for (const k of ["available", "public", "publicEmail", "publicPhone"]) input[k] = f.has(k);
    const result = await run((s) => s.profile.saveSection(section, input));
    if (!result) return;
    if (!result.ok) return setError(result.error);
    setDirty(false);
    modal.close();
    toast("Profile changes saved across your workspace.");
  };
  return (
    <form id="profile-section-form" data-profile-editor data-section={section} className="stack" onSubmit={submit} onInput={() => setDirty(true)}>
      <Fields config={SECTION_FORMS[section]} values={values} section={section} />
      {section === "identity" && (
        <>
          <CheckRow name="available" defaultChecked={p.available}>
            Open to opportunities
          </CheckRow>
          <CheckRow name="public" defaultChecked={p.public}>
            {devCopy("Make my professional profile public in the demo", "Make my professional profile public")}
          </CheckRow>
          <CheckRow name="publicEmail" defaultChecked={d.privacy.email}>
            Show my email on public profiles and portfolio
          </CheckRow>
          <CheckRow name="publicPhone" defaultChecked={d.privacy.phone}>
            Show my phone on public profiles and portfolio
          </CheckRow>
        </>
      )}
      {["career", "personal", "diversity"].includes(section) && <p className="notice">Salary, notice period, personal details, and diversity information are private by default. Optional sensitive fields never affect completion or candidate ranking.</p>}
      <div id="profile-form-error" aria-live="polite">
        <FormError message={error} />
      </div>
      <div className="modal-footer">
        <Button onClick={() => modal.requestClose()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check">
          Save changes
        </Button>
      </div>
    </form>
  );
}

export function PhotoForm({ person }: { person: Professional }) {
  const run = useServiceAction();
  const setDirty = useModalStore((s) => s.setDirty);
  const [error, setError] = useState("");
  return (
    <form
      id="profile-photo-form"
      data-profile-editor
      className="stack"
      onInput={() => setDirty(true)}
      onSubmit={async (e) => {
        e.preventDefault();
        const file = new FormData(e.currentTarget).get("photo");
        const result = await run((s) => s.profile.setPhoto(file as File));
        if (!result) return;
        if (!result.ok) return setError(result.error);
        setDirty(false);
        modal.close();
        toast("Profile changes saved across your workspace.");
      }}
    >
      <div className="center">
        <Avatar person={person} size="xl" />
      </div>
      <FileField label="Choose a photo" name="photo" accept="image/png,image/jpeg,image/webp" required hint={devCopy("PNG, JPEG, or WebP up to 1 MB. Saved locally.", "PNG, JPEG, or WebP up to 1 MB.")} />
      <div id="profile-form-error">
        <FormError message={error} />
      </div>
      <div className="modal-footer">
        <Button
          variant="sm"
          onClick={async () => {
            await run((s) => s.profile.useDefaultPhoto());
            setDirty(false);
            modal.close();
          }}
        >
          Use default portrait
        </Button>
        <Button onClick={() => modal.requestClose()}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save photo
        </Button>
      </div>
    </form>
  );
}

export function CompletionChecklist({ percent, items }: { percent: number; items: { label: string; weight: number; done: boolean; section: string }[] }) {
  return (
    <>
      <p className="profile-body-copy">{percent}% complete. Nine professional essentials make up this score. Personal and sensitive fields are never required.</p>
      <div className="profile-completion-checklist">
        {items.map((i) => (
          <a
            key={i.label}
            href={"#profile-" + i.section}
            className="row between"
            onClick={(e) => {
              e.preventDefault();
              modal.close();
              document.getElementById("profile-" + i.section)?.scrollIntoView({ block: "start" });
            }}
          >
            <span>
              <Icon name={i.done ? "check" : "plus"} />
              {i.label}
            </span>
            <span>{i.done ? "Complete" : i.weight + "% to add"}</span>
          </a>
        ))}
      </div>
    </>
  );
}
