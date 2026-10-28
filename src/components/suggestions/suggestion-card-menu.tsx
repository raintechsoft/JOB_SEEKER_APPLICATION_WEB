"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

export interface SuggestionCardAction {
  label: string;
  icon: IconName;
  onSelect: () => void;
}

/** Top-corner "more actions" menu for a suggestion card; keyboard and outside-click aware. */
export function SuggestionCardMenu({ name, actions }: { name: string; actions: SuggestionCardAction[] }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const items = () => Array.from(container.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const show = (last = false) => {
    setOpen(true);
    requestAnimationFrame(() => items()[last ? items().length - 1 : 0]?.focus());
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) return show(event.key === "ArrowUp" || event.key === "End");
      const list = items();
      const index = list.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? list.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
      list[next]?.focus();
    }
  };
  return (
    <div className="suggestion-card-menu" ref={container} onKeyDown={keyboard}>
      <button ref={trigger} type="button" className="suggestion-card-menu-trigger" aria-label={"More actions for " + name} aria-haspopup="menu" aria-expanded={open} onClick={() => (open ? setOpen(false) : show())}>
        <Icon name="more" />
      </button>
      {open && (
        <div className="suggestion-card-menu-list" role="menu" aria-label={"Actions for " + name}>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                a.onSelect();
              }}
            >
              <Icon name={a.icon} />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
