"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { type ApplicationCounts, type ApplicationFilter } from "@/services/applications/applications.service";
import type { ApplicationStatus } from "@/types/domain";

export type { ApplicationFilter } from "@/services/applications/applications.service";
import { applicationFiltersSchema } from "@/lib/validation/application";
import { APPLICATION_FILTER_GROUPS } from "@/lib/domain/applications";
const countLabel = (count: number | undefined) => count === undefined ? "count unavailable" : `${count} ${count === 1 ? "application" : "applications"}`;
const IN_PROGRESS = APPLICATION_FILTER_GROUPS["in-progress"];

export function applicationFilter(value: string | null): ApplicationFilter {
  const result = applicationFiltersSchema.shape.status.safeParse(value ?? "");
  return result.success ? result.data : "";
}

function StageDropdown({ label, count, active, value, options, onSelect }: {
  label: string; count: number | undefined; active: boolean; value: ApplicationFilter;
  options: { value: ApplicationFilter; label: string; count: number | undefined }[];
  onSelect: (value: ApplicationFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const menu = root.current?.querySelector<HTMLElement>("fieldset");
      if (!menu || !root.current) return;
      const left = root.current.getBoundingClientRect().left;
      menu.style.left = `${Math.max(12 - left, Math.min(0, window.innerWidth - 12 - left - menu.offsetWidth))}px`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const inputs = root.current?.querySelectorAll<HTMLInputElement>("input");
    (Array.from(inputs ?? []).find(input => input.checked) ?? inputs?.[0])?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="application-stage-dropdown" ref={root} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className="application-filter-pill" aria-label={`${label} filter, ${countLabel(count)}`} data-active={active} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(current => !current)}>
      {label}<span aria-hidden="true"> · </span>{count ?? "—"}<Icon name="chevron" />
    </button>
    {open && <fieldset id={id} className="application-stage-options">
      <legend className="sr-only">{label} stages</legend>
      <p>Select a stage</p>
      {options.map(option => <label key={option.value} onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        onSelect(option.value);
        setOpen(false);
        trigger.current?.focus();
      }}>
        <span>{option.label}<small>{option.count ?? "—"}</small></span>
        <input type="radio" aria-label={`${option.label}, ${countLabel(option.count)}`} name={id} value={option.value} checked={value === option.value} onChange={() => { onSelect(option.value); setOpen(false); trigger.current?.focus(); }} />
      </label>)}
    </fieldset>}
  </div>;
}

export function ApplicationFilters({ counts, value, onSelect }: {
  counts: ApplicationCounts | undefined; value: ApplicationFilter; onSelect: (value: ApplicationFilter) => void;
}) {
  const count = (filter: ApplicationFilter) => !counts ? undefined : filter === "in-progress" ? counts.inProgress : filter === "other" ? counts.other : filter ? counts.statuses[filter] : counts.all;
  return <div className="application-status-filters" role="group" aria-label="Filter your applications">
    <StageDropdown label="In progress" count={count("in-progress")} active={value === "in-progress" || IN_PROGRESS.includes(value as ApplicationStatus)} value={value} onSelect={onSelect}
      options={[{ value: "in-progress", label: "All in progress", count: count("in-progress") }, ...IN_PROGRESS.map(stage => ({value:stage,label:stage,count:count(stage)}))]} />
    {(["Applied", "Interview"] as const).map(stage => <button type="button" key={stage} className="application-filter-pill" aria-label={`${stage}, ${countLabel(count(stage))}`} aria-pressed={value === stage} onClick={() => onSelect(stage)}>{stage}<span aria-hidden="true"> · </span>{count(stage) ?? "—"}</button>)}
    <StageDropdown label="Other" count={counts?.other} active={value === "other" || APPLICATION_FILTER_GROUPS.other.includes(value as ApplicationStatus)} value={value} onSelect={onSelect}
      options={APPLICATION_FILTER_GROUPS.other.map(stage => ({value:stage,label:stage,count:count(stage)}))} />
    <button type="button" className="application-filter-pill" aria-label={`All, ${countLabel(counts?.all)}`} aria-pressed={!value} onClick={() => onSelect("")}>All<span aria-hidden="true"> · </span>{counts?.all ?? "—"}</button>
  </div>;
}
