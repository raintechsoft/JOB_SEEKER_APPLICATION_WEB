"use client";

import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type SVGProps } from "react";
import { createPortal } from "react-dom";
import * as FlagIcons from "country-flag-icons/react/3x2";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/text";
import { PHONE_COUNTRIES, type PhoneCountry } from "@/lib/validation/auth";

const flags = FlagIcons as unknown as Record<string, ComponentType<SVGProps<SVGSVGElement>>>;

function CountryFlag({ iso }: { iso: string }) {
  const Flag = flags[iso];
  if (!Flag) return <span className="country-code-flag is-fallback" aria-hidden="true">{iso}</span>;
  return <Flag className="country-code-flag" aria-hidden="true" />;
}

/**
 * Searchable country picker. `dial` (default) picks a phone country code by ISO;
 * `region` picks a country/region by name and can be left empty.
 */
export function CountryCodeField({ name = "country", defaultValue = "IN", error, required = true, mode = "dial", label }: { name?: string; defaultValue?: string; error?: string; required?: boolean; mode?: "dial" | "region"; label?: string }) {
  const region = mode === "region";
  const fieldLabel = label ?? (region ? "Country / region" : "Country code");
  const labelId = useId();
  const listId = useId();
  const errorId = useId();
  const rootRef = useRef<HTMLLabelElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [iso, setIso] = useState(() => region ? (PHONE_COUNTRIES.find((country) => country.name.toLowerCase() === defaultValue.trim().toLowerCase() || country.iso === defaultValue)?.iso ?? "") : defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const selected = PHONE_COUNTRIES.find((country) => country.iso === iso) ?? (region ? undefined : PHONE_COUNTRIES[0]);
  // Inside a native modal <dialog> (top layer) a body-level menu would sit behind it; render into the dialog instead.
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const openMenu = () => { setPortalHost(rootRef.current?.closest("dialog") ?? document.body); setActive(Math.max(0, PHONE_COUNTRIES.findIndex(country => country.iso === iso))); setOpen(true); };
  const options = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/^\+/, "");
    if (!needle) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter((country) => `${country.name} ${country.code} ${country.iso}`.toLowerCase().includes(needle));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const margin = 16;
      const gap = 6;
      const cap = 240;
      const below = window.innerHeight - rect.bottom - gap - margin;
      const above = rect.top - gap - margin;
      const openUp = below < 180 && above > below;
      const maxHeight = Math.max(140, Math.min(cap, openUp ? above : below));
      const width = Math.min(Math.max(rect.width, 300), window.innerWidth - margin * 2);
      const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
      const top = openUp ? Math.max(margin, rect.top - gap - maxHeight) : rect.bottom + gap;
      setMenuBox((current) => current && current.top === top && current.left === left && current.width === width && current.maxHeight === maxHeight ? current : { top, left, width, maxHeight });
    };
    place();
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || (target instanceof Element && target.closest(".country-code-menu"))) return;
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
  }, [open, iso]);

  const menuReady = menuBox !== null;
  useEffect(() => {
    if (open && menuReady) searchRef.current?.focus();
  }, [open, menuReady]);

  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[active] as HTMLElement | undefined;
    if (!list || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [active, options, menuBox]);

  const choose = (country: PhoneCountry | null) => {
    setIso(country?.iso ?? "");
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => {
      hiddenRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
      buttonRef.current?.focus();
    });
  };

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const country = options[active];
      if (country) choose(country);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  return (
    <label className="field" ref={rootRef}>
      <span className={cn("floating-field is-select has-value country-code-field", open && "is-open")}>
        <input ref={hiddenRef} type="hidden" name={name} value={region ? selected?.name ?? "" : selected?.iso ?? ""} />
        <button
          ref={buttonRef}
          type="button"
          className="country-code-trigger"
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-describedby={error ? errorId : undefined}
          onClick={() => open ? setOpen(false) : openMenu()}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openMenu();
            }
          }}
        >
          {selected && <CountryFlag iso={selected.iso} />}
          <span className={cn("country-code-value", !selected && "is-placeholder")}>{selected ? (region ? selected.name : `${selected.name} (${selected.code})`) : region ? "Select a country or region" : "Country code"}</span>
          <Icon name="down" />
        </button>
        <span className="floating-label" id={labelId}>
          {fieldLabel}
          <span className="floating-required" aria-hidden="true" hidden={!required}>*</span>
        </span>
      </span>
      {error && <small id={errorId} role="alert" className="auth-field-error">{error}</small>}
      {open && menuBox && portalHost && createPortal(
        <div className="country-code-menu" style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width, maxHeight: menuBox.maxHeight }}>
          <input
            ref={searchRef}
            className="country-code-search"
            value={query}
            placeholder={region ? "Search countries and regions" : "Search country or code"}
            aria-label={region ? "Search countries and regions" : "Search country or code"}
            aria-controls={listId}
            aria-activedescendant={options[active] ? `${listId}-${options[active].iso}` : undefined}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onSearchKey}
          />
          <ul ref={listRef} id={listId} role="listbox" className="country-code-list" aria-label={fieldLabel}>
            {region && !query.trim() && (
              <li>
                <button type="button" role="option" aria-selected={!iso} className="country-code-option country-code-clear" onClick={() => choose(null)}>
                  <span>Not specified</span>
                </button>
              </li>
            )}
            {options.map((country, index) => (
              <li key={country.iso}>
                <button
                  type="button"
                  id={`${listId}-${country.iso}`}
                  role="option"
                  aria-selected={country.iso === iso}
                  className={cn("country-code-option", index === active && "is-active")}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(country)}
                >
                  <CountryFlag iso={country.iso} />
                  <span>{country.name}</span>
                  {!region && <span className="country-code-dial">{country.code}</span>}
                </button>
              </li>
            ))}
            {options.length === 0 && <li className="country-code-empty">No countries match.</li>}
          </ul>
        </div>,
        portalHost,
      )}
    </label>
  );
}
