"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { catalogSkill, searchSkills, type CatalogSkill } from "@/lib/domain/skill-catalog";
import { catalogSpecialization, searchSpecializations, type CatalogSpecialization } from "@/lib/domain/specialization-catalog";
import { knownPreference, PREFERENCE_CATALOG_META, searchPreferenceCatalog, type PreferenceCatalogId } from "@/lib/domain/preference-catalog";
import { cn } from "@/lib/utils/text";
import { FloatingInput } from "./field";
import { Icon } from "./icon";

type CatalogEntry = { name: string; group: string };
type Option = { kind: "catalog"; entry: CatalogEntry } | { kind: "custom"; name: string };
type MenuBox = { top: number; left: number; width: number; maxHeight: number };

function CatalogCombobox({ name, label, defaultValue = "", value: controlledValue, required, error, maxLength = 100, placeholder, noun, emptyHint, search, known, onPick, onQuery, onValueChange, clearOnPick = false, disabled, variant = "floating", allowCustom = true, id: suppliedId }: {
  name?: string;
  label: string;
  defaultValue?: string;
  /** When set, the committed field value is controlled by the parent. */
  value?: string;
  required?: boolean;
  error?: string;
  maxLength?: number;
  placeholder: string;
  noun: string;
  emptyHint: string;
  search: (term: string) => CatalogEntry[];
  known: (name: string) => CatalogEntry | undefined;
  onPick?: (entry: CatalogEntry | null, name: string) => void;
  onQuery?: (query: string) => void;
  /** Fires when a committed value changes (pick or closed-list blur). Not used with clearOnPick multi-add. */
  onValueChange?: (value: string) => void;
  clearOnPick?: boolean;
  disabled?: boolean;
  variant?: "floating" | "secondary";
  allowCustom?: boolean;
  id?: string;
}) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const listId = `${id}-list`, errorId = `${id}-error`;
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const initial = controlledValue ?? defaultValue;
  const committed = useRef(initial);
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [menuBox, setMenuBox] = useState<MenuBox | null>(null);
  const term = value.trim();
  const options = useMemo<Option[]>(() => {
    const found: Option[] = search(term).map((entry) => ({ kind: "catalog", entry }));
    return allowCustom && term && !known(term) ? [...found, { kind: "custom", name: term }] : found;
  }, [allowCustom, known, search, term]);

  useEffect(() => {
    if (controlledValue === undefined || open) return;
    committed.current = controlledValue;
    setValue(controlledValue);
  }, [controlledValue, open]);

  const showList = () => {
    setPortalHost(root.current?.closest("dialog") ?? (typeof document === "undefined" ? null : document.body));
    setOpen(true);
    setActive(0);
  };

  const choose = (option: Option) => {
    const next = option.kind === "catalog" ? option.entry.name : option.name;
    setValue(clearOnPick ? "" : next);
    if (!clearOnPick) {
      committed.current = next;
      onValueChange?.(next);
    }
    if (clearOnPick) onQuery?.("");
    setOpen(false);
    onPick?.(option.kind === "catalog" ? option.entry : null, next);
    requestAnimationFrame(() => input.current?.dispatchEvent(new Event("input", { bubbles: true })));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { showList(); return; }
      setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % Math.max(1, options.length));
    } else if (event.key === "Enter" && open && options[active]) {
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setMenuBox(null);
      return;
    }
    const place = () => {
      const field = input.current;
      if (!field) return;
      const rect = field.getBoundingClientRect();
      const margin = 12;
      const gap = 4;
      const cap = 280;
      const below = window.innerHeight - rect.bottom - gap - margin;
      const above = rect.top - gap - margin;
      const openUp = below < 180 && above > below;
      const maxHeight = Math.max(140, Math.min(cap, openUp ? above : below));
      const width = rect.width > 0 ? rect.width : Math.min(320, Math.max(200, window.innerWidth - margin * 2));
      const left = rect.width > 0 ? rect.left : margin;
      const top = openUp ? Math.max(margin, rect.top - gap - maxHeight) : rect.bottom + gap;
      setMenuBox((current) => current && current.top === top && current.left === left && current.width === width && current.maxHeight === maxHeight ? current : { top, left, width, maxHeight });
    };
    place();
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (root.current?.contains(target) || (target instanceof Element && target.closest(".skill-picker-list"))) return;
      setOpen(false);
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", close);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  useEffect(() => {
    const item = list.current?.children[active] as HTMLElement | undefined;
    item?.scrollIntoView?.({ block: "nearest" });
  }, [active, menuBox, options]);

  const headings = options.map((option, index) => option.kind === "catalog" && !term && (index === 0 || options[index - 1].kind !== "catalog" || (options[index - 1] as { entry: CatalogEntry }).entry.group !== option.entry.group) ? option.entry.group : "");
  const suggestions = open && menuBox && portalHost ? createPortal(
    <ul
      ref={list}
      id={listId}
      role="listbox"
      aria-label={`${label} suggestions`}
      className="skill-picker-list"
      style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width, maxHeight: menuBox.maxHeight }}
    >
      {options.map((option, index) => {
        const heading = headings[index];
        return (
          <li key={option.kind === "catalog" ? option.entry.name : "custom"} role="presentation">
            {heading && <span className="skill-picker-area" aria-hidden="true">{heading}</span>}
            <button
              type="button"
              id={`${listId}-${index}`}
              role="option"
              tabIndex={-1}
              aria-selected={index === active}
              className={cn("skill-picker-option", index === active && "is-active", option.kind === "custom" && "is-custom")}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option)}
            >
              {option.kind === "catalog" ? (
                <><span>{option.entry.name}</span>{term && <small>{option.entry.group}</small>}</>
              ) : (
                <><Icon name="plus" /><span>Add “{option.name}” as a new {noun}</span></>
              )}
            </button>
          </li>
        );
      })}
      {!options.length && <li className="skill-picker-empty">{emptyHint}</li>}
    </ul>,
    portalHost,
  ) : null;

  const control = {
    ref: input,
    id,
    name,
    value,
    required,
    maxLength,
    autoComplete: "off" as const,
    role: "combobox" as const,
    "aria-label": variant === "secondary" ? label : undefined,
    "aria-autocomplete": "list" as const,
    "aria-expanded": open,
    "aria-controls": listId,
    "aria-activedescendant": open && options[active] ? `${listId}-${active}` : undefined,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    placeholder,
    onFocus: disabled ? undefined : showList,
    onClick: disabled ? undefined : showList,
    disabled,
    onChange: (event: { target: { value: string } }) => { setValue(event.target.value); onQuery?.(event.target.value); setActive(0); showList(); },
    onKeyDown,
  };
  return (
    <div
      ref={root}
      className={cn("skill-picker", variant === "floating" ? "field" : "preference-catalog")}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (event.currentTarget.contains(next)) return;
        if (next instanceof Element && next.closest(".skill-picker-list")) return;
        setOpen(false);
        if (clearOnPick) return;
        if (allowCustom) {
          const typed = value.trim();
          if (typed !== committed.current) {
            committed.current = typed;
            onValueChange?.(typed);
          }
          return;
        }
        const typed = value.trim();
        if (!typed) {
          if (committed.current) onValueChange?.("");
          committed.current = "";
          if (value) setValue("");
          return;
        }
        const match = known(typed);
        if (match) {
          if (match.name !== committed.current) onValueChange?.(match.name);
          committed.current = match.name;
          if (match.name !== value) {
            setValue(match.name);
            requestAnimationFrame(() => input.current?.dispatchEvent(new Event("input", { bubbles: true })));
          }
          return;
        }
        if (value !== committed.current) {
          setValue(committed.current);
          requestAnimationFrame(() => input.current?.dispatchEvent(new Event("input", { bubbles: true })));
        }
      }}
    >
      {variant === "secondary" ? (
        <input className="secondary-input" {...control} />
      ) : (
        <FloatingInput label={label} {...control} />
      )}
      {error && <small id={errorId} role="alert" className="auth-field-error">{error}</small>}
      {suggestions}
    </div>
  );
}

