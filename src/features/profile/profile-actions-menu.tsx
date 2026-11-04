"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icon";
import "./profile-actions-menu.css";

export function ProfileActionsMenu({
  previewHref,
  onCopy,
  onImprove,
  onEdit,
  editLabel = "Edit basic profile",
}: {
  previewHref: string;
  onCopy: () => Promise<void>;
  /** Omitted once the profile is complete, which hides "Improve profile". */
  onImprove?: () => void;
  /** Opens the basic profile editor; shown as a pencil button beside the options menu. */
  onEdit?: () => void;
  editLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function show(last = false) {
    setOpen(true);
    requestAnimationFrame(() => {
      const items =
        container.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
      items?.[last ? items.length - 1 : 0]?.focus();
    });
  }

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        show(event.key === "ArrowUp" || event.key === "End");
        return;
      }
      const items = Array.from(
        container.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
          [],
      );
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length;
      items[next]?.focus();
    }
  }

  return (
    <div
      className="profile-overflow"
      ref={container}
      onKeyDown={keyboard}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      {onEdit && (
        <button
          type="button"
          className="iconbtn profile-edit-trigger"
          aria-label={editLabel}
          title={editLabel}
          onClick={onEdit}
        >
          <Icon name="edit" />
        </button>
      )}
      <button
        ref={trigger}
        type="button"
        className="iconbtn profile-overflow-trigger"
        aria-label="Profile options"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <Icon name="more" />
      </button>
      {open && (
        <div
          id={menuId}
          className="profile-overflow-menu"
          role="menu"
          aria-label="Profile options"
        >
          <Link
            role="menuitem"
            tabIndex={-1}
            href={previewHref}
            onClick={() => setOpen(false)}
          >
            <Icon name="eye" />
            Preview public profile
          </Link>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
              void onCopy();
            }}
          >
            <Icon name="copy" />
            Copy profile link
          </button>
          {onImprove && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
                onImprove();
              }}
            >
              <Icon name="spark" />
              Improve profile
            </button>
          )}
        </div>
      )}
    </div>
  );
}
