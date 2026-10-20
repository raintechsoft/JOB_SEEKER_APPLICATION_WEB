"use client";

import type { ChangeEvent } from "react";
import type { VerificationStatus } from "@/types/domain";
import { isDevelopment } from "@/lib/env/app-env";
import { Icon } from "@/components/ui/icon";
import { Button, IconButton } from "@/components/ui/primitives";
import { FloatingInput, FloatingSelect, FloatingTextArea, type Option } from "@/components/ui/field";

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
    <label className="org-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function OrgChoices({ label, options, chosen, onChange }: { label: string; options: string[]; chosen: string[]; onChange: (values: string[]) => void }) {
  return (
    <fieldset className="org-choices">
      <legend>{label}</legend>
      {options.map((v) => (
        <label key={v}>
          <input type="checkbox" value={v} checked={chosen.includes(v)} onChange={(e) => onChange(e.target.checked ? [...chosen, v] : chosen.filter((x) => x !== v))} />
          {v}
        </label>
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

export function OrgImageUpload({ label, kind, value, onFile, onRemove }: { label: string; kind: "logoUrl" | "coverImageUrl"; value: string; onFile: (file: File) => void; onRemove: () => void }) {
  return (
    <div className={"org-image-upload" + (kind === "coverImageUrl" ? " is-cover" : "")}>
      <div className="org-image-preview">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded data URL
          <img src={value} alt={label + " preview"} />
        ) : (
          <Icon name={kind === "logoUrl" ? "building" : "image"} />
        )}
      </div>
      <div>
        <h3>{label}</h3>
        <p>
          {kind === "logoUrl" ? "Square image recommended." : "Landscape image recommended."} PNG, JPEG or WebP, up to {kind === "logoUrl" ? "500 KB" : "1 MB"}.
        </p>
        <div className="row wrap gap8">
          <label className="btn sm org-file-button">
            <Icon name="upload" />
            {value ? "Replace" : "Upload"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onFile(file);
              }}
            />
          </label>
          {value && (
            <Button variant="text sm" icon="trash" onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const cls = status === "Verified" ? "verified" : status === "Pending review" ? "pending" : status === "Action required" ? "action" : status === "In progress" ? "progress" : "not-started";
  return (
    <span className={"org-status " + cls}>
      <Icon name={status === "Verified" ? "shield" : status === "Action required" ? "help" : "clock"} />
      {status}
      {status === "Verified" && isDevelopment ? " · Demo" : ""}
    </span>
  );
}

export function OrgPublicHint() {
  return (
    <p className="org-visibility-hint">
      <Icon name="globe" />
      These details appear on your public organization profile when visibility is enabled.
    </p>
  );
}
