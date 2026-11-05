"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { flexRender } from "@tanstack/react-table";
import { getCoreRowModel, useLegacyTable, type LegacyColumnDef } from "@tanstack/react-table/legacy";
import { useObservedSession } from "@/features/auth/use-observed-session";
import { Avatar, Button, IconButton } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { modal } from "@/stores/modal-store";
import { formatLocaleDate } from "@/lib/utils/date";
import { RECRUITING_RULES } from "@/lib/validation/recruiting";
import type { HiringStage, Id, ScreeningQuestion } from "@/types/domain";
import { applicantProfileHref, type ResponseItem } from "@/services/recruiting/recruiting.service";
import { CandidateProfileActions, openResume } from "./candidate-profile-actions";
import { useApplicationsMessage } from "./use-applications-message";
import { clearResponseTablePrefs, loadResponseTablePrefs, saveResponseTablePrefs } from "./response-table-prefs";
import {
  isResponseTableCellExpanded,
  isResponseTableColumnExpanded,
  isResponseTableRowExpanded,
  toggleResponseTableExpansion,
  type ResponseTableExpansionState,
} from "./response-table-expansion";
import {
  clampResponseTableWidth,
  defaultResponseTablePrefs,
  isResponseTableContentExpandable,
  isResponseTableStaticColumnId,
  RESPONSE_TABLE_COLUMN_IDS,
  RESPONSE_TABLE_DEFAULT_WIDTHS,
  RESPONSE_TABLE_FILTER_PARAMS,
  RESPONSE_TABLE_LABELS,
  RESPONSE_TABLE_MANDATORY,
  RESPONSE_TABLE_MAX_WIDTHS,
  RESPONSE_TABLE_MIN_WIDTHS,
  RESPONSE_TABLE_OPTIONAL,
  RESPONSE_TABLE_QUESTION_WIDTHS,
  RESPONSE_TABLE_SORTABLE,
  responseTableColumnLabel,
  responseTableDefaultWidth,
  responseTableQuestionColumnId,
  responseTableQuestionIdOf,
  type ResponseTableAnyColumnId,
  type ResponseTableColumnId,
  type ResponseTableDensity,
  type ResponseTablePrefs,
} from "./response-table-types";

export type ResponseGridActions = {
  markViewed: (id: Id) => void | Promise<void>;
  contact: (item: ResponseItem) => void | Promise<void>;
  status: (ids: Id[], status: HiringStage) => void | Promise<void>;
};

type Props = {
  items: ResponseItem[];
  selection: Id[];
  allChecked: boolean;
  onSelect: (id: Id, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  actions: ResponseGridActions;
  sort: string;
  onSortChange: (sort: string) => void;
  filterParams: Record<string, string>;
  onFilterPatch: (patch: Record<string, string>) => void;
  fullscreen?: boolean;
  onFullscreenChange?: (value: boolean) => void;
  filterCount?: number;
  onOpenFilters?: () => void;
  bulkActions?: { label: string; icon: Parameters<typeof Button>[0]["icon"]; onClick: () => void }[];
  /** When set, the horizontal scroll control portals into this element (e.g. pagination center). */
  hScrollPortal?: HTMLElement | null;
  /** First row number shown in the Excel-style gutter (e.g. (page - 1) * pageSize + 1). */
  rowNumberStart?: number;
  /**
   * Screening questions of the job currently filtered. Each becomes a column (`q:<id>`) whose
   * cells show that applicant's submitted answer. Empty when no single job is selected.
   */
  questions?: ScreeningQuestion[];
};

const EMPTY_QUESTIONS: ScreeningQuestion[] = [];

function daysLabel(value: number | null | undefined) {
  return value == null ? "—" : value === 0 ? "Immediate" : value + " days";
}

/** Answer as the applicant submitted it; yes/no answers are stored lowercase. */
function answerLabel(answer: string | undefined) {
  if (answer == null || answer === "") return "—";
  if (answer === "yes") return "Yes";
  if (answer === "no") return "No";
  return answer;
}

function screeningSummary(item: ResponseItem) {
  const answers = item.application.screeningAnswers ?? [];
  if (!answers.length) return "";
  return answers.map((a) => a.question + ": " + answerLabel(a.answer)).join(" · ");
}

/** Excel-style row-number gutter: sticky before the selection column, outside the column model. */
const ROW_NUMBER_WIDTH = 44;

type VisibilityState = Record<string, boolean>;
type ColumnSizingState = Record<string, number>;
type ColumnOrderState = string[];
type ColumnPinningState = { start: string[]; end: string[] };

function cellText(value: string | number | null | undefined, empty = "—") {
  if (value == null || value === "") return empty;
  return String(value);
}

/** Excel-style horizontal scrollbar for the responses table only (not page scroll). */
function ExcelTableHScroll({
  scrollRef,
  layoutKey,
  portal,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  layoutKey: string;
  portal?: HTMLElement | null;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ visible: false, scrollLeft: 0, maxScroll: 0, thumbRatio: 1 });
  const drag = useRef<{ pointerId: number; startX: number; startScroll: number } | null>(null);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    setState({
      visible: maxScroll > 2,
      scrollLeft: el.scrollLeft,
      maxScroll,
      thumbRatio: el.scrollWidth > 0 ? Math.min(1, Math.max(0.14, el.clientWidth / el.scrollWidth)) : 1,
    });
  }, [scrollRef]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    const onScroll = () => measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    ro?.observe(el);
    const table = el.querySelector("table");
    if (table) ro?.observe(table);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro?.disconnect();
    };
  }, [scrollRef, measure, layoutKey]);

  const scrollBy = (delta: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft += delta;
  };

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".response-excel-hscroll-thumb")) return;
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track || state.maxScroll <= 0) return;
    const rect = track.getBoundingClientRect();
    const thumbW = rect.width * state.thumbRatio;
    const x = event.clientX - rect.left - thumbW / 2;
    const ratio = Math.min(1, Math.max(0, x / Math.max(1, rect.width - thumbW)));
    el.scrollLeft = ratio * state.maxScroll;
  };

  const onThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const el = scrollRef.current;
    if (!el) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startScroll: el.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onThumbPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track || state.maxScroll <= 0) return;
    const trackW = track.getBoundingClientRect().width;
    const travel = Math.max(1, trackW * (1 - state.thumbRatio));
    const dx = event.clientX - drag.current.startX;
    el.scrollLeft = drag.current.startScroll + (dx / travel) * state.maxScroll;
  };

  const onThumbPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };

  if (!state.visible) return null;

  const thumbLeft =
    state.maxScroll <= 0 ? 0 : (state.scrollLeft / state.maxScroll) * (100 - state.thumbRatio * 100);

  const widget = (
    <div className="response-excel-hscroll" role="scrollbar" aria-orientation="horizontal" aria-controls="response-table-scroll" aria-valuemin={0} aria-valuemax={Math.round(state.maxScroll)} aria-valuenow={Math.round(state.scrollLeft)}>
      <button type="button" className="response-excel-hscroll-btn is-prev" aria-label="Scroll table left" onClick={() => scrollBy(-160)} disabled={state.scrollLeft <= 0}>
        <span aria-hidden>‹</span>
      </button>
      <div ref={trackRef} className="response-excel-hscroll-track" onPointerDown={onTrackPointerDown}>
        <div
          className="response-excel-hscroll-thumb"
          style={{ width: state.thumbRatio * 100 + "%", left: thumbLeft + "%" }}
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={onThumbPointerUp}
          onPointerCancel={onThumbPointerUp}
        />
      </div>
      <button type="button" className="response-excel-hscroll-btn is-next" aria-label="Scroll table right" onClick={() => scrollBy(160)} disabled={state.scrollLeft >= state.maxScroll - 1}>
        <span aria-hidden>›</span>
      </button>
    </div>
  );

  if (portal) return createPortal(widget, portal);
  return <div className="response-excel-hscroll-dock">{widget}</div>;
}