const searchSkillEntries = (term: string): CatalogEntry[] => searchSkills(term).map((skill) => ({ name: skill.name, group: skill.area }));
const knownSkill = (value: string): CatalogEntry | undefined => {
  const skill = catalogSkill(value);
  return skill ? { name: skill.name, group: skill.area } : undefined;
};
const searchSpecializationEntries = (term: string): CatalogEntry[] => searchSpecializations(term).map((item) => ({ name: item.name, group: item.area }));
const knownSpecialization = (value: string): CatalogEntry | undefined => {
  const item = catalogSpecialization(value);
  return item ? { name: item.name, group: item.area } : undefined;
};

/** Job titles from the role catalog, then skills — for job-alert keyword matching. */
function searchTitleAndSkillEntries(term: string): CatalogEntry[] {
  const titles = searchPreferenceCatalog("role", term, 30).map((entry) => ({ name: entry.name, group: `Job titles · ${entry.group}` }));
  const skills = searchSkills(term, 30).map((skill) => ({ name: skill.name, group: `Skills · ${skill.area}` }));
  const seen = new Set<string>();
  const list: CatalogEntry[] = [];
  for (const entry of [...titles, ...skills]) {
    const key = entry.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(entry);
  }
  return list.slice(0, 60);
}
function knownTitleOrSkill(value: string): CatalogEntry | undefined {
  const role = knownPreference("role", value);
  if (role) return { name: role.name, group: `Job titles · ${role.group}` };
  const skill = knownSkill(value);
  return skill ? { name: skill.name, group: `Skills · ${skill.group}` } : undefined;
}

