"use client";

import type { Role } from "@/types/domain";
import { useState } from "react";
import { useServiceQuery } from "@/hooks/use-services";
import { apiConfig } from "@/services/api/config";
import { Icon } from "@/components/ui/icon";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { scopesFor, searchLabels, filterLabels, searchSettings, type SearchFilters, type SearchOptions, type SearchScope } from "@/lib/search/scopes";
import { filterLayouts, controlKeys, controlLabel, type FilterControl } from "@/lib/search/capabilities";
import { CompensationFilter, withoutCompensation } from "./compensation-filter";
import { compensationQueryErrors } from "@/lib/validation/job-discovery";

type Props = { role: Role; scope: SearchScope; query: string; options: SearchOptions; pending?: boolean; onCategory: (scope: SearchScope) => void; onApply: (options: SearchOptions) => boolean };
const isSet = (value: unknown) => value !== undefined && value !== "";
const CONTENT_TYPE_LABELS: Record<string, string> = { text: "Text", image: "Images", video: "Videos", project: "Project showcase" };
const DAY_VALUE_LABELS: Record<string, string> = { "1": "Past 24 hours", "7": "Past week", "30": "Past month", "90": "Past 3 months", "365": "Past year" };
const labelFor = (key: keyof SearchFilters, scope: SearchScope) => key === "skill" && scope === "projects" ? "Technology" : key === "days" && scope === "projects" ? "Updated within days" : key === "days" && scope === "posts" ? "Date posted" : filterLabels[key];
const ANY: DropdownOption = { value: "", label: "Any" };
const DAY_OPTIONS: DropdownOption[] = [
  ANY,
  { value: "1", label: "Past 24 hours" },
  { value: "7", label: "Past week" },
  { value: "30", label: "Past month" },
  { value: "90", label: "Past 3 months" },
  { value: "365", label: "Past year" },
];
const EXPERIENCE_OPTIONS: DropdownOption[] = [
  ANY,
  { value: "0-2", label: "0–2 years" },
  { value: "3-5", label: "3–5 years" },
  { value: "6-10", label: "6–10 years" },
  { value: "11-60", label: "10+ years" },
];

function withChoice(value: string, label: string, options: DropdownOption[]) {
  return value && !options.some(option => option.value === value) ? [...options, { value, label }] : options;
}

function controlValue(control: FilterControl, options: SearchOptions) {
  if (control === "compensation") return "";
  if (control === "experience") {
    if (options.experienceMin === undefined && options.experienceMax === undefined) return "";
    return `${options.experienceMin ?? 0}-${options.experienceMax ?? 60}`;
  }
  const value = options[control];
  return value === undefined ? "" : String(value);
}

function applyControl(control: FilterControl, value: string, options: SearchOptions): SearchOptions {
  const next = { ...options };
  for (const key of controlKeys(control)) delete next[key];
  if (!value) return next;
  if (control === "experience") {
    const [min, max] = value.split("-").map(Number);
    if (Number.isFinite(min)) next.experienceMin = min;
    if (Number.isFinite(max)) next.experienceMax = max;
    return next;
  }
  if (control === "days") next.days = Number(value);
  else (next as Record<string, string>)[control] = value;
  return next;
}

function optionsFor(control: FilterControl, role: Role, scope: SearchScope, options: SearchOptions, identity?: string | null): { choices: DropdownOption[]; allowCustom: boolean } {
  const current = controlValue(control, options);
  if (control === "arrangement") return { choices: withChoice(current, current, [ANY, ...searchSettings.arrangements.map(value => ({ value, label: value }))]), allowCustom: false };
  if (control === "employment") return { choices: withChoice(current, current, [ANY, ...searchSettings.employment.map(value => ({ value, label: value }))]), allowCustom: false };
  if (control === "education") return { choices: withChoice(current, current, [ANY, ...searchSettings.education.map(value => ({ value, label: value }))]), allowCustom: false };
  if (control === "discipline") return { choices: withChoice(current, current, [ANY, ...searchSettings.disciplines.map(value => ({ value, label: value }))]), allowCustom: false };
  if (control === "days") return { choices: withChoice(current, `Past ${current} days`, DAY_OPTIONS), allowCustom: false };
  if (control === "experience") return { choices: withChoice(current, `${current} years`, EXPERIENCE_OPTIONS), allowCustom: false };
  if (control === "author") {
    const choices = [ { value: "", label: "Anyone" }, ...(identity && role === "professional" ? [{ value: identity, label: "Me" }] : []) ];
    return { choices: withChoice(current, current === identity ? "Me" : "Selected author", choices), allowCustom: false };
  }
  if (control === "contentType") return { choices: withChoice(current, CONTENT_TYPE_LABELS[current] ?? current, [ANY, ...searchSettings.contentTypes.map(value => ({ value, label: CONTENT_TYPE_LABELS[value] ?? value }))]), allowCustom: false };
  if (control === "companyType") return { choices: withChoice(current, current, [ANY, ...searchSettings.companyTypes.map(value => ({ value, label: value }))]), allowCustom: false };
  return { choices: withChoice(current, current, [ANY]), allowCustom: true };
}

