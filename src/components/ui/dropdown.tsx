"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

export type DropdownOption = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  options: DropdownOption[];
  allowCustom?: boolean;
  placeholder?: string;
  disabled?: boolean;
  trigger?: "labeled" | "value";
  "aria-label"?: string;
  onChange: (value: string) => boolean | void;
};

export function Dropdown({ label, value, options, allowCustom = false, placeholder, disabled = false, trigger = "labeled", "aria-label": ariaLabel, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const selected = options.find(option => option.value === value);
  const visible = allowCustom && draft.trim()
    ? options.filter(option => option.label.toLocaleLowerCase().includes(draft.trim().toLocaleLowerCase()) || option.value.toLocaleLowerCase().includes(draft.trim().toLocaleLowerCase()))
    : options;
  const custom = allowCustom && draft.trim() && !options.some(option => option.value.toLocaleLowerCase() === draft.trim().toLocaleLowerCase())
    ? { value: draft.trim(), label: draft.trim() }
    : null;
  const items = custom ? [...visible, custom] : visible;
  const triggerText = !value && trigger === "value" ? label : !value ? label : trigger === "value" ? selected?.label ?? value : `${label}: ${selected?.label ?? value}`;

  useEffect(() => { if (open) setDraft(allowCustom ? value : ""); }, [open, allowCustom, value]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  const choose = (next: string) => {
    if (onChange(next) === false) return;
    setOpen(false);
  };

  return (
    <div ref={root} className="ui-dropdown">
      <button
        type="button"
        className="search-filter-control"
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-active={!!value}
        data-open={open}
        onClick={() => setOpen(current => !current)}
      >
        <span>{triggerText}</span>
        <Icon name="chevron" />
      </button>
      {open && (
        <div className="ui-dropdown-menu" id={id} role="listbox" aria-label={label}>
          {allowCustom && (
            <input
              ref={input}
              className="ui-dropdown-input"
              data-no-floating-label
              value={draft}
              placeholder={placeholder ?? label}
              maxLength={100}
              aria-label={label}
              onChange={event => { setDraft(event.target.value); setActive(0); }}
              onKeyDown={event => {
                if (event.key === "Enter") { event.preventDefault(); choose(draft.trim() || items[active]?.value || ""); }
                if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(items.length - 1, index + 1)); }
                if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
              }}
            />
          )}
          <div className="ui-dropdown-options">
            {items.map((option, index) => (
              <button
                key={`${option.value}:${option.label}`}
                type="button"
                role="option"
                className="ui-dropdown-option"
                aria-selected={option.value === value}
                data-active={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
