"use client";

import { InfoBadge } from "@/components/ui/info-badge";

import { Fragment, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ProfileCollection, ProfileRecord, Professional, ProfessionalDetails, Project } from "@/types/domain";
import type { ProfileSection } from "@/services/profile/profile.service";
import { ACCOMPLISHMENT_TYPES } from "@/lib/domain/profile";
import { today } from "@/lib/utils/date";
import { devCopy } from "@/lib/env/app-env";
import { useServices } from "@/hooks/use-services";
import { profileRecordSchema, profileSectionSchema, profileDuplicate, validationFields } from "@/lib/validation/profile";
import { errorMessage, fieldErrors } from "@/services/api/client";
import type { SaveResult } from "@/services/profile/profile.service";
import { modal, useModalStore } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Button } from "@/components/ui/primitives";
import { PhotoEditor } from "@/components/profile/photo-editor";
import { openNativePicker, SecondaryField, SelectField, TextAreaField, TextField, ToggleRow } from "@/components/ui/field";
import { CountryCodeField } from "@/features/auth/country-code-field";
import { CatalogMultiPicker, CatalogPicker, SkillMultiPicker, SkillPicker, SpecializationPicker } from "@/components/ui/skill-picker";
import { FormError } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { navigateToProfileSection, setProfileLeaveGuard, useProfileLeaveGuard } from "./profile-navigation";
import {
  CONTACT_METHODS,
  CURRENCIES,
  EMPLOYMENT_TYPES,
  GENDERS,
  MARITAL_STATUSES,
  NOTICE_PERIODS,
  PREFERENCE_LIMITS,
  WORK_ARRANGEMENTS,
  WORK_PERMITS,
  type PreferenceCatalogId,
} from "@/lib/domain/preference-catalog";

export const PROFICIENCY = ["Not specified", "Beginner", "Elementary", "Intermediate", "Upper-intermediate", "Advanced", "Fluent", "Native or bilingual"];

/** [name, label, type, options, required] — the prototype's per-collection form configuration. */
type FieldConfig = [name: string, label: string, type?: string, options?: string[] | null, required?: boolean];

const CONFIGS: Record<ProfileCollection, FieldConfig[]> = {
  skills: [["name", "Skill name", "skill", null, true], ["category", "Category", "select", ["Technical", "Design", "Business", "Communication", "Leadership", "Other"]], ["level", "Proficiency", "select", PROFICIENCY], ["years", "Years of experience", "number"]],
  employment: [["title", "Job title", "text", null, true], ["company", "Company / organization", "text", null, true], ["type", "Employment type", "select", ["Full-time", "Part-time", "Contract", "Internship", "Freelance", "Temporary", "Other"]], ["arrangement", "Work arrangement", "select", ["On-site", "Hybrid", "Remote", "Flexible"]], ["location", "Location"], ["start", "Start month", "month", null, true], ["end", "End month", "month"], ["description", "Description", "textarea"], ["responsibilities", "Key responsibilities", "textarea"], ["achievements", "Key achievements", "textarea"], ["skills", "Skills used", "skills"]],
  education: [["degree", "Qualification / degree", "text", null, true], ["institution", "Institution", "text", null, true], ["field", "Field of study"], ["start", "Start date", "month"], ["end", "Completion / expected date", "month"], ["grade", "Grade / percentage"], ["type", "Education type", "select", ["Full-time", "Part-time", "Distance", "Other"]], ["description", "Description", "textarea"], ["coursework", "Relevant coursework", "textarea"]],
  technicalSkills: [["name", "Skill / technology", "skill", null, true], ["version", "Version"], ["lastUsed", "Last used", "month"], ["years", "Experience — years", "number"], ["months", "Experience — months", "number"]],
  onlineProfiles: [["title", "Platform name", "text", null, true], ["url", "Profile URL", "url", null, true], ["label", "Display label"]],
  workSamples: [["title", "Work sample title", "text", null, true], ["description", "Description", "textarea"], ["url", "Work sample URL", "url", null, true], ["skills", "Skills demonstrated (comma separated)"]],
  publications: [["title", "Publication title", "text", null, true], ["type", "Publication type", "select", ["Research paper", "Journal entry", "White paper", "Article", "Book", "Other"]], ["authors", "Authors"], ["publisher", "Publisher / journal"], ["date", "Publication date", "date"], ["doi", "DOI"], ["url", "External URL", "url"], ["description", "Description", "textarea"]],
  presentations: [["title", "Presentation title", "text", null, true], ["event", "Event / organization"], ["date", "Date", "date"], ["url", "Presentation URL", "url"], ["description", "Description", "textarea"]],
  patents: [["title", "Patent title", "text", null, true], ["number", "Patent / application number"], ["authority", "Issuing authority"], ["filing", "Filing date", "date"], ["grant", "Grant date", "date"], ["status", "Status", "select", ["Filed", "Pending", "Granted", "Expired", "Other"]], ["url", "Reference URL", "url"]],
  certifications: [["title", "Certification name", "text", null, true], ["issuer", "Issuing organization", "text", null, true], ["issue", "Issue date", "date"], ["expiry", "Expiry date", "date"], ["credential", "Credential ID"], ["url", "Credential URL", "url"]],
  languages: [["name", "Language", "text", null, true], ["level", "Overall proficiency", "select", PROFICIENCY], ["reading", "Reading", "select", PROFICIENCY], ["writing", "Writing", "select", PROFICIENCY], ["speaking", "Speaking", "select", PROFICIENCY]],
  careerBreaks: [["start", "Start month", "month", null, true], ["end", "End month", "month"], ["description", "Explanation", "textarea"]],
};

