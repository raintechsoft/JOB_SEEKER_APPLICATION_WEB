"use client";

import { useEffect, useId, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/max";
import { TextField, TextAreaField, SelectField } from "@/components/ui/field";
import { Avatar, Button, IconButton } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { useServiceQuery } from "@/hooks/use-services";
import {
  APPLICATION_WIZARD_RULES as rules,
  type ApplicationWizardValues,
} from "@/lib/validation/application-wizard";
import { contactIsVerified } from "./application-wizard-policy";
import type { useApplicationEditor } from "./use-application-editor";

type Editor = ReturnType<typeof useApplicationEditor>;
type Fields = {
  form: UseFormReturn<ApplicationWizardValues>;
  errors: Record<string, string>;
};
const regions = new Intl.DisplayNames(["en"], { type: "region" });
const countries = getCountries()
  .map((country) => ({
    value: country,
    label: `${regions.of(country) ?? country} (+${getCountryCallingCode(country)})`,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

export function ApplicationContactFields({ editor }: { editor: Editor }) {
  const { form, errors, validation, context } = editor;
  const contact = form.watch("contact");
  const [phoneCountry, setPhoneCountry] = useState(
    contact.phone?.country ?? context.profilePhone?.country ?? "IN",
  );
  const proof = contactIsVerified(validation, contact.email, contact.phone);
  const requiredPhone = context.requirements.requirePhone;
  return (
    <div className="wizard-section">
      <TextField
        label="Name"
        required
        maxLength={rules.limits.name}
        {...form.register("contact.name")}
        error={errors["contact.name"]}
      />
      <TextField
        label="Email"
        required
        type="email"
        maxLength={rules.limits.email}
        {...form.register("contact.email")}
        error={errors["contact.email"]}
      />
      <div className="stack">
        {proof.phone && contact.phone ? (
          <TextField
            label="Phone number"
            readOnly
            value={`+${getCountryCallingCode(contact.phone.country as Parameters<typeof getCountryCallingCode>[0])} ${contact.phone.nationalNumber}`}
            hint="Using your verified profile phone number."
          />
        ) : (
          <div className="wizard-grid application-phone-grid">
            <SelectField
              label="Country"
              required={requiredPhone || !!contact.phone}
              options={countries}
              name="contact.phone.country"
              value={contact.phone?.country ?? phoneCountry}
              onChange={(event) => {
                setPhoneCountry(event.target.value);
                if (contact.phone)
                  form.setValue(
                    "contact.phone",
                    { ...contact.phone, country: event.target.value },
                    { shouldDirty: true },
                  );
              }}
              error={errors["contact.phone.country"]}
            />
            <TextField
              label="Phone number"
              required={requiredPhone}
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={15}
              name="contact.phone.nationalNumber"
              value={contact.phone?.nationalNumber ?? ""}
              onChange={(event) =>
                form.setValue(
                  "contact.phone",
                  event.target.value.trim()
                    ? {
                        country: contact.phone?.country ?? phoneCountry,
                        nationalNumber: event.target.value,
                      }
                    : null,
                  { shouldDirty: true },
                )
              }
              error={
                errors["contact.phone"] ||
                errors["contact.phone.nationalNumber"]
              }
            />
          </div>
        )}
        {proof.phone && (
          <p className="small muted">This phone number is already verified.</p>
        )}
      </div>
    </div>
  );
}

/** Job locations from the posting as toggle badges, plus the applicant's own additions. */
function Locations({ form, errors, jobLocations }: Fields & { jobLocations: string[] }) {
  const [text, setText] = useState("");
  const errorId = useId();
  const selected = form.watch("details.preferredLocations") ?? [];
  const key = (value: string) => value.trim().toLowerCase();
  const has = (value: string) => selected.some((item) => key(item) === key(value));
  const full = selected.length >= rules.limits.preferredLocations;
  const set = (next: string[]) =>
    form.setValue("details.preferredLocations", next, { shouldDirty: true });
  const toggle = (value: string) =>
    set(has(value) ? selected.filter((item) => key(item) !== key(value)) : [...selected, value]);
  const add = () => {
    const value = text.trim();
    if (!value || has(value) || full) return;
    set([...selected, value]);
    setText("");
  };
  const own = selected.filter((item) => !jobLocations.some((job) => key(job) === key(item)));
  const error = errors["details.preferredLocations"];
  return (
    <fieldset className="application-locations" aria-describedby={error ? errorId : undefined}>
      <legend>Preferred locations</legend>
      {jobLocations.length > 0 && (
        <div className="application-location-options">
          {jobLocations.map((value) => (
            <button
              type="button"
              key={value}
              className="application-location-option"
              aria-pressed={has(value)}
              disabled={!has(value) && full}
              onClick={() => toggle(value)}
            >
              {has(value) && <Icon name="check" />}
              {value}
            </button>
          ))}
        </div>
      )}
      <div className="wizard-chip-box application-location-own">
        {own.map((value) => (
          <span className="wizard-chip" key={value}>
            <span>{value}</span>
            <IconButton icon="close" label={"Remove " + value} onClick={() => toggle(value)} />
          </span>
        ))}
        <div className="wizard-add-chip">
          <input
            name="details.preferredLocations"
            aria-label="Add another location"
            aria-invalid={!!error}
            placeholder={jobLocations.length ? "Add another location" : "Add a location"}
            maxLength={rules.limits.preferredLocation}
            value={text}
            disabled={full}
            data-no-floating-label
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              add();
            }}
          />
          <Button variant="text sm" disabled={!text.trim() || full} onClick={add}>
            Add
          </Button>
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="auth-field-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function ApplicationDetailsFields({ form, errors, jobLocations = [] }: Fields & { jobLocations?: string[] }) {
  // Expected pay is no longer asked; clear any value an older draft saved so it is not sent.
  useEffect(() => {
    if (form.getValues("details.expectedCompensation") !== null)
      form.setValue("details.expectedCompensation", null);
  }, [form]);
  return (
    <div className="wizard-section">
      <TextAreaField
        label="A short introduction"
        rows={5}
        maxLength={rules.limits.introduction}
        {...form.register("details.introduction")}
        error={errors["details.introduction"]}
      />
      <div className="wizard-grid">
        {(
          [
            ["location", "City"],
            ["locality", "Locality"],
          ] as const
        ).map(([name, label]) => (
          <TextField
            key={name}
            label={label}
            maxLength={rules.limits[name]}
            {...form.register(`details.${name}`)}
            error={errors[`details.${name}`]}
          />
        ))}
        {(
          [
            ["noticeDays", "Notice period (days)"],
            ["joiningDays", "Earliest joining (days)"],
          ] as const
        ).map(([name, label]) => (
          <TextField
            key={name}
            label={label}
            type="number"
            min={0}
            max={rules.limits[name]}
            step={1}
            {...form.register(`details.${name}`, {
              setValueAs: (value) =>
                value == null || value === "" ? null : Number(value),
            })}
            error={errors[`details.${name}`]}
          />
        ))}
      </div>
      <Locations form={form} errors={errors} jobLocations={jobLocations} />
    </div>
  );
}

/** Screening questions with the full question text above a plain control, since questions can be long. */
export function ApplicationQuestionFields({ editor }: { editor: Editor }) {
  return (
    <div className="wizard-section application-questions">
      {editor.context.requirements.questions.map((question, index) => (
        <ApplicationQuestion key={question.id} editor={editor} question={question} index={index} />
      ))}
    </div>
  );
}

function ApplicationQuestion({ editor, question, index }: { editor: Editor; question: Editor["context"]["requirements"]["questions"][number]; index: number }) {
  const id = useId();
  const name = `answers.${question.id}` as const;
  const error = editor.errors[name];
  const field = question.type === "yesno" ? null : editor.form.register(name);
  const described = error ? id + "-error" : undefined;
  const title = (
    <>
      <span>{index + 1}. </span>
      {question.text}
      {question.required && <span aria-hidden="true" className="application-question-required"> *</span>}
    </>
  );
  return (
    <div className="application-question">
      {question.type === "yesno" ? (
        <fieldset aria-describedby={described} aria-required={question.required}>
          <legend className="application-question-text">{title}</legend>
          <div className="application-question-choices">
            {["Yes", "No"].map((value) => (
              <label key={value} className="application-question-choice">
                <input type="radio" name={name} value={value} checked={editor.watched.answers?.[question.id] === value} onChange={() => editor.form.setValue(name, value, { shouldDirty: true })} />
                {value}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <>
          <label htmlFor={id} className="application-question-text">{title}</label>
          {question.type === "number" ? (
            <input id={id} className="application-question-input" inputMode="decimal" maxLength={rules.limits.answer} required={question.required} aria-invalid={!!error} aria-describedby={described} data-no-floating-label {...field!} />
          ) : (
            <textarea id={id} className="application-question-input" rows={4} maxLength={rules.limits.answer} required={question.required} aria-invalid={!!error} aria-describedby={described} data-no-floating-label {...field!} />
          )}
        </>
      )}
      {error && (
        <p id={id + "-error"} role="alert" className="auth-field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function ApplicationDraftReview({ editor }: { editor: Editor }) {
  const values = editor.form.getValues();
  const docs = editor.documents;
  const details = values.details;
  // The owner's own profile carries the photo, headline and bio; the review copy may omit the photo.
  const own = useServiceQuery(["profile"], (s) => s.profile.getProfile()).data?.person;
  const shared = editor.review?.profile;
  const person = { id: own?.id ?? shared?.id ?? "me", name: values.contact.name || own?.name || shared?.name || "You", picture: own?.picture || shared?.picture || undefined, color: own?.color ?? shared?.color, headline: own?.headline || shared?.headline || "", summary: own?.summary || shared?.summary || "", location: own?.location || shared?.location || "" };
  const locked = editor.working || editor.submissionUncertain;
  const edit = (step: Parameters<Editor["visit"]>[0], label: string) => (
    <button type="button" className="application-review-edit" aria-label={label} disabled={locked} onClick={() => void editor.visit(step)}>
      Edit
    </button>
  );
  const phone = values.contact.phone
    ? `+${getCountryCallingCode(values.contact.phone.country as Parameters<typeof getCountryCallingCode>[0])} ${values.contact.phone.nationalNumber}`
    : "";
  const resumeExt = (docs.resume?.name.split(".").pop() ?? "").toUpperCase().slice(0, 4);
  const detailRows = (
    [
      ["location", "City"],
      ["locality", "Locality"],
      ["noticeDays", "Notice period (days)"],
      ["joiningDays", "Earliest joining (days)"],
    ] as const
  ).filter(([name]) => details[name] !== null && details[name] !== "");
  return (
    <div className="wizard-section application-review">
      {/* Only shown when a submission response was lost, so the applicant checks before retrying. */}
      {editor.submissionUncertain && (
        <p role="status" className="application-review-status">
          Submission confirmation is pending. Check your receipt before retrying.
        </p>
      )}
      <section className="application-review-section" aria-labelledby="review-contact">
        <div className="application-review-section-head">
          <h4 id="review-contact">Contact info</h4>
          {edit("contact", "Edit contact details")}
        </div>
        <div className="application-review-person">
          <Avatar person={{ id: person.id, name: person.name, picture: person.picture, color: person.color }} size="lg" />
          <div className="application-review-person-copy">
            <strong>{person.name}</strong>
            {person.headline && <p>{person.headline}</p>}
            {person.summary && <p className="application-review-bio">{person.summary}</p>}
            {person.location && <small>{person.location}</small>}
          </div>
        </div>
        <dl className="application-review-fields">
          <div>
            <dt>Email address</dt>
            <dd>{values.contact.email}</dd>
          </div>
          {phone && (
            <div>
              <dt>Mobile phone number</dt>
              <dd>{phone}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="application-review-section" aria-labelledby="review-documents">
        <div className="application-review-section-head">
          <h4 id="review-documents">Resume</h4>
          {edit("documents", "Edit documents")}
        </div>
        {docs.resume ? (
          <div className="resume-file-card application-review-resume">
            <span className={"resume-file-badge is-" + resumeExt.toLowerCase()} aria-hidden="true">{resumeExt || "FILE"}</span>
            <span className="resume-file-meta">
              <strong title={docs.resume.name}>{docs.resume.name}</strong>
              <small>{docs.resume.bytes >= 1048576 ? `${(docs.resume.bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(docs.resume.bytes / 1024))} KB`}</small>
            </span>
          </div>
        ) : (
          <p className="application-review-empty">No resume selected.</p>
        )}
        <p className="application-review-note">
          {values.documents.includePortfolio ? `Portfolio included: ${docs.portfolio.title}${docs.portfolio.sections.length ? ` (${docs.portfolio.sections.join(", ")})` : ""}` : "Portfolio is not included."}
        </p>
      </section>

      <section className="application-review-section" aria-labelledby="review-details">
        <div className="application-review-section-head">
          <h4 id="review-details">Application details</h4>
          {edit("details", "Edit application details")}
        </div>
        <dl className="application-review-fields">
          {detailRows.map(([name, label]) => (
            <div key={name}>
              <dt>{label}</dt>
              <dd>{details[name]}</dd>
            </div>
          ))}
          {details.preferredLocations.length > 0 && (
            <div>
              <dt>Preferred locations</dt>
              <dd>{details.preferredLocations.join(", ")}</dd>
            </div>
          )}
        </dl>
      </section>

      {editor.context.requirements.questions.length > 0 && (
        <section className="application-review-section" aria-labelledby="review-questions">
          <div className="application-review-section-head">
            <h4 id="review-questions">Additional questions</h4>
            {edit("questions", "Edit answers")}
          </div>
          <dl className="application-review-fields">
            {editor.context.requirements.questions.map((question) => (
              <div key={question.id}>
                <dt>{question.text}</dt>
                <dd className="application-preserve-text">{values.answers[question.id] || "No answer supplied."}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}