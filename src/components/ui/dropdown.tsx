"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [menuBox, setMenuBox] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
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
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const panel = menu.current;
      if (!anchor || !panel) return;
      const viewport = window.visualViewport;
      const viewLeft = viewport?.offsetLeft ?? 0;
      const viewTop = viewport?.offsetTop ?? 0;
      const viewWidth = viewport?.width ?? window.innerWidth;
      const viewHeight = viewport?.height ?? window.innerHeight;
      const margin = 8;
      panel.style.width = "max-content";
      panel.style.minWidth = "0";
      panel.style.maxWidth = "none";
      const contentWidth = Math.ceil(panel.getBoundingClientRect().width);
      const width = Math.min(Math.max(anchor.width, contentWidth), viewWidth - margin * 2);
      const maxHeight = Math.max(120, viewHeight - margin * 2);
      const height = Math.min(panel.offsetHeight, maxHeight);
      const left = Math.max(viewLeft + margin, Math.min(anchor.left, viewLeft + viewWidth - width - margin));
      let top = anchor.bottom + 4;
      if (top + height > viewTop + viewHeight - margin) top = Math.max(viewTop + margin, anchor.top - height - 4);
      setMenuBox(previous => previous && previous.left === left && previous.top === top && previous.width === width && previous.maxHeight === maxHeight ? previous : { left, top, width, maxHeight });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    if (menu.current) observer?.observe(menu.current);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
      observer?.disconnect();
    };
  }, [open, items.length]);
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
        ref={triggerRef}
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
        <div
          ref={menu}
          className="ui-dropdown-menu"
          id={id}
          role="listbox"
          aria-label={label}
          style={{
            position: "fixed",
            left: menuBox?.left ?? 0,
            top: menuBox?.top ?? 0,
            width: menuBox?.width,
            minWidth: menuBox?.width,
            maxWidth: menuBox?.width,
            maxHeight: menuBox?.maxHeight,
            visibility: menuBox ? "visible" : "hidden",
          }}
        >
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