const SECTION_FORMS: Record<ProfileSection, FieldConfig[]> = {
  identity: [["name", "Full name", "text", null, true], ["headline", "Professional headline", "text", null, true], ["location", "General location (city, country)", "text", null, true], ["years", "Total experience — years", "number", null, true], ["email", "Email address", "email", null, true], ["phone", "Phone number", "tel"], ["currentTitle", "Current job title"], ["currentCompany", "Current company / organization"], ["employmentStatus", "Employment status", "select", ["Employed", "Self-employed", "Student", "Seeking opportunities", "Other"]]],
  headline: [["headline", "Professional headline", "textarea", null, true], ["focus", "Specialization / focus", "specialization"]],
  summary: [["summary", "Professional summary", "textarea", null, true], ["interests", "Professional interests"], ["strengths", "Key strengths"]],
  career: [["industry", "Current industry"], ["department", "Current department / function"], ["category", "Current role category"], ["currentType", "Current employment type", "select", [...EMPLOYMENT_TYPES]], ["roles", "Preferred roles"], ["industries", "Preferred industries"], ["departments", "Preferred departments"], ["types", "Preferred employment types"], ["locations", "Preferred work locations"], ["arrangement", "Work arrangement preference", "select", [...WORK_ARRANGEMENTS]], ["notice", "Availability / notice period", "select", [...NOTICE_PERIODS]], ["salary", "Expected annual compensation", "number"], ["currency", "Currency", "select", [...CURRENCIES]], ["interests", "Career interests"]],
  personal: [["gender", "Gender", "select", [...GENDERS]], ["dob", "Date of birth", "date"], ["marital", "Marital status", "select", [...MARITAL_STATUSES]], ["nationality", "Nationality / citizenship"], ["permit", "Work authorization / permit", "select", [...WORK_PERMITS]], ["address", "Address (private)"], ["city", "City"], ["region", "State / region"], ["country", "Country"], ["postal", "Postal code"], ["contact", "Preferred contact method", "select", [...CONTACT_METHODS]]],
  diversity: [["accessibility", "Accessibility information", "textarea"], ["military", "Military service", "textarea"], ["context", "Additional context", "textarea"]],
};

const COLLECTION_TITLES: Partial<Record<ProfileCollection, string>> = { skills: "key skill", technicalSkills: "technical skill", careerBreaks: "career break" };
export const collectionTitle = (c: ProfileCollection) => (ACCOMPLISHMENT_TYPES as Record<string, string>)[c] ?? COLLECTION_TITLES[c] ?? c;

/** Character limits for multi-line profile fields; everything else allows 2,500. */
const TEXTAREA_LIMITS: Record<string, number> = { summary: 1200, headline: 200 };
/** Single-column editors: text-heavy dialogs read better stacked. */
const STACKED_SECTIONS: ProfileSection[] = ["headline", "summary"];