/**
 * Multi-select for job-alert keywords: searchable job titles and skills from the shared catalogs.
 * Stored as a comma-separated list under `name` (same shape as SkillMultiPicker).
 */
export function TitleSkillMultiPicker({ name, label, defaultValue = "", max = 8, error }: {
  name: string;
  label: string;
  defaultValue?: string;
  max?: number;
  error?: string;
}) {
  const [items, setItems] = useState(() => defaultValue.split(/[,\n]/).map((item) => item.trim()).filter(Boolean));
  const hidden = useRef<HTMLInputElement>(null);
  const changed = () => requestAnimationFrame(() => hidden.current?.dispatchEvent(new Event("input", { bubbles: true })));
  const add = (value: string) => {
    const next = value.trim();
    if (!next || items.length >= max || items.some((item) => item.toLowerCase() === next.toLowerCase())) return;
    setItems((list) => [...list, next]);
    changed();
  };
  const remove = (value: string) => {
    setItems((list) => list.filter((item) => item !== value));
    changed();
  };
  return (
    <div className="skill-multi-picker">
      <input ref={hidden} type="hidden" name={name} value={items.join(", ")} />
      <CatalogCombobox
        label={label}
        clearOnPick
        allowCustom
        disabled={items.length >= max}
        error={error}
        maxLength={100}
        placeholder="Search job titles or skills, e.g. Product Designer, React"
        noun="title or skill"
        emptyHint="Type a job title or skill to add it."
        search={searchTitleAndSkillEntries}
        known={knownTitleOrSkill}
        onPick={(_entry, value) => add(value)}
      />
      {!!items.length && (
        <ul className="skill-chip-list" aria-label={`${label} selected`}>
          {items.map((item) => (
            <li key={item} className="skill-chip">
              <span>{item}</span>
              <button type="button" aria-label={`Remove ${item}`} onClick={() => remove(item)}><Icon name="close" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Searchable skill field: pick from the cross-industry catalog, or add your own when nothing fits.
 * The input itself carries the value (`name`), so forms read it like any other text field.
 * The suggestion list is portaled into the nearest dialog (or document.body) so overflow-clipped
 * editors still show a full dropdown.
 */
export function SkillPicker({ name, label, defaultValue = "", required, error, maxLength = 100, onPick, onQuery, clearOnPick = false, disabled }: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  error?: string;
  maxLength?: number;
  onPick?: (skill: CatalogSkill | null, name: string) => void;
  onQuery?: (query: string) => void;
  clearOnPick?: boolean;
  disabled?: boolean;
}) {
  return (
    <CatalogCombobox
      name={name}
      label={label}
      defaultValue={defaultValue}
      required={required}
      error={error}
      maxLength={maxLength}
      placeholder="Search skills, e.g. React, Accounting, Nursing"
      noun="skill"
      emptyHint="Type a skill name to add it."
      search={searchSkillEntries}
      known={knownSkill}
      onPick={(entry, value) => onPick?.(entry ? catalogSkill(value) ?? null : null, value)}
      onQuery={onQuery}
      clearOnPick={clearOnPick}
      disabled={disabled}
    />
  );
}

/**
 * Searchable specialization field for resume headline focus. Uses occupational practice areas,
 * not the key-skills catalog. Custom values remain allowed so existing free-text focus is preserved.
 */
export function SpecializationPicker({ name, label, defaultValue = "", required, error, maxLength = 200, onPick }: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  error?: string;
  maxLength?: number;
  onPick?: (item: CatalogSpecialization | null, name: string) => void;
}) {
  return (
    <CatalogCombobox
      name={name}
      label={label}
      defaultValue={defaultValue}
      required={required}
      error={error}
      maxLength={maxLength}
      placeholder="Search specializations, e.g. Frontend engineering, Talent acquisition"
      noun="specialization"
      emptyHint="Type a specialization to add it."
      search={searchSpecializationEntries}
      known={knownSpecialization}
      onPick={(entry, value) => onPick?.(entry ? catalogSpecialization(value) ?? null : null, value)}
    />
  );
}

/**
 * Several skills from the same searchable catalog, shown as removable chips. The hidden input keeps the
 * stored format: a comma-separated list under `name`.
 */
export function SkillMultiPicker({ name, label, defaultValue = "", max = 30, error }: { name: string; label: string; defaultValue?: string; max?: number; error?: string }) {
  const [skills, setSkills] = useState(() => defaultValue.split(",").map((skill) => skill.trim()).filter(Boolean));
  const hidden = useRef<HTMLInputElement>(null);
  const changed = () => requestAnimationFrame(() => hidden.current?.dispatchEvent(new Event("input", { bubbles: true })));
  const add = (skill: string) => {
    const value = skill.trim();
    if (!value || skills.length >= max || skills.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    setSkills((list) => [...list, value]);
    changed();
  };
  const remove = (skill: string) => { setSkills((list) => list.filter((item) => item !== skill)); changed(); };
  return (
    <div className="skill-multi-picker">
      <input ref={hidden} type="hidden" name={name} value={skills.join(", ")} />
      <SkillPicker name={`${name}Search`} label={label} clearOnPick error={error} disabled={skills.length >= max} onPick={(_skill, value) => add(value)} />
      {!!skills.length && (
        <ul className="skill-chip-list" aria-label={`${label} selected`}>
          {skills.map((skill) => (
            <li key={skill} className="skill-chip">
              <span>{skill}</span>
              <button type="button" aria-label={`Remove ${skill}`} onClick={() => remove(skill)}><Icon name="close" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CatalogPicker({
  catalog,
  name,
  label,
  defaultValue = "",
  value,
  onChange,
  error,
  variant = "floating",
  allowCustom = true,
  id,
  disabled,
}: {
  catalog: PreferenceCatalogId;
  name?: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  variant?: "floating" | "secondary";
  allowCustom?: boolean;
  id?: string;
  disabled?: boolean;
}) {
  const meta = PREFERENCE_CATALOG_META[catalog];
  return (
    <CatalogCombobox
      id={id}
      name={name}
      label={label}
      defaultValue={defaultValue}
      value={value}
      onValueChange={onChange}
      error={error}
      maxLength={200}
      placeholder={meta.placeholder}
      noun={meta.noun}
      emptyHint={allowCustom ? meta.emptyHint : "No matching options."}
      search={(term) => searchPreferenceCatalog(catalog, term)}
      known={(item) => knownPreference(catalog, item)}
      variant={variant}
      allowCustom={allowCustom}
      disabled={disabled}
    />
  );
}

export function CatalogMultiPicker({
  catalog,
  name,
  label,
  defaultValue = "",
  value,
  onChange,
  max,
  error,
  allowCustom = true,
  id,
  variant = "secondary",
}: {
  catalog: PreferenceCatalogId;
  name?: string;
  label: string;
  defaultValue?: string;
  value?: string[];
  onChange?: (items: string[]) => void;
  max: number;
  error?: string;
  allowCustom?: boolean;
  id?: string;
  variant?: "floating" | "secondary";
}) {
  const uncontrolled = useState(() => defaultValue.split(/[,\n]/).map((item) => item.trim()).filter(Boolean));
  const [localItems, setLocalItems] = uncontrolled;
  const items = value ?? localItems;
  const setItems = (next: string[] | ((list: string[]) => string[])) => {
    const resolved = typeof next === "function" ? next(items) : next;
    if (value === undefined) setLocalItems(resolved);
    onChange?.(resolved);
  };
  const hidden = useRef<HTMLInputElement>(null);
  const changed = () => requestAnimationFrame(() => hidden.current?.dispatchEvent(new Event("input", { bubbles: true })));
  const add = (entry: string) => {
    const next = entry.trim();
    if (!next || items.length >= max || items.some((item) => item.toLowerCase() === next.toLowerCase())) return;
    if (!allowCustom && !knownPreference(catalog, next)) return;
    setItems((list) => [...list, next]);
    changed();
  };
  const remove = (entry: string) => {
    setItems((list) => list.filter((item) => item !== entry));
    changed();
  };
  return (
    <div className={cn("skill-multi-picker", variant === "secondary" && "preference-multi")}>
      {name ? <input ref={hidden} type="hidden" name={name} value={items.join(", ")} /> : null}
      <CatalogCombobox
        id={id}
        label={label}
        variant={variant}
        allowCustom={allowCustom}
        disabled={items.length >= max}
        error={error}
        maxLength={200}
        placeholder={PREFERENCE_CATALOG_META[catalog].placeholder}
        noun={PREFERENCE_CATALOG_META[catalog].noun}
        emptyHint={allowCustom ? PREFERENCE_CATALOG_META[catalog].emptyHint : "No matching options."}
        search={(term) => searchPreferenceCatalog(catalog, term)}
        known={(item) => knownPreference(catalog, item)}
        clearOnPick
        onPick={(_entry, picked) => add(picked)}
      />
      {!!items.length && (
        <ul className="skill-chip-list" aria-label={`${label} selected`}>
          {items.map((item) => (
            <li key={item} className={cn("skill-chip", variant === "secondary" && "preference-chip")}>
              <span>{item}</span>
              <button type="button" aria-label={`Remove ${item}`} onClick={() => remove(item)}><Icon name="close" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
