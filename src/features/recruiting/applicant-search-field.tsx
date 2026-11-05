"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/primitives";
import { FloatingInput } from "@/components/ui/field";
import { useHiringQuery } from "@/hooks/use-hiring-query";
import type { ResponseItem, ResponseParams } from "@/services/recruiting/recruiting.service";

export type ApplicantPick = { id: string; name: string };

const DEBOUNCE_MS = 250;
const LIST_SIZE = "40";
/** Fixed dropdown height: the list scrolls inside, the sheet never grows. */
const LIST_HEIGHT = 320;
const MIN_LIST_HEIGHT = 160;

function candidateId(item: ResponseItem) {
  return item.application.candidate || item.profile.id;
}

/**
 * Applicant picker for the responses filter sheet. Lists applicants of the selected job
 * (or every job when none is chosen), narrowed by the typed term, as avatar + name + bio cards.
 * Submits `applicant` (candidate id) when a card is chosen; otherwise the typed text stays a plain `q` search.
 */
export function ApplicantSearchField({
  jobId,
  initialQuery = "",
  pick,
  onPickChange,
}: {
  jobId: string;
  initialQuery?: string;
  pick: ApplicantPick | null;
  onPickChange: (pick: ApplicantPick | null) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (root.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const params = useMemo(() => {
    const next: ResponseParams = { stage: "all", size: LIST_SIZE, sort: "newest" };
    if (jobId) next.job = jobId;
    if (debounced) next.q = debounced;
    return next;
  }, [jobId, debounced]);

  const { data, isPending, isError } = useHiringQuery(
    ["responses", "applicant-search", jobId, debounced],
    (s, scope) => s.recruiting.listResponses(params, scope),
    { enabled: open },
  );

  const items = useMemo(() => {
    const seen = new Set<string>();
    const list: ResponseItem[] = [];
    for (const item of data?.items ?? []) {
      const key = candidateId(item);
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(item);
    }
    return list;
  }, [data]);
  const count = items.length;

  /**
   * The filters sheet is a native top-layer <dialog>, so a body portal could never stack above it.
   * The list portals into the dialog itself (absolute) or the body (fixed) and sits under the input.
   * Position is written straight to the element so measuring never triggers a render.
   */
  const [host, setHost] = useState<HTMLElement | null>(null);
  const inDialog = host?.tagName === "DIALOG";
  const openList = () => {
    setHost((root.current?.closest("dialog") as HTMLElement | null) ?? document.body);
    setOpen(true);
  };
  useLayoutEffect(() => {
    if (!open || !host) return;
    // The dialog is read from the DOM here (not from state) because place() scrolls it.
    const dialog = (root.current?.closest("dialog") as HTMLElement | null) ?? null;
    // Scroll-to-fit happens once per opening; later scrolls by the user must not be undone.
    let fitted = false;
    const place = () => {
      const list = listRef.current;
      const anchor = root.current?.querySelector(".floating-field") ?? root.current;
      if (!list || !anchor) return;
      const gap = 4, margin = 8;
      let r = anchor.getBoundingClientRect();
      let below = window.innerHeight - r.bottom - gap - margin;
      // The sheet (<dialog>) is the scroll container: scroll it up so the list fits under the input.
      if (dialog && !fitted && below < LIST_HEIGHT) {
        const room = dialog.scrollHeight - dialog.clientHeight - dialog.scrollTop;
        const delta = Math.min(LIST_HEIGHT - below, Math.max(0, room));
        if (delta > 0) {
          dialog.scrollTop += delta;
          r = anchor.getBoundingClientRect();
          below = window.innerHeight - r.bottom - gap - margin;
        }
      }
      fitted = true;
      const above = r.top - gap - margin;
      let height = LIST_HEIGHT;
      let top = r.bottom + gap;
      if (below < MIN_LIST_HEIGHT && above > below) {
        // Last resort when the sheet cannot scroll any further: open upwards.
        height = Math.min(LIST_HEIGHT, Math.max(MIN_LIST_HEIGHT, above));
        top = r.top - gap - height;
      } else if (below < LIST_HEIGHT) {
        height = Math.max(MIN_LIST_HEIGHT, below);
      }
      // Absolute children of a scrolled dialog are offset by its scroll position.
      const d = dialog ? dialog.getBoundingClientRect() : { top: 0, left: 0 };
      const scrollY = dialog ? dialog.scrollTop : 0;
      const scrollX = dialog ? dialog.scrollLeft : 0;
      list.style.height = height + "px";
      list.style.top = top - d.top + scrollY + "px";
      list.style.left = r.left - d.left + scrollX + "px";
      list.style.width = r.width + "px";
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, host, count]);

  const choose = (item: ResponseItem) => {
    onPickChange({ id: candidateId(item), name: item.profile.name });
    setTerm(item.profile.name);
    setOpen(false);
    setActive(-1);
  };

  const listId = `${id}-list`;
  const value = pick ? pick.name : term;

  return (
    <div ref={root} className="response-applicant-search field">
      <input type="hidden" name="applicant" value={pick?.id ?? ""} />
      <FloatingInput
        label="Search applicants"
        name="q"
        type="search"
        role="combobox"
        autoComplete="off"
        maxLength={200}
        value={value}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 && active < count ? `${id}-option-${active}` : undefined}
        onFocus={openList}
        onClick={openList}
        onChange={(event) => {
          const next = event.target.value;
          if (pick) onPickChange(null);
          setTerm(next);
          setActive(-1);
          openList();
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            if (open) {
              event.preventDefault();
              setOpen(false);
              setActive(-1);
            }
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openList();
            if (!count) return;
            setActive((index) => (index < 0 ? (event.key === "ArrowDown" ? 0 : count - 1) : (index + (event.key === "ArrowDown" ? 1 : -1) + count) % count));
            return;
          }
          if (event.key === "Enter" && open && active >= 0 && active < count) {
            // Choose the highlighted applicant instead of submitting the whole filter form.
            event.preventDefault();
            choose(items[active]);
          }
        }}
      />
      {open && host
        ? createPortal(
        <div ref={listRef} id={listId} role="listbox" aria-label="Applicants" className="response-applicant-search-options" style={{ position: inDialog ? "absolute" : "fixed", height: LIST_HEIGHT }} aria-busy={isPending || undefined}>
          {isError ? (
            <p className="muted small">Applicants could not be loaded.</p>
          ) : isPending ? (
            <p className="muted small">Loading applicants…</p>
          ) : !count ? (
            <p className="muted small">{debounced ? "No applicants match “" + debounced + "”." : "No applicants yet."}</p>
          ) : (
            items.map((item, index) => {
              const bio = item.profile.designation || item.profile.headline || "";
              const subtitle = jobId ? bio : [bio, item.jobTitle].filter(Boolean).join(" · ");
              const selected = pick?.id === candidateId(item);
              return (
                <button
                  type="button"
                  role="option"
                  key={candidateId(item)}
                  id={`${id}-option-${index}`}
                  aria-selected={active === index || selected}
                  data-selected={selected || undefined}
                  onClick={() => choose(item)}
                  onMouseEnter={() => setActive(index)}
                >
                  <Avatar person={item.profile} />
                  <span>
                    <strong>{item.profile.name}</strong>
                    {subtitle ? <small>{subtitle}</small> : null}
                  </span>
                </button>
              );
            })
          )}
        </div>,
        host,
          )
        : null}
    </div>
  );
}