function measureTextWidth(text: string, font = "650 12px Manrope, DM Sans, sans-serif") {
  if (typeof document === "undefined") return text.length * 8;
  const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  if (!ctx) return text.length * 8;
  ctx.font = font;
  return Math.ceil(ctx.measureText(text).width);
}
measureTextWidth.canvas = null as HTMLCanvasElement | null;

function clampWidth(id: string, width: number) {
  return clampResponseTableWidth(id, width);
}

function HeaderMenu({
  columnId,
  label,
  children,
  onAutoFit,
  onHide,
  onResetWidth,
  onPinLeft,
  onPinRight,
  onUnpin,
  onSort,
  onFilter,
  canHide,
  canPin,
  pinned,
  sortOptions,
  contentExpandable = false,
  contentExpanded = false,
  onContentExpandToggle,
}: {
  columnId: ResponseTableAnyColumnId;
  label: string;
  children: ReactNode;
  onAutoFit: () => void;
  onHide: () => void;
  onResetWidth: () => void;
  onPinLeft: () => void;
  onPinRight: () => void;
  onUnpin: () => void;
  onSort?: (value: string) => void;
  onFilter?: () => void;
  canHide: boolean;
  canPin: boolean;
  pinned: false | "start" | "end";
  sortOptions?: { asc: string; desc: string };
  contentExpandable?: boolean;
  contentExpanded?: boolean;
  onContentExpandToggle?: () => void;
}) {
  void columnId;
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPos = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 176;
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    setMenuPos({ top: rect.bottom + 4, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    const onReposition = () => updateMenuPos();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updateMenuPos]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (root.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const menu = open && menuPos
    ? createPortal(
        <div
          ref={menuRef}
          className="response-grid-header-menu"
          role="menu"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {sortOptions && onSort ? (
            <>
              <button type="button" role="menuitem" onClick={() => { onSort(sortOptions.desc); setOpen(false); }}>
                Sort descending
              </button>
              <button type="button" role="menuitem" onClick={() => { onSort(sortOptions.asc); setOpen(false); }}>
                Sort ascending
              </button>
              <button type="button" role="menuitem" onClick={() => { onSort("newest"); setOpen(false); }}>
                Clear sorting
              </button>
            </>
          ) : null}
          {contentExpandable && onContentExpandToggle ? (
            <button type="button" role="menuitemcheckbox" aria-checked={contentExpanded} onClick={() => { onContentExpandToggle(); setOpen(false); }}>
              {contentExpanded ? "Collapse column content" : "Expand column content"}
            </button>
          ) : null}
          <button type="button" role="menuitem" onClick={() => { onAutoFit(); setOpen(false); }}>
            Auto-fit
          </button>
          <button type="button" role="menuitem" onClick={() => { onResetWidth(); setOpen(false); }}>
            Reset width
          </button>
          {canPin ? (
            pinned ? (
              <>
                <button type="button" role="menuitem" onClick={() => { onUnpin(); setOpen(false); }}>
                  Unpin
                </button>
                {pinned !== "start" ? (
                  <button type="button" role="menuitem" onClick={() => { onPinLeft(); setOpen(false); }}>
                    Pin left
                  </button>
                ) : null}
                {pinned !== "end" ? (
                  <button type="button" role="menuitem" onClick={() => { onPinRight(); setOpen(false); }}>
                    Pin right
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <button type="button" role="menuitem" onClick={() => { onPinLeft(); setOpen(false); }}>
                  Pin left
                </button>
                <button type="button" role="menuitem" onClick={() => { onPinRight(); setOpen(false); }}>
                  Pin right
                </button>
              </>
            )
          ) : null}
          {canHide ? (
            <button type="button" role="menuitem" onClick={() => { onHide(); setOpen(false); }}>
              Hide column
            </button>
          ) : null}
          {onFilter ? (
            <button type="button" role="menuitem" onClick={() => { onFilter(); setOpen(false); }}>
              Filter…
            </button>
          ) : null}
        </div>,
        document.body,
      )
    : null;

  return (
    <div
      className={
        "response-grid-header-cell" +
        (contentExpandable ? " is-content-expandable" : "") +
        (contentExpanded ? " is-content-expanded" : "")
      }
      ref={root}
      title={contentExpandable ? (contentExpanded ? "Double-click to collapse column content" : "Double-click to expand column content") : undefined}
      onDoubleClick={
        contentExpandable && onContentExpandToggle
          ? (event) => {
              // Anywhere on the header cell except its own controls (menu button, open menu).
              if ((event.target as HTMLElement).closest(".response-grid-header-menu-btn, .response-grid-header-menu")) return;
              event.preventDefault();
              event.stopPropagation();
              onContentExpandToggle();
            }
          : undefined
      }
    >
      <div className="response-grid-header-label">
        {children}
      </div>
      <button
        ref={buttonRef}
        type="button"
        className="response-grid-header-menu-btn"
        aria-label={"Column options for " + label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {/* Filled dots: the shared "more" glyph is stroke-only and vanishes without round caps. */}
        <svg className="response-grid-header-menu-dots" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="8" cy="3.5" r="1.25" />
          <circle cx="8" cy="8" r="1.25" />
          <circle cx="8" cy="12.5" r="1.25" />
        </svg>
      </button>
      {menu}
    </div>
  );
}

function SortableHeader({ id, disabled, children }: { id: string; disabled?: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="response-grid-sortable-header" {...(disabled ? {} : { ...attributes, ...listeners })}>
      {children}
    </div>
  );
}

function TableOptionsMenu({
  visibility,
  density,
  optional,
  labelFor,
  onVisibilityChange,
  onResetColumns,
  onDensityChange,
  onAutoFit,
  onFitWidth,
  onResetLayout,
}: {
  visibility: VisibilityState;
  density: ResponseTableDensity;
  optional: readonly ResponseTableAnyColumnId[];
  labelFor: (id: ResponseTableAnyColumnId) => string;
  onVisibilityChange: (id: ResponseTableAnyColumnId, visible: boolean) => void;
  onResetColumns: () => void;
  onDensityChange: (value: ResponseTableDensity) => void;
  onAutoFit: () => void;
  onFitWidth: () => void;
  onResetLayout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const list = optional.filter((id) => labelFor(id).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="response-grid-toolbar-menu" ref={root}>
      <Button variant="sm" icon="sliders" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        Table options
      </Button>
      {open ? (
        <div className="response-grid-popover response-grid-options-popover" role="menu" aria-label="Table options">
          <div className="response-grid-options-section">
            <p className="response-grid-options-label">Layout</p>
            <button type="button" role="menuitem" className="response-grid-options-item" onClick={() => { onAutoFit(); setOpen(false); }}>
              Auto-fit
            </button>
            <button type="button" role="menuitem" className="response-grid-options-item" onClick={() => { onFitWidth(); setOpen(false); }}>
              Fit width
            </button>
            <button type="button" role="menuitem" className="response-grid-options-item" onClick={() => { onResetLayout(); setOpen(false); }}>
              Reset layout
            </button>
          </div>
          <div className="response-grid-options-section" role="group" aria-label="Density">
            <p className="response-grid-options-label">Density</p>
            {([
              ["comfortable", "Comfortable"],
              ["compact", "Compact"],
              ["spacious", "Spacious"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={density === value}
                className={"response-grid-options-item" + (density === value ? " is-active" : "")}
                onClick={() => onDensityChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="response-grid-options-section" role="group" aria-label="Columns">
            <p className="response-grid-options-label">Columns</p>
            <input className="secondary-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search columns" aria-label="Search columns" />
            <ul className="response-grid-column-list">
              {RESPONSE_TABLE_MANDATORY.map((id) => (
                <li key={id}>
                  <label>
                    <input type="checkbox" checked disabled />
                    <span>{RESPONSE_TABLE_LABELS[id]}</span>
                  </label>
                </li>
              ))}
              {list.map((id) => (
                <li key={id}>
                  <label>
                    <input type="checkbox" checked={visibility[id] !== false} onChange={(e) => onVisibilityChange(id, e.target.checked)} />
                    <span>{labelFor(id)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" className="response-grid-options-item is-reset" onClick={onResetColumns}>
              Reset columns
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ColumnFilterDialog({
  columnId,
  values,
  onApply,
  onClose,
}: {
  columnId: ResponseTableColumnId;
  values: Record<string, string>;
  onApply: (patch: Record<string, string>) => void;
  onClose: () => void;
}) {
  const keys = RESPONSE_TABLE_FILTER_PARAMS[columnId] || [];
  const [draft, setDraft] = useState(() => Object.fromEntries(keys.map((key) => [key, values[key] || ""])));
  return (
    <div className="response-grid-filter-dialog stack">
      <h3>Filter · {RESPONSE_TABLE_LABELS[columnId]}</h3>
      {keys.map((key) => (
        <label key={key} className="field">
          <span>{key}</span>
          <input className="secondary-input" name={key} value={draft[key] || ""} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
        </label>
      ))}
      <div className="modal-footer">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          Apply filter
        </Button>
      </div>
    </div>
  );
}

function StatusCell({ item, onStatus }: { item: ResponseItem; onStatus: ResponseGridActions["status"] }) {
  const a = item.application;
  if (a.withdrawnAt) {
    return (
      <span className="response-grid-status-shell is-static" title="Withdrawn">
        <span className="response-grid-status-label">Withdrawn</span>
      </span>
    );
  }
  const next = (RECRUITING_RULES.transitions[a.status] as HiringStage[] | undefined) || [];
  const options = [a.status, ...next.filter((s) => s !== a.status)];
  if (next.length === 0) {
    return (
      <span className="response-grid-status-shell is-static" title={a.status}>
        <span className="response-grid-status-label">{a.status}</span>
      </span>
    );
  }
  return (
    <label className="response-grid-status-shell">
      <span className="response-grid-status-label" aria-hidden>
        {a.status}
      </span>
      <select
        className="response-grid-status"
        aria-label={"Status for " + item.profile.name}
        value={a.status}
        onChange={(e) => {
          const value = e.target.value as HiringStage;
          if (value !== a.status) void onStatus([a.id], value);
        }}
      >
        {options.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ResponseDataGrid({
  items,
  selection,
  allChecked,
  onSelect,
  onSelectAll,
  actions,
  sort,
  onSortChange,
  filterParams,
  onFilterPatch,
  fullscreen = false,
  onFullscreenChange,
  filterCount = 0,
  onOpenFilters,
  bulkActions = [],
  hScrollPortal = null,
  rowNumberStart = 1,
  questions = EMPTY_QUESTIONS,
}: Props) {
  const questionIds = useMemo(() => questions.map((q) => responseTableQuestionColumnId(q.id)), [questions]);
  const allColumnIds = useMemo<ResponseTableAnyColumnId[]>(() => [...RESPONSE_TABLE_COLUMN_IDS, ...questionIds], [questionIds]);
  const labelFor = useCallback((id: string) => responseTableColumnLabel(id, questions), [questions]);
  const session = useObservedSession();
  const message = useApplicationsMessage();
  const userId = session?.user.id;
  const identityId = session?.selected_identity_id ?? undefined;
  const [prefs, setPrefs] = useState<ResponseTablePrefs>(() => loadResponseTablePrefs(userId, identityId));
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [expansion, setExpansion] = useState<ResponseTableExpansionState>({ type: "none" });
  /** Row focused via the row-number gutter (Excel row header). Independent of checkbox selection. */
  const [activeRowId, setActiveRowId] = useState<Id | null>(null);

  useEffect(() => {
    setPrefs(loadResponseTablePrefs(userId, identityId));
  }, [userId, identityId]);

  const persist = useCallback(
    (next: ResponseTablePrefs) => {
      setPrefs(next);
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => saveResponseTablePrefs(next, userId, identityId), 350);
    },
    [userId, identityId],
  );

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => ({
    ...prefs.columnWidths,
    actions: RESPONSE_TABLE_DEFAULT_WIDTHS.actions,
    status: RESPONSE_TABLE_DEFAULT_WIDTHS.status,
  }));
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => prefs.columnVisibility);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => prefs.columnOrder);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(() => ({
    start: prefs.pinnedLeft,
    end: prefs.pinnedRight,
  }));
  const [density, setDensity] = useState<ResponseTableDensity>(prefs.density);

  /** The summary column is redundant while per-question columns are shown for one job. */
  const effectiveVisibility = useMemo<VisibilityState>(
    () => (questionIds.length ? { ...columnVisibility, screening: false } : columnVisibility),
    [columnVisibility, questionIds.length],
  );
  /** Saved order plus any columns it does not know yet (new fixed ones, this job's questions). */
  const effectiveOrder = useMemo<ColumnOrderState>(() => {
    const known = columnOrder.filter((id) => isResponseTableStaticColumnId(id) || (questionIds as readonly string[]).includes(id));
    const missing = allColumnIds.filter((id) => !known.includes(id));
    const middle = [...known, ...missing].filter((id) => id !== "select" && id !== "name" && id !== "actions");
    return ["select", "name", ...middle, "actions"];
  }, [columnOrder, questionIds, allColumnIds]);

  useEffect(() => {
    setColumnSizing({
      ...prefs.columnWidths,
      actions: RESPONSE_TABLE_DEFAULT_WIDTHS.actions,
      status: RESPONSE_TABLE_DEFAULT_WIDTHS.status,
    });
    setColumnVisibility(prefs.columnVisibility);
    setColumnOrder(prefs.columnOrder);
    setColumnPinning({ start: prefs.pinnedLeft, end: prefs.pinnedRight });
    setDensity(prefs.density);
  }, [prefs]);

  // Reconcile during render (not in an effect): an expanded row that left the page (filter,
  // pagination) or a hidden column drops the expansion before the stale target can paint.
  const staleExpansion =
    ((expansion.type === "cell" || expansion.type === "row") && !items.some((item) => item.application.id === expansion.rowId)) ||
    ((expansion.type === "cell" || expansion.type === "column") && columnVisibility[expansion.columnId] === false);
  if (staleExpansion) setExpansion({ type: "none" });
  if (activeRowId != null && !items.some((item) => item.application.id === activeRowId)) setActiveRowId(null);

  const dispatchExpansion = useCallback((action: Parameters<typeof toggleResponseTableExpansion>[1]) => {
    setExpansion((prev) => toggleResponseTableExpansion(prev, action));
  }, []);

  /** Expand the name column so the table fills the scrollport without stretching Actions. */
  const sizingToFillWidth = useCallback(
    (prev: ColumnSizingState): ColumnSizingState => {
      const el = tableWrapRef.current;
      if (!el) {
        return { ...prev, actions: RESPONSE_TABLE_DEFAULT_WIDTHS.actions, status: RESPONSE_TABLE_DEFAULT_WIDTHS.status };
      }
      const available = el.clientWidth - 2 - ROW_NUMBER_WIDTH;
      if (available <= 0) {
        return { ...prev, actions: RESPONSE_TABLE_DEFAULT_WIDTHS.actions, status: RESPONSE_TABLE_DEFAULT_WIDTHS.status };
      }
      const visible = allColumnIds.filter((id) => effectiveVisibility[id] !== false);
      const otherWidth = visible
        .filter((id) => id !== "name")
        .reduce((sum, id) => {
          if (id === "actions") return sum + RESPONSE_TABLE_DEFAULT_WIDTHS.actions;
          if (id === "status") return sum + RESPONSE_TABLE_DEFAULT_WIDTHS.status;
          return sum + (prev[id] ?? responseTableDefaultWidth(id));
        }, 0);
      const nameWidth = clampWidth("name", Math.max(RESPONSE_TABLE_MIN_WIDTHS.name, available - otherWidth));
      if (
        Math.abs((prev.name ?? 0) - nameWidth) < 1 &&
        prev.actions === RESPONSE_TABLE_DEFAULT_WIDTHS.actions &&
        prev.status === RESPONSE_TABLE_DEFAULT_WIDTHS.status
      ) {
        return prev;
      }
      return {
        ...prev,
        name: nameWidth,
        actions: RESPONSE_TABLE_DEFAULT_WIDTHS.actions,
        status: RESPONSE_TABLE_DEFAULT_WIDTHS.status,
      };
    },
    [allColumnIds, effectiveVisibility],
  );

  const fillRemainingWidth = useCallback(() => {
    setColumnSizing((prev) => sizingToFillWidth(prev));
  }, [sizingToFillWidth]);

  useLayoutEffect(() => {
    const el = tableWrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      fillRemainingWidth();
      return;
    }
    const observer = new ResizeObserver(() => fillRemainingWidth());
    observer.observe(el);
    fillRemainingWidth();
    return () => observer.disconnect();
  }, [fillRemainingWidth, columnOrder, items.length, fullscreen]);

  const syncPrefs = useCallback(
    (patch: Partial<ResponseTablePrefs>) => {
      persist({
        ...prefs,
        columnWidths: { ...prefs.columnWidths, ...columnSizing },
        columnVisibility: { ...prefs.columnVisibility, ...columnVisibility },
        columnOrder: columnOrder as string[],
        pinnedLeft: columnPinning.start,
        pinnedRight: columnPinning.end,
        density,
        ...patch,
      });
    },
    [prefs, columnSizing, columnVisibility, columnOrder, columnPinning, density, persist],
  );

  const columns = useMemo<LegacyColumnDef<ResponseItem>[]>(() => {
    const defs: LegacyColumnDef<ResponseItem>[] = [
      {
        id: "select",
        header: () => null,
        cell: ({ row }) => {
          const id = row.original.application.id;
          return <input type="checkbox" checked={selection.includes(id)} aria-label={"Select " + row.original.profile.name} onChange={(e) => onSelect(id, e.target.checked)} />;
        },
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.select,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.select,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.select,
        enableResizing: false,
        enableSorting: false,
      },
      {
        id: "name",
        header: "Name",
        accessorFn: (row) => row.profile.name,
        cell: ({ row }) => (
          <Link
            href={applicantProfileHref(row.original)}
            className="response-table-name"
            onClick={(event) => {
              if (event.detail > 1) {
                event.preventDefault();
                return;
              }
              void actions.markViewed(row.original.application.id);
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
            }}
          >
            <Avatar person={row.original.profile} />
            <span>{row.original.profile.name}</span>
          </Link>
        ),
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.name,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.name,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.name,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusCell item={row.original} onStatus={actions.status} />,
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.status,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.status,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.status,
        enableResizing: false,
      },
      {
        id: "jobApplied",
        header: "Job applied",
        accessorFn: (row) => row.jobTitle,
        cell: ({ getValue }) => cellText(getValue<string>()),
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.jobApplied,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.jobApplied,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.jobApplied,
      },
      {
        id: "experience",
        header: "Experience",
        accessorFn: (row) => row.profile.years,
        cell: ({ getValue }) => getValue<number>() + " years",
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.experience,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.experience,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.experience,
      },
      {
        id: "education",
        header: "Education",
        accessorFn: (row) => row.profile.educationText,
        cell: ({ getValue }) => {
          const text = cellText(getValue<string | null>());
          return <span title={text === "—" ? undefined : text}>{text}</span>;
        },
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.education,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.education,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.education,
      },
      {
        id: "designation",
        header: "Designation",
        accessorFn: (row) => row.profile.designation,
        cell: ({ getValue }) => cellText(getValue<string | null | undefined>()),
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.designation,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.designation,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.designation,
      },
      {
        id: "location",
        header: "Location",
        cell: ({ row }) => {
          const p = row.original.profile;
          const location = [p.location?.trim(), p.locality].filter(Boolean).join(" · ");
          const distance = row.original.distance;
          return (
            <span title={location || undefined}>
              {location || "—"}
              {distance ? <span className="response-table-distance"> · {distance.km} km</span> : null}
            </span>
          );
        },
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.location,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.location,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.location,
      },
      {
        id: "notice",
        header: "Notice",
        cell: ({ row }) => {
          const notice = row.original.profile.notice;
          return notice == null ? "—" : notice === 0 ? "Immediate" : notice + " days";
        },
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.notice,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.notice,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.notice,
      },
      {
        id: "skills",
        header: "Skills",
        cell: ({ row }) => {
          const skills = row.original.profile.skills.join(" · ");
          return (
            <span className="response-table-skills" title={skills || undefined}>
              {skills || "—"}
            </span>
          );
        },
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.skills,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.skills,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.skills,
      },
      {
        id: "applied",
        header: "Applied",
        accessorFn: (row) => row.application.createdAt,
        cell: ({ row }) => formatLocaleDate(row.original.application.createdAt),
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.applied,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.applied,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.applied,
      },
      {
        id: "joining",
        header: RESPONSE_TABLE_LABELS.joining,
        cell: ({ row }) => daysLabel(row.original.profile.joining),
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.joining,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.joining,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.joining,
      },
      {
        id: "preferredLocations",
        header: RESPONSE_TABLE_LABELS.preferredLocations,
        accessorFn: (row) => row.profile.preferredLocations,
        cell: ({ getValue }) => {
          const text = cellText(getValue<string | null | undefined>());
          return <span title={text === "—" ? undefined : text}>{text}</span>;
        },
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.preferredLocations,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.preferredLocations,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.preferredLocations,
      },
      {
        id: "phone",
        header: RESPONSE_TABLE_LABELS.phone,
        accessorFn: (row) => row.profile.phone,
        cell: ({ getValue }) => cellText(getValue<string | null | undefined>()),
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.phone,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.phone,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.phone,
      },
      {
        id: "email",
        header: RESPONSE_TABLE_LABELS.email,
        accessorFn: (row) => row.profile.email,
        cell: ({ getValue }) => {
          const text = cellText(getValue<string | null | undefined>());
          return <span title={text === "—" ? undefined : text}>{text}</span>;
        },
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.email,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.email,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.email,
      },
      {
        id: "introduction",
        header: RESPONSE_TABLE_LABELS.introduction,
        accessorFn: (row) => row.application.note,
        cell: ({ getValue }) => {
          const text = cellText(getValue<string | null | undefined>());
          return <span title={text === "—" ? undefined : text}>{text}</span>;
        },
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.introduction,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.introduction,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.introduction,
      },
      {
        id: "screening",
        header: RESPONSE_TABLE_LABELS.screening,
        accessorFn: (row) => screeningSummary(row),
        cell: ({ getValue }) => {
          const text = cellText(getValue<string>());
          return <span title={text === "—" ? undefined : text}>{text}</span>;
        },
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.screening,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.screening,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.screening,
      },
      {
        id: "resume",
        header: RESPONSE_TABLE_LABELS.resume,
        cell: ({ row }) => {
          const item = row.original;
          const resume = item.sharing?.attachments.find((file) => file.kind === "resume");
          if (!resume) return "—";
          return (
            <IconButton
              icon="file"
              label={"View submitted resume: " + resume.name}
              extra="response-table-resume"
              onClick={() => openResume(item)}
            />
          );
        },
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.resume,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.resume,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.resume,
        enableResizing: false,
      },
      ...questions.map<LegacyColumnDef<ResponseItem>>((question) => ({
        id: responseTableQuestionColumnId(question.id),
        header: question.text,
        accessorFn: (row) => row.application.screeningAnswers?.find((a) => a.id === question.id)?.answer ?? "",
        cell: ({ getValue }) => {
          const text = answerLabel(getValue<string>());
          return <span title={text === "—" ? undefined : text}>{text}</span>;
        },
        size: RESPONSE_TABLE_QUESTION_WIDTHS.default,
        minSize: RESPONSE_TABLE_QUESTION_WIDTHS.min,
        maxSize: RESPONSE_TABLE_QUESTION_WIDTHS.max,
      })),
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const item = row.original;
          const p = item.profile;
          return (
            <div className="response-table-actions">
              <CandidateProfileActions
                iconOnly
                item={item}
                onContact={() => void actions.contact(item)}
                onMessage={() =>
                  void message(p.id, {
                    name: p.name,
                    picture: p.picture,
                    headline: p.designation || p.headline,
                  })
                }
                onMarkViewed={(id) => actions.markViewed(id)}
              />
            </div>
          );
        },
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.actions,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.actions,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.actions,
        enableResizing: false,
      },
    ];
    return defs;
  }, [actions, message, onSelect, selection, questions]);

  const table = useLegacyTable({
    data: items,
    columns,
    state: { columnSizing, columnVisibility: effectiveVisibility, columnOrder: effectiveOrder, columnPinning },
    onColumnSizingChange: (updater) => {
      setColumnSizing((prev) => {
        const next = {
          ...(typeof updater === "function" ? updater(prev) : updater),
          actions: RESPONSE_TABLE_DEFAULT_WIDTHS.actions,
          status: RESPONSE_TABLE_DEFAULT_WIDTHS.status,
        };
        syncPrefs({ columnWidths: { ...RESPONSE_TABLE_DEFAULT_WIDTHS, ...next } });
        return next;
      });
    },
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        for (const id of RESPONSE_TABLE_MANDATORY) next[id] = true;
        syncPrefs({ columnVisibility: next as Record<string, boolean> });
        return next;
      });
    },
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.application.id,
    defaultColumn: { enableResizing: true },
  });

  const autoFitColumn = useCallback(
    (columnId: string) => {
      if (columnId === "actions" || columnId === "resume") {
        const nextWidth =
          columnId === "actions"
            ? RESPONSE_TABLE_DEFAULT_WIDTHS.actions
            : RESPONSE_TABLE_DEFAULT_WIDTHS.resume;
        setColumnSizing((prev) => {
          const next = { ...prev, [columnId]: nextWidth };
          syncPrefs({ columnWidths: { ...RESPONSE_TABLE_DEFAULT_WIDTHS, ...next } });
          return next;
        });
        return;
      }
      const header = labelFor(columnId);
      const questionId = responseTableQuestionIdOf(columnId);
      let width = measureTextWidth(questionId ? header.slice(0, 40) : header) + 48;
      for (const item of items) {
        let text = "";
        if (questionId) {
          text = answerLabel(item.application.screeningAnswers?.find((a) => a.id === questionId)?.answer);
        } else switch (columnId) {
          case "name":
            text = item.profile.name;
            break;
          case "status":
            text = item.application.withdrawnAt ? "Withdrawn" : item.application.status;
            break;
          case "jobApplied":
            text = item.jobTitle;
            break;
          case "experience":
            text = item.profile.years + " years";
            break;
          case "education":
            text = item.profile.educationText || "";
            break;
          case "designation":
            text = item.profile.designation || "";
            break;
          case "location":
            text = [item.profile.location, item.profile.locality].filter(Boolean).join(" · ");
            break;
          case "notice":
            text = item.profile.notice == null ? "—" : String(item.profile.notice);
            break;
          case "skills":
            text = item.profile.skills.slice(0, 4).join(" · ");
            break;
          case "applied":
            text = formatLocaleDate(item.application.createdAt);
            break;
          case "joining":
            text = daysLabel(item.profile.joining);
            break;
          case "preferredLocations":
            text = item.profile.preferredLocations || "";
            break;
          case "phone":
            text = item.profile.phone || "";
            break;
          case "email":
            text = item.profile.email || "";
            break;
          case "introduction":
            text = (item.application.note || "").slice(0, 60);
            break;
          case "screening":
            text = screeningSummary(item).slice(0, 60);
            break;
          default:
            text = "";
        }
        width = Math.max(width, measureTextWidth(text, "400 13px DM Sans, sans-serif") + 28);
      }
      const nextWidth = clampWidth(columnId, width);
      setColumnSizing((prev) => {
        const next = { ...prev, [columnId]: nextWidth };
        syncPrefs({ columnWidths: { ...RESPONSE_TABLE_DEFAULT_WIDTHS, ...next } });
        return next;
      });
    },
    [items, syncPrefs, labelFor],
  );

  const autoFitAll = () => {
    for (const id of allColumnIds) {
      if (effectiveVisibility[id] === false) continue;
      autoFitColumn(id);
    }
  };

  const fitAvailableWidth = () => {
    setColumnSizing((prev) => {
      const next = sizingToFillWidth(prev);
      syncPrefs({ columnWidths: { ...RESPONSE_TABLE_DEFAULT_WIDTHS, ...next } });
      return next;
    });
  };

  const resetLayout = () => {
    clearResponseTablePrefs(userId, identityId);
    const defaults = defaultResponseTablePrefs();
    persist(defaults);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === "select" || activeId === "name" || activeId === "actions") return;
    if (overId === "select" || overId === "name" || overId === "actions") return;
    const oldIndex = effectiveOrder.indexOf(activeId);
    const newIndex = effectiveOrder.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(effectiveOrder, oldIndex, newIndex);
    const middle = next.filter((id) => id !== "select" && id !== "name" && id !== "actions");
    const normalized = ["select", "name", ...middle, "actions"];
    setColumnOrder(normalized);
    syncPrefs({ columnOrder: normalized });
  };

  const openFilter = (columnId: ResponseTableAnyColumnId) => {
    if (!isResponseTableStaticColumnId(columnId) || !RESPONSE_TABLE_FILTER_PARAMS[columnId]) return;
    modal.show(
      "Filter · " + RESPONSE_TABLE_LABELS[columnId],
      <ColumnFilterDialog
        columnId={columnId}
        values={filterParams}
        onApply={onFilterPatch}
        onClose={() => modal.close()}
      />,
    );
  };

  const pinColumn = (columnId: ResponseTableAnyColumnId, side: "left" | "right" | "none") => {
    if (RESPONSE_TABLE_MANDATORY.includes(columnId as (typeof RESPONSE_TABLE_MANDATORY)[number])) return;
    setColumnPinning((prev) => {
      const start = (prev.start || []).filter((id) => id !== columnId && id !== "actions");
      const end = (prev.end || []).filter((id) => id !== columnId && id !== "select" && id !== "name");
      if (side === "left") start.push(columnId);
      else if (side === "right") end.unshift(columnId);
      const next = {
        start: ["select", "name", ...start.filter((id) => id !== "select" && id !== "name")],
        end: [...end.filter((id) => id !== "actions"), "actions"],
      };
      syncPrefs({ pinnedLeft: next.start, pinnedRight: next.end });
      return next;
    });
  };

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  const sortableIds = effectiveOrder.filter((id) => id !== "select" && id !== "name" && id !== "actions");

  const pinStyle = (
    column: { id: string; getIsPinned: () => false | "start" | "end"; getStart: (pos?: "start" | "end") => number; getAfter: (pos?: "start" | "end") => number },
    zIndex: number,
  ): CSSProperties => {
    const pinned = column.getIsPinned();
    if (!pinned) return {};
    const style: CSSProperties = { position: "sticky", zIndex };
    if (pinned === "start") {
      // Pull Name (and later start pins) 1px left so a subpixel sticky seam cannot show the white table bg.
      const start = column.getStart("start") + ROW_NUMBER_WIDTH;
      style.left = (column.id === "select" ? start : Math.max(0, start - 1)) + "px";
    }
    if (pinned === "end") style.right = column.getAfter("end") + "px";
    return style;
  };

  return (
    <div className={"response-data-grid density-" + density}>
      <div className="response-grid-toolbar">
        <div className="response-grid-toolbar-start">
          <label className="response-grid-select-all">
            <input
              type="checkbox"
              checked={allChecked}
              disabled={!items.length}
              aria-label="Select all applicants on this page"
              onChange={(e) => onSelectAll(e.target.checked)}
            />
            Select all
          </label>
          {selection.length ? (
            <div className="response-grid-bulk-actions">
              <span className="response-selection-count">{selection.length} selected</span>
              {bulkActions.map((action, index) => (
                <span key={action.label} className="response-grid-bulk-item">
                  {index > 0 ? <span className="response-grid-bulk-sep" aria-hidden="true" /> : null}
                  <Button variant="text sm" icon={action.icon} onClick={action.onClick}>
                    {action.label}
                  </Button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="response-grid-toolbar-end">
          {onOpenFilters ? (
            <Button className="response-filter-toggle" variant="sm" icon="sliders" onClick={onOpenFilters} aria-haspopup="dialog">
              Filters{filterCount ? ` (${filterCount})` : ""}
            </Button>
          ) : null}
          {onFullscreenChange ? (
            <IconButton
              icon={fullscreen ? "compress" : "expand"}
              label={fullscreen ? "Exit full screen table" : "Full screen table"}
              onClick={() => onFullscreenChange(!fullscreen)}
            />
          ) : null}
          <TableOptionsMenu
            visibility={effectiveVisibility}
            density={density}
            optional={[...RESPONSE_TABLE_OPTIONAL, ...questionIds]}
            labelFor={labelFor}
            onVisibilityChange={(id, visible) => {
              table.getColumn(id)?.toggleVisibility(visible);
            }}
            onResetColumns={() => {
              const defaults = defaultResponseTablePrefs();
              setColumnVisibility(defaults.columnVisibility);
              syncPrefs({ columnVisibility: defaults.columnVisibility });
            }}
            onDensityChange={(next) => {
              setDensity(next);
              syncPrefs({ density: next });
            }}
            onAutoFit={autoFitAll}
            onFitWidth={fitAvailableWidth}
            onResetLayout={resetLayout}
          />
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="response-table-scroll-shell">
        <div
          ref={tableWrapRef}
          id="response-table-scroll"
          className="response-table-wrap response-grid-scroll has-excel-hscroll"
          onWheel={(e) => {
            if (!e.shiftKey || !tableWrapRef.current) return;
            tableWrapRef.current.scrollLeft += e.deltaY;
            e.preventDefault();
          }}
        >
          <table
            className="response-table response-data-table"
            aria-label="Applicant responses"
            style={{ width: "100%", minWidth: table.getTotalSize() + ROW_NUMBER_WIDTH }}
          >
            <thead>
              {headerGroups.map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <th
                    className="response-table-rownum"
                    style={{ width: ROW_NUMBER_WIDTH, minWidth: ROW_NUMBER_WIDTH, maxWidth: ROW_NUMBER_WIDTH, position: "sticky", left: 0, zIndex: 5 }}
                    aria-label="Row number"
                    scope="col"
                  >
                    <span aria-hidden>#</span>
                  </th>
                  <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map((header) => {
                      const id = header.column.id as ResponseTableAnyColumnId;
                      const label = labelFor(id);
                      const pinned = header.column.getIsPinned();
                      const colSize =
                        id === "actions"
                          ? RESPONSE_TABLE_DEFAULT_WIDTHS.actions
                          : id === "status"
                            ? RESPONSE_TABLE_DEFAULT_WIDTHS.status
                            : header.getSize();
                      const columnExpanded = isResponseTableColumnExpanded(expansion, id);
                      const contentExpandable = isResponseTableContentExpandable(id);
                      const style: CSSProperties = {
                        width: colSize,
                        maxWidth:
                          id === "actions"
                            ? RESPONSE_TABLE_DEFAULT_WIDTHS.actions
                            : id === "status"
                              ? RESPONSE_TABLE_DEFAULT_WIDTHS.status
                              : undefined,
                        ...pinStyle(header.column, pinned ? 4 : 1),
                        background: columnExpanded ? "#3F5168" : "#4A5361",
                      };
                      // Solid fill closes the sticky seam between Select and Name (white table bg otherwise shows through).
                      if (pinned === "start" && id === "select") style.boxShadow = "8px 0 0 0 #4A5361";
                      if (pinned === "start" && id === "name") style.boxShadow = "2px 0 4px #202a3610";
                      if (pinned === "end" && id === "actions") style.boxShadow = "-2px 0 4px #202a3610";
                      const canHide = !(RESPONSE_TABLE_MANDATORY as readonly string[]).includes(id);
                      const canPin = canHide;
                      const sortOptions = isResponseTableStaticColumnId(id) ? RESPONSE_TABLE_SORTABLE[id] : undefined;
                      const thClass = [
                        id === "select" ? "response-table-select" : "",
                        id === "actions" ? "response-table-actions-cell" : "",
                        id === "status" ? "response-table-status-cell" : "",
                        columnExpanded ? "is-column-expanded is-content-expanded" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <th
                          key={header.id}
                          style={style}
                          className={thClass || undefined}
                          data-expanded={columnExpanded ? "column" : undefined}
                          colSpan={header.colSpan}
                        >
                          {header.isPlaceholder ? null : id === "select" ? (
                            <div className="response-grid-header-cell response-grid-select-header">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </div>
                          ) : (
                            <SortableHeader id={id} disabled={!canHide}>
                              <HeaderMenu
                                columnId={id}
                                label={label}
                                canHide={canHide}
                                canPin={canPin}
                                pinned={pinned}
                                sortOptions={sortOptions}
                                onSort={onSortChange}
                                onAutoFit={() => autoFitColumn(id)}
                                onResetWidth={() => {
                                  const width = responseTableDefaultWidth(id);
                                  setColumnSizing((prev) => {
                                    const next = { ...prev, [id]: width };
                                    syncPrefs({ columnWidths: { ...RESPONSE_TABLE_DEFAULT_WIDTHS, ...next } });
                                    return next;
                                  });
                                }}
                                onHide={() => table.getColumn(id)?.toggleVisibility(false)}
                                onPinLeft={() => pinColumn(id, "left")}
                                onPinRight={() => pinColumn(id, "right")}
                                onUnpin={() => pinColumn(id, "none")}
                                onFilter={isResponseTableStaticColumnId(id) && RESPONSE_TABLE_FILTER_PARAMS[id] ? () => openFilter(id) : undefined}
                                contentExpandable={contentExpandable}
                                contentExpanded={columnExpanded}
                                onContentExpandToggle={() => dispatchExpansion({ type: "toggle-column", columnId: id })}
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {pinned ? (
                                  <span className="response-grid-pin-mark" title={pinned === "start" ? "Pinned left" : "Pinned right"} aria-hidden>
                                    <Icon name="pin" />
                                  </span>
                                ) : null}
                                {sortOptions && (sort === sortOptions.asc || sort === sortOptions.desc) ? (
                                  <span className="response-grid-sort-mark" aria-hidden>
                                    {sort === sortOptions.asc ? " ↑" : " ↓"}
                                  </span>
                                ) : null}
                              </HeaderMenu>
                            </SortableHeader>
                          )}
                          {header.column.getCanResize() ? (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              onDoubleClick={(event) => {
                                event.stopPropagation();
                                autoFitColumn(id);
                              }}
                              className={"response-grid-resizer" + (header.column.getIsResizing() ? " is-resizing" : "")}
                              role="separator"
                              aria-orientation="vertical"
                              aria-label={"Resize " + label}
                            />
                          ) : null}
                        </th>
                      );
                    })}
                  </SortableContext>
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const selected = selection.includes(row.original.application.id);
                const active = activeRowId === row.original.application.id;
                const rowExpanded = isResponseTableRowExpanded(expansion, row.id);
                const rowNumber = rowNumberStart + rowIndex;
                return (
                  <tr key={row.id} data-response-id={row.id} data-selected={selected || undefined} data-active={active || undefined}>
                    <td
                      className={"response-table-rownum" + (active ? " is-active" : "") + (rowExpanded ? " is-row-expanded" : "")}
                      style={{ width: ROW_NUMBER_WIDTH, minWidth: ROW_NUMBER_WIDTH, maxWidth: ROW_NUMBER_WIDTH, position: "sticky", left: 0, zIndex: 3 }}
                    >
                      <button
                        type="button"
                        className="response-table-rownum-btn"
                        aria-label={(active ? "Deselect row " : "Select row ") + rowNumber + ", " + row.original.profile.name}
                        aria-pressed={active}
                        aria-expanded={rowExpanded}
                        title={(active ? "Click to clear row highlight" : "Click to highlight this row") + " · Double-click to " + (rowExpanded ? "collapse" : "expand") + " row content"}
                        onClick={(event) => {
                          // The second click of a double-click must not undo the first one's highlight.
                          if (event.detail > 1) return;
                          setActiveRowId((prev) => (prev === row.original.application.id ? null : row.original.application.id));
                        }}
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          setActiveRowId(row.original.application.id);
                          dispatchExpansion({ type: "toggle-row", rowId: row.id });
                        }}
                      >
                        {rowNumber}
                      </button>
                    </td>
                    {row.getVisibleCells().map((cell) => {
                      const id = cell.column.id as ResponseTableAnyColumnId;
                      const pinned = cell.column.getIsPinned();
                      const contentExpandable = isResponseTableContentExpandable(id);
                      const cellExpanded = isResponseTableCellExpanded(expansion, row.id, id);
                      const columnExpanded = isResponseTableColumnExpanded(expansion, id);
                      const contentExpanded = cellExpanded;
                      const style: CSSProperties = {
                        width:
                          id === "actions"
                            ? RESPONSE_TABLE_DEFAULT_WIDTHS.actions
                            : id === "status"
                              ? RESPONSE_TABLE_DEFAULT_WIDTHS.status
                              : cell.column.getSize(),
                        maxWidth:
                          id === "actions"
                            ? RESPONSE_TABLE_DEFAULT_WIDTHS.actions
                            : id === "status"
                              ? RESPONSE_TABLE_DEFAULT_WIDTHS.status
                              : undefined,
                        ...pinStyle(cell.column, pinned ? 2 : 0),
                        background: contentExpanded ? "#E8F0FE" : active ? "#DCE8FF" : selected ? "#EDF4FF" : pinned ? "#fff" : undefined,
                      };
                      if (pinned === "start" && id === "select") {
                        style.boxShadow = `8px 0 0 0 ${active ? "#DCE8FF" : selected ? "#EDF4FF" : "#fff"}`;
                      }
                      if (pinned === "start" && id === "name") style.boxShadow = "2px 0 4px #202a3608";
                      if (pinned === "end" && id === "actions") style.boxShadow = "-2px 0 4px #202a3608";
                      const tdClass = [
                        id === "select" ? "response-table-select" : "",
                        id === "actions" ? "response-table-actions-cell" : "",
                        id === "status" ? "response-table-status-cell" : "",
                        contentExpandable ? "is-content-expandable" : "",
                        expansion.type === "cell" && cellExpanded ? "is-cell-expanded is-content-expanded" : "",
                        expansion.type === "row" && cellExpanded ? "is-row-expanded is-content-expanded" : "",
                        columnExpanded ? "is-column-expanded is-content-expanded" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <td
                          key={cell.id}
                          style={style}
                          className={tdClass || undefined}
                          data-expanded={contentExpanded ? expansion.type : undefined}
                          tabIndex={contentExpandable ? 0 : undefined}
                          title={contentExpandable && !contentExpanded ? "Double-click to expand" : undefined}
                          aria-expanded={contentExpandable ? contentExpanded : undefined}
                          onDoubleClick={
                            contentExpandable
                              ? (event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  dispatchExpansion({ type: "toggle-cell", rowId: row.id, columnId: id });
                                }
                              : undefined
                          }
                          onKeyDown={
                            contentExpandable
                              ? (event) => {
                                  if (event.target !== event.currentTarget) return;
                                  if (event.key !== "Enter" && event.key !== " ") return;
                                  event.preventDefault();
                                  dispatchExpansion({ type: "toggle-cell", rowId: row.id, columnId: id });
                                }
                              : undefined
                          }
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ExcelTableHScroll
          scrollRef={tableWrapRef}
          portal={hScrollPortal}
          layoutKey={[effectiveOrder.join(","), JSON.stringify(columnSizing), JSON.stringify(columnVisibility), table.getTotalSize(), items.length].join("|")}
        />
        </div>
      </DndContext>
    </div>
  );
}
