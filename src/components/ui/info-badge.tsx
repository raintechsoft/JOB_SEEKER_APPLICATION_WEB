"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils/text";

/** Explanatory text stays out of the layout until hovered, focused, or tapped. */
export function InfoBadge({ children, label = "More information", className, style }: {
  children: ReactNode; label?: string; className?: string; style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const content = useRef<HTMLSpanElement>(null);
  const pinned = useRef(false);
  const focused = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();
  const cancelClose = () => { clearTimeout(closeTimer.current); };
  const dismiss = () => { cancelClose(); pinned.current = false; setOpen(false); };
  const leave = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => { if (!pinned.current && !focused.current) setOpen(false); }, 140);
  };

  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) { pinned.current = false; setOpen(false); }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Dismiss the information first when it is inside another dialog.
        event.preventDefault(); event.stopPropagation(); pinned.current = false; setOpen(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const tip = content.current;
    if (!tip) return;
    // Native popovers use the top layer, including inside scrollable <dialog> sheets.
    if (typeof tip.showPopover === "function") tip.showPopover();
    else tip.style.display = "block";
    const place = () => {
      const anchor = root.current?.getBoundingClientRect();
      if (!anchor) return;
      const {width,height} = tip.getBoundingClientRect();
      const below = window.innerHeight - anchor.bottom - 10;
      const above = below < height && anchor.top > below;
      const top = above ? anchor.top - height - 8 : anchor.bottom + 8;
      tip.style.top = `${Math.max(12, Math.min(top, window.innerHeight - height - 12))}px`;
      tip.style.left = `${Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12))}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  return <span ref={root} className={cn("info-badge",className)} style={style}
    onPointerEnter={event => { if (event.pointerType !== "touch") {cancelClose();setOpen(true);} }}
    onPointerLeave={leave}
    onFocus={() => { focused.current = true;cancelClose();setOpen(true); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) {focused.current = false;dismiss();} }}>
    <button type="button" className="info-badge-trigger" aria-label={label} aria-expanded={open} aria-describedby={open ? id : undefined}
      onClick={() => { pinned.current = !pinned.current;cancelClose();setOpen(pinned.current); }}>
      <span aria-hidden="true">i</span>
    </button>
    {open && <span ref={content} id={id} role="tooltip" popover="manual" className="info-badge-content"
      onPointerEnter={cancelClose} onPointerLeave={leave}>{children}</span>}
  </span>;
}
