"use client";

import type { ChangeEvent } from "react";
import type { VerificationStatus } from "@/types/domain";
import { isPrototype } from "@/lib/env/app-env";
import { isVerifiedCompany, isVerifiedOrganizationStatus } from "@/lib/domain/organization";
import { PREFERENCE_LIMITS, type PreferenceCatalogId } from "@/lib/domain/preference-catalog";
import { Icon } from "@/components/ui/icon";
import { MediaImage } from "@/components/ui/media-image";
import { CatalogMultiPicker, CatalogPicker } from "@/components/ui/skill-picker";
import { InfoBadge } from "@/components/ui/info-badge";
import { Button, IconButton } from "@/components/ui/primitives";
import { FloatingInput, FloatingSelect, FloatingTextArea, ToggleRow, type Option } from "@/components/ui/field";

const keyId = (key: string) => "org-" + key.replaceAll(".", "-");

interface Common {
  label: string;
  name: string;
  value: string;
  error?: string;
  maxLength?: number;
  onValue: (value: string) => void;
}

function Wrap({ name, value, error, maxLength, children }: { name: string; value: string; error?: string; maxLength?: number; children: React.ReactNode }) {
  return (
    <div className="org-field-wrap">
      {children}
      {maxLength && (
        <span className="org-field-count" data-org-count={name} data-limit={maxLength}>
          {value.length} / {maxLength}
        </span>
      )}
      {error && (
        <p className="org-field-error" id={keyId(name) + "-error"}>
          {error}
        </p>
      )}
    </div>
  );
}

const a11y = (name: string, error?: string) => ({ id: keyId(name), "aria-invalid": error ? true : undefined, "aria-describedby": error ? keyId(name) + "-error" : undefined });

export function OrgField({ label, name, value, error, maxLength, onValue, type = "text", required, pattern, min, max }: Common & { type?: string; required?: boolean; pattern?: string; min?: number; max?: number }) {
  return (
    <Wrap name={name} value={value} error={error} maxLength={maxLength}>
      <label className="field">
        <FloatingInput label={label} name={name} type={type} value={value} required={required} pattern={pattern} min={min} max={max} maxLength={maxLength} onChange={(e: ChangeEvent<HTMLInputElement>) => onValue(e.target.value)} {...a11y(name, error)} />
      </label>
    </Wrap>
  );
}

export function OrgArea({ label, name, value, error, maxLength, onValue, required, placeholder }: Common & { required?: boolean; placeholder?: string }) {
  return (
    <Wrap name={name} value={value} error={error} maxLength={maxLength}>
      <label className="field">
        <FloatingTextArea label={label} name={name} value={value} required={required} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onValue(e.target.value)} {...a11y(name, error)} />
      </label>
    </Wrap>
  );
}

export function OrgSelect({ label, name, value, error, onValue, options, required }: Omit<Common, "maxLength"> & { options: Option[]; required?: boolean }) {
  return (
    <Wrap name={name} value={value} error={error}>
      <label className="field">
        <FloatingSelect label={label} name={name} value={value} required={required} options={options} onChange={(e) => onValue(e.target.value)} {...a11y(name, error)} />
      </label>
    </Wrap>
  );
}

export function OrgCheck({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <ToggleRow checked={checked} onChange={(e) => onChange(e.target.checked)} hint={hint}>
      {label}
    </ToggleRow>
  );
}

export function OrgChoices({ label, options, chosen, onChange }: { label: string; options: string[]; chosen: string[]; onChange: (values: string[]) => void }) {
  return (
    <fieldset className="org-choices">
      <legend>{label}</legend>
      {options.map((v) => (
        <ToggleRow
          key={v}
          checked={chosen.includes(v)}
          onChange={(e) => onChange(e.target.checked ? [...chosen, v] : chosen.filter((x) => x !== v))}
        >
          {v}
        </ToggleRow>
      ))}
    </fieldset>
  );
}