/** Fixed-height text box with a live "n/limit" count at its bottom right (shared by profile editors). */
function CountedTextArea({ label, name, defaultValue, limit, required, error, rows = 5 }: { label: string; name: string; defaultValue: string; limit: number; required?: boolean; error?: string; rows?: number }) {
  const [length, setLength] = useState(defaultValue.length);
  const countId = `profile-count-${name}`;
  return (
    <div className="profile-summary-box">
      <TextAreaField label={label} name={name} defaultValue={defaultValue} maxLength={limit} rows={rows} required={required} error={error} aria-describedby={countId} onInput={(event) => setLength(event.currentTarget.value.length)} />
      <small id={countId} className={"profile-summary-count" + (length >= limit ? " is-full" : "")} aria-live="polite">{length}/{limit}</small>
    </div>
  );
}

function Fields({ config, values, disabled = {}, requiredOverride = {}, section, errors = {}, after = {} }: { config: FieldConfig[]; values: Record<string, unknown>; disabled?: Record<string, boolean>; requiredOverride?: Record<string, boolean>; section?: ProfileSection; errors?: Record<string, string>; after?: Record<string, ReactNode> }) {
  return (
    <div className={"grid profile-form-grid " + (section && STACKED_SECTIONS.includes(section) ? "cols1 profile-form-stacked" : "cols2")}>
      {config.map(([name, label, type = "text", options, required]) => {
        const field = renderField(name, label, type, options, required);
        // Extra control placed right after a field (e.g. "Currently working here" beside End month).
        return after[name] ? <Fragment key={name}>{field}<div className="profile-field-after">{after[name]}</div></Fragment> : field;
      })}
    </div>
  );
  function renderField(name: string, label: string, type: string, options: string[] | null | undefined, required?: boolean) {
        const value = values[name];
        const req = requiredOverride[name] ?? required;
        if (type === "select") return <SelectField key={name} label={label} name={name} error={errors[name]} defaultValue={String(value || options![0])} options={options!} required={req} disabled={disabled[name]} />;
        if (type === "skills")
          return (
            <div style={{ gridColumn: "1/-1" }} key={name}>
              <SkillMultiPicker name={name} label={label} defaultValue={String(value ?? "")} error={errors[name]} />
            </div>
          );
        if (type === "skill")
          return (
            <div style={{ gridColumn: "1/-1" }} key={name}>
              <SkillPicker name={name} label={label} defaultValue={String(value ?? "")} required={req} error={errors[name]} onPick={(skill) => {
                // A catalog skill also fills its category, unless the form has none (technical skills).
                const select = document.querySelector<HTMLSelectElement>('form[data-profile-editor] select[name="category"]');
                if (!skill || !select) return;
                select.value = skill.category;
                select.dispatchEvent(new Event("change", { bubbles: true }));
              }} />
            </div>
          );
        if (type === "specialization")
          return (
            <div style={{ gridColumn: "1/-1" }} key={name}>
              <SpecializationPicker name={name} label={label} defaultValue={String(value ?? "")} required={req} error={errors[name]} />
            </div>
          );
        if (type === "textarea")
          return (
            <div style={{ gridColumn: "1/-1" }} key={name}>
              <CountedTextArea label={label} name={name} error={errors[name]} defaultValue={String(value ?? "")} limit={TEXTAREA_LIMITS[name] ?? 2500} required={req} rows={name === "headline" ? 3 : 5} />
            </div>
          );
        return (
          <TextField
            key={name}
            label={label}
            name={name}
            error={errors[name]}
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
  }
}

const formValues = (form: HTMLFormElement) => {
  const values: Record<string, string> = {};
  for (const [k, v] of new FormData(form)) if (typeof v === "string") values[k] = v.trim();
  return values;
};

function useProfileMutation() {
  const services = useServices();
  const cache = useQueryClient();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const execute = async (operation: () => Promise<SaveResult | void>) => {
    if (busy.current) return false;
    busy.current = true; setPending(true); setError(""); setErrors({});
    try {
      const result = await operation();
      if (result && !result.ok) { setError(result.error); return false; }
      await Promise.all([cache.invalidateQueries({ queryKey: ["journey"] }), cache.invalidateQueries({ queryKey: ["journey-memories"] }), cache.invalidateQueries({ queryKey: ["profile"] }), cache.invalidateQueries({ queryKey: ["shell"] }), cache.invalidateQueries({ queryKey: ["auth", "session"] })]);
      return true;
    } catch (error) {
      const fields = Object.fromEntries(Object.entries(fieldErrors(error)).map(([key, messages]) => [key, messages[0]]));
      setErrors(fields); setError(Object.values(fields)[0] ?? errorMessage(error)); return false;
    } finally { busy.current = false; setPending(false); }
  };
  return { services, execute, error, errors, setError, setErrors, pending };
}

export function RecordForm({ collection, record, details, projects }: { collection: ProfileCollection; record: ProfileRecord | null; details: ProfessionalDetails; projects: Project[] }) {
  const { services, execute, error, errors, setError, setErrors, pending } = useProfileMutation();
  const setDirty = useModalStore((s) => s.setDirty);
  const r = (record ?? {}) as Record<string, unknown>;
  const [current, setCurrent] = useState(!!record?.current);
  const [neverExpires, setNeverExpires] = useState(!!record?.neverExpires);
  const publicSupported = ["employment", "education", ...Object.keys(ACCOMPLISHMENT_TYPES), "careerBreaks"].includes(collection);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const item: ProfileRecord = { ...formValues(form), id: record?.id ?? "", current: f.has("current"), neverExpires: f.has("neverExpires"), public: f.has("public"), featured: f.has("featured") };
    // Employment no longer edits linked projects or public visibility here; keep what was saved.
    if (collection === "employment") { item.projects = record?.projects ?? []; item.public = record?.public ?? true; }
    if (item.skillId === undefined && record?.skillId) item.skillId = record.skillId;
    const checked = profileRecordSchema(collection).safeParse(item);
    if (!checked.success) { const fields = validationFields(checked.error); setErrors(fields); setError("Please check the highlighted fields."); form.querySelector<HTMLElement>(`[name="${Object.keys(fields)[0]}"]`)?.focus(); return; }
    const linked = collection === "employment" ? item.projects ?? [] : collection === "workSamples" && item.project ? [String(item.project)] : [];
    if (linked.length > 50 || new Set(linked).size !== linked.length || linked.some((id) => !projects.some((project) => project.id === id))) { setErrors({ projects: "Choose projects from your own profile." }); setError("Choose projects from your own profile."); return; }
    if (profileDuplicate(collection, item, details[collection])) { setErrors({ name: "This entry already exists. Edit the existing entry." }); return; }
    if (!await execute(() => services.profile.saveRecord(collection, item, details.revision))) return;
    setDirty(false);
    modal.close();
    toast("Profile changes saved across your workspace.");
  };
  return (
    <form id="profile-record-form" data-profile-editor data-collection={collection} className="stack" noValidate onSubmit={submit} onInput={() => setDirty(true)}>
      <Fields config={CONFIGS[collection]} values={r} errors={errors} disabled={{ end: current, expiry: neverExpires }} requiredOverride={{ end: !current && collection === "employment" }}
        after={{
          ...(["employment", "education", "careerBreaks"].includes(collection) ? { end: (
            <ToggleRow name="current" checked={current} onChange={(e) => setCurrent(e.target.checked)}>
              {collection === "education" ? "Currently studying" : collection === "careerBreaks" ? "Ongoing career break" : "I currently work here"}
            </ToggleRow>
          ) } : {}),
          ...(collection === "certifications" ? { expiry: (
            <ToggleRow name="neverExpires" checked={neverExpires} onChange={(e) => setNeverExpires(e.target.checked)}>
              Does not expire
            </ToggleRow>
          ) } : {}),
        }} />
      <datalist id="profile-known-skills">
        {details.skills.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
      {collection === "workSamples" && <SelectField label="Related project" name="project" defaultValue={String(r.project ?? "")} options={[{ value: "", label: "None" }, ...projects.map((p) => ({ value: p.id, label: p.title }))]} />}
      {(collection === "skills" || (publicSupported && collection !== "employment")) && (
        <div className="profile-record-toggles">
          {collection === "skills" && (
            <ToggleRow name="featured" defaultChecked={record?.featured ?? false}>
              Feature this skill
            </ToggleRow>
          )}
          {publicSupported && (
            <ToggleRow name="public" defaultChecked={record?.public ?? collection === "education"}>
              Show this record on my public professional profile
            </ToggleRow>
          )}
        </div>
      )}
      {collection === "careerBreaks" && <InfoBadge label="Profile privacy information">Optional, private by default. Sharing career-break context does not affect profile completion or ranking.</InfoBadge>}
      <div id="profile-form-error" aria-live="polite">
        <FormError message={error} />
      </div>
      <div className="modal-footer">
        <Button onClick={() => modal.requestClose()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check" loading={pending} disabled={pending}>
          Save {record ? "changes" : "entry"}
        </Button>
      </div>
    </form>
  );
}

/** "City, Country" is stored as one location; split it back for the two fields. */
function splitLocation(location: string) {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? { city: parts.slice(0, -1).join(", "), country: parts[parts.length - 1] } : { city: parts[0] ?? "", country: "" };
}
function splitName(name: string) {
  const [first = "", ...rest] = name.trim().split(/\s+/);
  return { first, last: rest.join(" ") };
}
const EMPLOYMENT_STATUSES = [{ value: "", label: "Not specified" }, ...["Employed", "Self-employed", "Student", "Seeking opportunities", "Other"].map((value) => ({ value, label: value }))];

const SUMMARY_LIMIT = 1200;

/** Summary editor: stacked fields, fixed-height summary box with a live character count. */
function SummaryFields({ values, errors }: { values: Record<string, unknown>; errors: Record<string, string> }) {
  const initial = values.summary === undefined || values.summary === null ? "" : String(values.summary);
  return (
    <div className="profile-summary-fields">
      <CountedTextArea label="Professional summary" name="summary" defaultValue={initial} limit={SUMMARY_LIMIT} required error={errors.summary} rows={6} />
      <TextField label="Professional interests" name="interests" defaultValue={values.interests === undefined || values.interests === null ? "" : String(values.interests)} maxLength={2500} error={errors.interests} />
      <TextField label="Key strengths" name="strengths" defaultValue={values.strengths === undefined || values.strengths === null ? "" : String(values.strengths)} maxLength={2500} error={errors.strengths} />
    </div>
  );
}

/** Identity editor: every field optional; first/last name and city/country map onto the stored name and location. */
function IdentityFields({ person: p, details: d, values, errors, currentRequired }: { person: Professional; details: ProfessionalDetails; values: Record<string, unknown>; errors: Record<string, string>; currentRequired: boolean }) {
  const text = (key: string) => (values[key] === undefined || values[key] === null ? "" : String(values[key]));
  const name = splitName(String(p.name ?? "")), place = splitLocation(String(p.location ?? ""));
  return (
    <>
      <div className="profile-identity-grid">
        <TextField label="First name" name="firstName" defaultValue={name.first} maxLength={50} autoComplete="given-name" error={errors.name} />
        <TextField label="Last name" name="lastName" defaultValue={name.last} maxLength={50} autoComplete="family-name" />
        <div className="is-full">
          <CountedTextArea label="Headline" name="headline" defaultValue={String(p.headline ?? "")} limit={200} rows={3} error={errors.headline} />
        </div>
        <TextField label="Email address" name="email" type="email" defaultValue={text("email")} maxLength={254} autoComplete="email" error={errors.email} />
        <TextField label="Phone number" name="phone" type="tel" defaultValue={text("phone")} autoComplete="tel" error={errors.phone} />
        <CountryCodeField mode="region" name="country" label="Country / region" defaultValue={place.country} required={false} error={errors.location} />
        <TextField label="City" name="city" defaultValue={place.city} maxLength={120} autoComplete="address-level2" />
        <TextField label="Current organization" name="currentCompany" defaultValue={text("currentCompany")} maxLength={200} required={currentRequired} error={errors.currentCompany} />
        <TextField label="Current job title" name="currentTitle" defaultValue={text("currentTitle")} maxLength={200} required={currentRequired} error={errors.currentTitle} />
        <SelectField label="Employment status" name="employmentStatus" defaultValue={text("employmentStatus")} options={EMPLOYMENT_STATUSES} error={errors.employmentStatus} />
        {/* Experience is edited elsewhere; keep the stored value so saving this form never clears it. */}
        <input type="hidden" name="years" value={text("years")} />
      </div>
      <div className="profile-identity-toggles">
        <ToggleRow name="available" defaultChecked={p.available}>Open to opportunities</ToggleRow>
        <ToggleRow name="public" defaultChecked={p.public}>{devCopy("Make my professional profile public in the demo", "Make my professional profile public")}</ToggleRow>
        <ToggleRow name="publicEmail" defaultChecked={d.privacy.email}>Show my email on public profiles and portfolio</ToggleRow>
        <ToggleRow name="publicPhone" defaultChecked={d.privacy.phone}>Show my phone on public profiles and portfolio</ToggleRow>
      </div>
    </>
  );
}

export function SectionForm({ section, person: p, details: d }: { section: ProfileSection; person: Professional; details: ProfessionalDetails }) {
  const { services, execute, error, errors, setError, setErrors, pending } = useProfileMutation();
  const setDirty = useModalStore((s) => s.setDirty);
  const values: Record<string, unknown> = section === "career" ? { ...d.career } : section === "personal" ? { ...d.personal } : section === "diversity" ? { ...d.diversity } : { ...p, ...d, interests: d.career.interests || p.interests };
  const [hasCompensation, setHasCompensation] = useState(() => String(values.salary ?? "").trim() !== "");
  const requiredOverride: Record<string, boolean> = section === "career" ? { currency: hasCompensation } : section === "identity" && d.employment.some(entry => entry.current) ? { currentTitle: true, currentCompany: true } : {};
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input: Record<string, string | boolean> = { ...formValues(e.currentTarget) };
    for (const k of ["available", "public", "publicEmail", "publicPhone"]) input[k] = f.has(k);
    if (section === "identity") {
      // The API keeps one name and one location; compose them from the split fields.
      const v = input as Record<string, string>;
      input.name = [v.firstName, v.lastName].filter(Boolean).join(" ");
      input.location = [v.city, v.country].filter(Boolean).join(", ");
      for (const k of ["firstName", "lastName", "city", "country"]) delete input[k];
    }
    const checked = profileSectionSchema(section).safeParse(input);
    if (!checked.success) { const fields = validationFields(checked.error); setErrors(fields); setError("Please check the highlighted fields."); e.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(fields)[0]}"]`)?.focus(); return; }
    if (section === "identity" && d.employment.some((entry) => entry.current)) {
      const fields: Record<string, string> = {};
      if (!input.currentTitle) fields.currentTitle = "Keep a title for your current employment.";
      if (!input.currentCompany) fields.currentCompany = "Keep a company for your current employment.";
      if (Object.keys(fields).length) { setErrors(fields); setError("Please check the highlighted fields."); return; }
    }
    if (!await execute(() => services.profile.saveSection(section, input, d.revision))) return;
    setDirty(false);
    modal.close();
    toast("Profile changes saved across your workspace.");
  };
  return (
    <form id="profile-section-form" data-profile-editor data-section={section} className="stack" noValidate onSubmit={submit} onInput={event => { setDirty(true); const field = event.target; if (field instanceof HTMLInputElement && field.name === "salary") setHasCompensation(field.value.trim() !== ""); }}>
      {section === "identity"
        ? <IdentityFields person={p} details={d} values={values} errors={errors} currentRequired={!!requiredOverride.currentTitle} />
        : section === "summary"
          ? <SummaryFields values={values} errors={errors} />
          : <Fields config={SECTION_FORMS[section]} values={values} errors={errors} section={section} requiredOverride={requiredOverride} />}
      {["career", "personal"].includes(section) && <InfoBadge label="Profile privacy information">Salary, notice period, and personal details are private by default. Optional sensitive fields never affect completion or candidate ranking.</InfoBadge>}
      <div id="profile-form-error" aria-live="polite">
        <FormError message={error} />
      </div>
      <div className="modal-footer">
        <Button onClick={() => modal.requestClose()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check" loading={pending} disabled={pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

const PREFERENCE_SECTIONS = ["career", "personal"] as const;
export type PreferenceSection = (typeof PREFERENCE_SECTIONS)[number];

function preferenceValue(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

const PREFERENCE_SINGLE_CATALOG: Partial<Record<string, { catalog: PreferenceCatalogId; allowCustom?: boolean }>> = {
  industry: { catalog: "industry" },
  department: { catalog: "department" },
  category: { catalog: "roleCategory" },
  nationality: { catalog: "nationality" },
  country: { catalog: "country", allowCustom: false },
};

const PREFERENCE_MULTI_CATALOG: Partial<Record<string, { catalog: PreferenceCatalogId; max: number; allowCustom?: boolean }>> = {
  roles: { catalog: "role", max: PREFERENCE_LIMITS.roles },
  industries: { catalog: "industry", max: PREFERENCE_LIMITS.industries },
  departments: { catalog: "department", max: PREFERENCE_LIMITS.departments },
  types: { catalog: "employmentType", max: PREFERENCE_LIMITS.types, allowCustom: false },
  locations: { catalog: "location", max: PREFERENCE_LIMITS.locations },
  interests: { catalog: "interest", max: PREFERENCE_LIMITS.interests },
};

function preferenceLimitErrors(input: Record<string, string>) {
  const fields: Record<string, string> = {};
  for (const [key, max] of Object.entries(PREFERENCE_LIMITS)) {
    const raw = input[key];
    if (raw === undefined) continue;
    const list = raw.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    if (list.length > max) fields[key] = `You can add up to ${max}.`;
  }
  return fields;
}

export function PreferenceEditor({ section, details }: { section: PreferenceSection; details: ProfessionalDetails }) {
  const { services, execute, error, errors, setError, setErrors, pending } = useProfileMutation();
  const formRef = useRef<HTMLFormElement>(null);
  const saved = useRef("");
  const pendingLeave = useRef<(() => void) | null>(null);
  const detailsValues = section === "career" ? { ...details.career } : { ...details.personal };
  const [formKey, setFormKey] = useState(0);
  const [seed, setSeed] = useState<Record<string, unknown>>(() => detailsValues);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const values = seed;
  const config = SECTION_FORMS[section];
  const snapshot = (form: HTMLFormElement) => JSON.stringify(formValues(form));
  const markDirty = (form: HTMLFormElement) => {
    const next = snapshot(form) !== saved.current;
    setDirty(next);
    if (!next) {
      setErrors({});
      setError("");
    }
  };
  const askToLeave = (proceed?: () => void) => {
    pendingLeave.current = proceed ?? null;
    setConfirming(true);
  };
  const keepEditing = () => {
    pendingLeave.current = null;
    setConfirming(false);
  };
  const discard = () => {
    setSeed(saved.current ? JSON.parse(saved.current) as Record<string, string> : detailsValues);
    setFormKey((key) => key + 1);
    setDirty(false);
    setErrors({});
    setError("");
    setConfirming(false);
    const next = pendingLeave.current;
    pendingLeave.current = null;
    setProfileLeaveGuard(null);
    next?.();
  };
  useLayoutEffect(() => {
    if (formRef.current) saved.current = snapshot(formRef.current);
  }, [formKey]);
  useProfileLeaveGuard(dirty, askToLeave);
  const persist = async (form: HTMLFormElement) => {
    const input = formValues(form);
    const next = JSON.stringify(input);
    if (next === saved.current) {
      setDirty(false);
      setConfirming(false);
      const leave = pendingLeave.current;
      pendingLeave.current = null;
      setProfileLeaveGuard(null);
      leave?.();
      return true;
    }
    const limits = preferenceLimitErrors(input);
    const checked = profileSectionSchema(section).safeParse(input);
    if (!checked.success || Object.keys(limits).length) {
      const fields = { ...(checked.success ? {} : validationFields(checked.error)), ...limits };
      setErrors(fields);
      setError("Please check the highlighted fields.");
      setConfirming(false);
      pendingLeave.current = null;
      form.querySelector<HTMLElement>(`[name="${Object.keys(fields)[0]}"]`)?.focus();
      return false;
    }
    setErrors({});
    setError("");
    const ok = await execute(() => services.profile.saveSection(section, input, details.revision));
    if (!ok) {
      setConfirming(false);
      pendingLeave.current = null;
      return false;
    }
    saved.current = next;
    setDirty(false);
    setConfirming(false);
    toast("Profile changes saved across your workspace.");
    const leave = pendingLeave.current;
    pendingLeave.current = null;
    setProfileLeaveGuard(null);
    leave?.();
    return true;
  };
  return (
    <form
      key={formKey}
      ref={formRef}
      className="profile-preference-form"
      data-no-floating-label
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void persist(event.currentTarget);
      }}
      onInput={(event) => markDirty(event.currentTarget)}
      onChange={(event) => markDirty(event.currentTarget)}
    >
      {config.map(([name, label, type = "text", options]) => {
        const value = preferenceValue(values[name]);
        const multi = PREFERENCE_MULTI_CATALOG[name];
        const single = PREFERENCE_SINGLE_CATALOG[name];
        const control = multi ? (
          <CatalogMultiPicker
            catalog={multi.catalog}
            name={name}
            label={label}
            defaultValue={value}
            max={multi.max}
            allowCustom={multi.allowCustom}
          />
        ) : single ? (
          <CatalogPicker
            catalog={single.catalog}
            name={name}
            label={label}
            defaultValue={value}
            variant="secondary"
            allowCustom={single.allowCustom}
          />
        ) : type === "select" ? (
          <select name={name} defaultValue={value}>
            <option value="" />
            {options!.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : type === "textarea" ? (
          <textarea name={name} defaultValue={value} rows={4} maxLength={2500} />
        ) : (
          <input
            name={name}
            type={type}
            defaultValue={value}
            min={type === "number" ? 0 : undefined}
            max={type === "number" ? (name === "salary" ? 1000000000 : undefined) : name === "dob" ? today() : undefined}
            step={type === "number" ? (name === "salary" ? "any" : 1) : undefined}
            maxLength={type === "text" || type === "url" ? (name === "address" ? 500 : 200) : undefined}
            onClick={type === "date" || type === "month" ? (event) => openNativePicker(event.currentTarget) : undefined}
          />
        );
        return (
          <SecondaryField key={name} label={label} error={errors[name]}>
            {control}
          </SecondaryField>
        );
      })}
      <div aria-live="polite">
        <FormError message={error} />
      </div>
      <div className="profile-preference-actions">
        <Button disabled={!dirty || pending} onClick={() => { if (dirty) askToLeave(); }}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check" loading={pending} disabled={!dirty || pending}>
          Save changes
        </Button>
      </div>
      {confirming && (
        <UnsavedChangesDialog
          saving={pending}
          onKeepEditing={keepEditing}
          onDiscard={discard}
          onSave={() => {
            setConfirming(false);
            formRef.current?.requestSubmit();
          }}
        />
      )}
    </form>
  );
}

export function PhotoForm({ person, revision }: { person: Professional; revision?: number }) {
  const services = useServices(), cache = useQueryClient();
  const refresh = () => Promise.all([cache.invalidateQueries({ queryKey: ["profile"] }), cache.invalidateQueries({ queryKey: ["shell"] }), cache.invalidateQueries({ queryKey: ["auth", "session"] }), cache.invalidateQueries({ queryKey: ["feed"] }), cache.invalidateQueries({ queryKey: ["activity"] })]);
  return <PhotoEditor person={person} onSave={async file => {
    const result = await services.profile.setPhoto(file, revision);
    if (!result.ok) throw new Error(result.error);
    await refresh();
  }} onRemove={async () => { await services.profile.useDefaultPhoto(revision); await refresh(); }} />;
}

export function CoverForm({ person, revision }: { person: Professional; revision?: number }) {
  const services = useServices(), cache = useQueryClient();
  // The home feed's profile card shows the cover too.
  const refresh = () => Promise.all([cache.invalidateQueries({ queryKey: ["profile"] }), cache.invalidateQueries({ queryKey: ["feed", "summary"] })]);
  return <PhotoEditor purpose="profile_cover" sources="computer" imageUrl={person.cover ?? ""} savedMessage="Cover image updated." removedMessage="Cover image removed." onSave={async file => {
    const result = await services.profile.setCover(file, revision);
    if (!result.ok) throw new Error(result.error);
    await refresh();
  }} onRemove={async () => { await services.profile.removeCover(revision); await refresh(); }} />;
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
              navigateToProfileSection(i.section);
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