export function SearchFilterBar({ role, scope, pending = false, onCategory, selectionScope }: Pick<Props, "role" | "scope" | "pending" | "onCategory"> & { selectionScope?: SearchScope }) {
  const pressed = selectionScope && scopesFor(role).includes(selectionScope) ? selectionScope : scope;
  return <aside className="search-filter-sidebar">
    <div className="search-filter-bar" role="navigation" aria-label="Search categories" aria-busy={pending}>
      <h2>Filters</h2>
      <nav className="search-category-nav" aria-label="Search category">
        {scopesFor(role).map(value => (
          <button key={value} type="button" aria-pressed={value === pressed} disabled={pending} className="search-category-item" onClick={() => { if (value !== scope || (value === "all" && pressed !== "all")) onCategory(value); }}>
            {searchLabels[value]}
          </button>
        ))}
      </nav>
    </div>
  </aside>;
}

export function SearchSubFilterBar({ role, scope, options, pending = false, onApply }: Omit<Props, "onCategory" | "query">) {
  const [filterError,setFilterError]=useState("");
  const apply=(next:SearchOptions)=>{
    const messages=Object.values(compensationQueryErrors(next));
    if(messages.length){setFilterError(messages[0]);return false;}
    const accepted=onApply(next);setFilterError(accepted?"":"Check the selected filters before searching.");return accepted;
  };
  const layout = filterLayouts[scope];
  const session = useServiceQuery(["auth", "session"], service => service.auth.me(), { enabled: apiConfig.dataSource === "http" });
  const identity = session.data?.selected_identity_id;
  const fieldKeys = Object.keys(options).filter(key => key !== "sort" && key !== "selected" && isSet(options[key as keyof SearchOptions])) as (keyof SearchFilters)[];
  const describe = (key: keyof SearchFilters, value: unknown) => key === "author" ? value === identity ? "Me" : "Selected author" : key === "contentType" ? CONTENT_TYPE_LABELS[String(value)] ?? String(value) : key === "days" ? DAY_VALUE_LABELS[String(value)] ?? String(value) : String(value);
  const controls = [...layout.quick, ...layout.more];
  return <div className="search-subfilter-wrap">
    <div className="search-subfilter-bar" role="group" aria-label="Search filters" aria-busy={pending} data-no-floating-label>
      <Dropdown
        label="Sort by"
        trigger="value"
        aria-label="Sort by"
        disabled={pending}
        value={options.sort ?? "relevance"}
        options={[{ value: "relevance", label: "Relevance" }, { value: "recent", label: "Latest" },...(scope==="jobs"?[{value:"salary_asc",label:"Compensation: low to high"},{value:"salary_desc",label:"Compensation: high to low"}]:[])]}
        onChange={value => apply({ ...options, sort: value as SearchOptions["sort"] })}
      />
      {controls.map(control => {
        if(control==="compensation")return <CompensationFilter key={control} options={options} disabled={pending} onApply={apply}/>;
        const { choices, allowCustom } = optionsFor(control, role, scope, options, identity);
        return <Dropdown
          key={control}
          label={controlLabel(control, scope)}
          aria-label={`${controlLabel(control, scope)} filter`}
          disabled={pending}
          value={controlValue(control, options)}
          options={choices}
          allowCustom={allowCustom}
          placeholder={controlLabel(control, scope)}
          onChange={value => apply(applyControl(control, value, options))}
        />;
      })}
    </div>
    {filterError&&<p role="alert" className="small">{filterError}</p>}
    {!!fieldKeys.length && <div className="search-active-filters" role="group" aria-label="Active filters">
      {fieldKeys.map(key => <button className="search-active-filter" type="button" key={key} aria-label={`Remove ${labelFor(key,scope)} filter`} disabled={pending} onClick={() => apply(key==="currency"||key==="compensationPeriod"?withoutCompensation(options):Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))}>{labelFor(key,scope)}: {describe(key,options[key])}<Icon name="close" /></button>)}
      <button type="button" className="search-clear-filters" disabled={pending} onClick={() => apply({...(options.sort && !["salary_asc","salary_desc"].includes(options.sort) ? {sort:options.sort} : {}),...(options.selected ? {selected:options.selected} : {})})}>Clear all filters</button>
    </div>}
  </div>;
}