export function OrgChips({ label, name, scope, values, onAdd, onRemove }: { label: string; name: string; scope: string; values: string[]; onAdd: (raw: string) => void; onRemove: (index: number) => void }) {
  const inputId = `org-add-${scope}-${name}`;
  const add = () => {
    const el = document.getElementById(inputId) as HTMLInputElement | null;
    if (!el) return;
    onAdd(el.value);
    el.value = "";
  };
  return (
    <div className="org-chip-field">
      <h3>{label}</h3>
      <div className="org-chip-box">
        {values.length ? (
          values.map((v, i) => (
            <span key={v + i}>
              {v}
              <IconButton icon="close" label={"Remove " + v} onClick={() => onRemove(i)} />
            </span>
          ))
        ) : (
          <p className="org-chip-empty">No {label.toLowerCase()} added yet.</p>
        )}
        <div className="org-chip-add">
          <input
            id={inputId}
            aria-label={"Add " + label.toLowerCase()}
            placeholder={"Add " + label.toLowerCase()}
            maxLength={100}
            data-no-floating-label
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button variant="text sm" icon="plus" onClick={add}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Controlled single catalogue field for organization / recruiter drafts. */
export function OrgCatalogField({
  label,
  name,
  catalog,
  value,
  error,
  allowCustom = true,
  onValue,
}: {
  label: string;
  name: string;
  catalog: PreferenceCatalogId;
  value: string;
  error?: string;
  allowCustom?: boolean;
  onValue: (value: string) => void;
}) {
  return (
    <div className="org-field-wrap">
      <CatalogPicker
        id={keyId(name)}
        catalog={catalog}
        name={name}
        label={label}
        value={value}
        onChange={onValue}
        error={error}
        allowCustom={allowCustom}
      />
    </div>
  );
}

/** Controlled multi catalogue chips for organization / recruiter drafts. */
export function OrgCatalogChips({
  label,
  name,
  catalog,
  values,
  error,
  max,
  allowCustom = true,
  onChange,
}: {
  label: string;
  name: string;
  catalog: PreferenceCatalogId;
  values: string[];
  error?: string;
  max?: number;
  allowCustom?: boolean;
  onChange: (values: string[]) => void;
}) {
  const limit =
    max ??
    (catalog === "department"
      ? PREFERENCE_LIMITS.departments
      : catalog === "location"
        ? PREFERENCE_LIMITS.locations
        : catalog === "employmentType"
          ? PREFERENCE_LIMITS.types
          : catalog === "interest"
            ? PREFERENCE_LIMITS.interests
            : catalog === "benefit"
              ? PREFERENCE_LIMITS.benefits
              : 20);
  return (
    <div className="org-chip-field org-catalog-chips">
      <CatalogMultiPicker
        id={keyId(name)}
        catalog={catalog}
        label={label}
        value={values}
        onChange={onChange}
        max={limit}
        error={error}
        allowCustom={allowCustom}
      />
    </div>
  );
}

export function OrgImageUpload({ label, kind, value, disabled, busy, onManage }: { label: string; kind: "logoUrl" | "coverImageUrl"; value: string; disabled?: boolean; busy?: boolean; onManage: () => void }) {
  const manageLabel = kind === "logoUrl" ? "Manage logo" : "Manage cover";
  const empty = <Icon name={kind === "logoUrl" ? "building" : "image"} />;
  return (
    <div className={"org-image-upload" + (kind === "coverImageUrl" ? " is-cover" : "")}>
      <button type="button" className="org-image-preview" aria-label={"View or edit " + label} onClick={onManage} disabled={disabled || busy}>
        {value ? <MediaImage src={value} alt="" fallback={empty} /> : empty}
      </button>
      <div>
        <h3>{label}</h3>
        <p>
          {kind === "logoUrl" ? "Square image recommended." : "Landscape image recommended."} PNG, JPEG or WebP, up to {kind === "logoUrl" ? "500 KB" : "1 MB"}. Upload from your computer, then adjust before saving.
        </p>
        <Button variant="sm" icon="upload" onClick={onManage} disabled={disabled || busy}>
          {manageLabel}
        </Button>
      </div>
    </div>
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === "Verified") {
    return (
      <span className="org-verified-mark" role="img" aria-label={isPrototype ? "Verified · Demo" : "Verified"}>
        {/* Decorative mark only — never a control or link. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/icons/verified.png" alt="" draggable={false} />
      </span>
    );
  }
  const cls = status === "Pending review" ? "pending" : status === "Action required" ? "action" : status === "In progress" ? "progress" : "not-started";
  return (
    <span className={"org-status " + cls}>
      <Icon name={status === "Action required" ? "help" : status === "Not started" ? "shield" : "clock"} />
      {status}
    </span>
  );
}

/** Icon-only mark for public company names. Renders nothing unless verification is confirmed. */
export function VerifiedCompanyMark({
  company,
  status,
}: {
  company?: { verified?: boolean; confidential?: boolean; name?: string } | null;
  status?: VerificationStatus | string | null;
}) {
  const confirmed = company !== undefined ? isVerifiedCompany(company) : isVerifiedOrganizationStatus(status);
  if (!confirmed) return null;
  return <VerificationBadge status="Verified" />;
}

export function OrgPublicHint() {
  return (
    <InfoBadge label="Public profile visibility">
      These details appear on your public organization profile when visibility is enabled.
    </InfoBadge>
  );
}
