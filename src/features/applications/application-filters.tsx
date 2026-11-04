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

const MENU_FILTERS: { value: ApplicationFilter; label: string }[] = [
  { value: "in-progress", label: "In progress" },
  { value: "Applied", label: "Applied" },
  { value: "Interview", label: "Interview" },
  { value: "other", label: "Other" },
  { value: "", label: "All" },
];

export function ApplicationFilters({ counts, value, onSelect }: {
  counts: ApplicationCounts | undefined; value: ApplicationFilter; onSelect: (value: ApplicationFilter) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const toolbar = useRef<HTMLDivElement>(null);
  const count = (filter: ApplicationFilter) => !counts ? undefined : filter === "in-progress" ? counts.inProgress : filter === "other" ? counts.other : filter ? counts.statuses[filter] : counts.all;
  const menuActive = (filter: ApplicationFilter) => filter === "in-progress" ? value === "in-progress" || IN_PROGRESS.includes(value as ApplicationStatus)
    : filter === "other" ? value === "other" || APPLICATION_FILTER_GROUPS.other.includes(value as ApplicationStatus)
    : filter ? value === filter : !value;
  const select = (next: ApplicationFilter) => {
    onSelect(next);
    setMenuOpen(false);
  };
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => { if (!toolbar.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);
  return <div className={"application-status-toolbar" + (menuOpen ? " is-open" : "") + (value ? " has-filter" : "")} ref={toolbar}>
    <button type="button" className="iconbtn application-filter-trigger" aria-label="Filter applications" aria-expanded={menuOpen} aria-haspopup="true" onClick={() => setMenuOpen(open => !open)}>
      <Icon name="more" />
    </button>
    <div className="application-status-filters" role="group" aria-label="Filter your applications">
      <StageDropdown label="In progress" count={count("in-progress")} active={value === "in-progress" || IN_PROGRESS.includes(value as ApplicationStatus)} value={value} onSelect={select}
        options={[{ value: "in-progress", label: "All in progress", count: count("in-progress") }, ...IN_PROGRESS.map(stage => ({value:stage,label:stage,count:count(stage)}))]} />
      {(["Applied", "Interview"] as const).map(stage => <button type="button" key={stage} className="application-filter-pill" aria-label={`${stage}, ${countLabel(count(stage))}`} aria-pressed={value === stage} onClick={() => select(stage)}>{stage}<span aria-hidden="true"> · </span>{count(stage) ?? "—"}</button>)}
      <StageDropdown label="Other" count={counts?.other} active={value === "other" || APPLICATION_FILTER_GROUPS.other.includes(value as ApplicationStatus)} value={value} onSelect={select}
        options={APPLICATION_FILTER_GROUPS.other.map(stage => ({value:stage,label:stage,count:count(stage)}))} />
      <button type="button" className="application-filter-pill" aria-label={`All, ${countLabel(counts?.all)}`} aria-pressed={!value} onClick={() => select("")}>All<span aria-hidden="true"> · </span>{counts?.all ?? "—"}</button>
    </div>
    <div className="application-filter-menu-list" role="group" aria-label="Application status">
      {MENU_FILTERS.map((item) => (
        <button type="button" key={item.label} className={menuActive(item.value) ? "active" : undefined} aria-pressed={menuActive(item.value)} onClick={() => select(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  </div>;
}
