"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
import { sharedPayLabel } from "@/features/applications/application-sharing-details";
import { Avatar, Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { modal } from "@/stores/modal-store";
import { formatLocaleDate } from "@/lib/utils/date";
import { RECRUITING_RULES } from "@/lib/validation/recruiting";
import type { HiringStage, Id } from "@/types/domain";
import { applicantProfileHref, type ResponseItem } from "@/services/recruiting/recruiting.service";
import { CandidateProfileActions } from "./candidate-profile-actions";
import { useApplicationsMessage } from "./use-applications-message";
import { clearResponseTablePrefs, loadResponseTablePrefs, saveResponseTablePrefs } from "./response-table-prefs";
import {
  defaultResponseTablePrefs,
  RESPONSE_TABLE_COLUMN_IDS,
  RESPONSE_TABLE_DEFAULT_WIDTHS,
  RESPONSE_TABLE_FILTER_PARAMS,
  RESPONSE_TABLE_LABELS,
  RESPONSE_TABLE_MANDATORY,
  RESPONSE_TABLE_MAX_WIDTHS,
  RESPONSE_TABLE_MIN_WIDTHS,
  RESPONSE_TABLE_OPTIONAL,
  RESPONSE_TABLE_SORTABLE,
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
  total?: number;
};

type VisibilityState = Record<string, boolean>;
type ColumnSizingState = Record<string, number>;
type ColumnOrderState = string[];
type ColumnPinningState = { start: string[]; end: string[] };

function cellText(value: string | number | null | undefined, empty = "—") {
  if (value == null || value === "") return empty;
  return String(value);
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

function clampWidth(id: ResponseTableColumnId, width: number) {
  return Math.min(RESPONSE_TABLE_MAX_WIDTHS[id], Math.max(RESPONSE_TABLE_MIN_WIDTHS[id], Math.round(width)));
}

function HeaderMenu({
  columnId,
  children,
  onAutoFit,
  onHide,
  onResetWidth,
  onPinLeft,
  onPinRight,
  onSort,
  onFilter,
  canHide,
  canPin,
  sortOptions,
}: {
  columnId: ResponseTableColumnId;
  children: ReactNode;
  onAutoFit: () => void;
  onHide: () => void;
  onResetWidth: () => void;
  onPinLeft: () => void;
  onPinRight: () => void;
  onSort?: (value: string) => void;
  onFilter?: () => void;
  canHide: boolean;
  canPin: boolean;
  sortOptions?: { asc: string; desc: string };
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div className="response-grid-header-cell" ref={root}>
      <div className="response-grid-header-label">{children}</div>
      <button type="button" className="response-grid-header-menu-btn" aria-label={"Column options for " + RESPONSE_TABLE_LABELS[columnId]} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="more" />
      </button>
      {open ? (
        <div className="response-grid-header-menu" role="menu">
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
          <button type="button" role="menuitem" onClick={() => { onAutoFit(); setOpen(false); }}>
            Auto-fit
          </button>
          <button type="button" role="menuitem" onClick={() => { onResetWidth(); setOpen(false); }}>
            Reset width
          </button>
          {canPin ? (
            <>
              <button type="button" role="menuitem" onClick={() => { onPinLeft(); setOpen(false); }}>
                Pin left
              </button>
              <button type="button" role="menuitem" onClick={() => { onPinRight(); setOpen(false); }}>
                Pin right
              </button>
            </>
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
        </div>
      ) : null}
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

function ColumnVisibilityPanel({
  visibility,
  onChange,
  onReset,
}: {
  visibility: VisibilityState;
  onChange: (id: ResponseTableColumnId, visible: boolean) => void;
  onReset: () => void;
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
  const list = RESPONSE_TABLE_OPTIONAL.filter((id) => RESPONSE_TABLE_LABELS[id].toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="response-grid-toolbar-menu" ref={root}>
      <Button variant="sm" icon="layout" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Columns
      </Button>
      {open ? (
        <div className="response-grid-popover" role="dialog" aria-label="Column visibility">
          <input className="secondary-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search columns" aria-label="Search columns" />
          <ul className="response-grid-column-list">
            {RESPONSE_TABLE_MANDATORY.map((id) => (
              <li key={id}>
                <label>
                  <input type="checkbox" checked disabled />
                  {RESPONSE_TABLE_LABELS[id]}
                </label>
              </li>
            ))}
            {list.map((id) => (
              <li key={id}>
                <label>
                  <input type="checkbox" checked={visibility[id] !== false} onChange={(e) => onChange(id, e.target.checked)} />
                  {RESPONSE_TABLE_LABELS[id]}
                </label>
              </li>
            ))}
          </ul>
          <Button variant="text sm" onClick={onReset}>
            Reset columns
          </Button>
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
  if (a.withdrawnAt) return <span>Withdrawn</span>;
  const next = (RECRUITING_RULES.transitions[a.status] as HiringStage[] | undefined) || [];
  const options = [a.status, ...next.filter((s) => s !== a.status)];
  if (next.length === 0) return <span>{a.status}</span>;
  return (
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
  total,
}: Props) {
  const session = useObservedSession();
  const message = useApplicationsMessage();
  const userId = session?.user.id;
  const identityId = session?.selected_identity_id ?? undefined;
  const [prefs, setPrefs] = useState<ResponseTablePrefs>(() => loadResponseTablePrefs(userId, identityId));
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);

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

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => prefs.columnWidths);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => prefs.columnVisibility);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => prefs.columnOrder);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(() => ({
    start: prefs.pinnedLeft,
    end: prefs.pinnedRight,
  }));
  const [density, setDensity] = useState<ResponseTableDensity>(prefs.density);

  useEffect(() => {
    setColumnSizing(prefs.columnWidths);
    setColumnVisibility(prefs.columnVisibility);
    setColumnOrder(prefs.columnOrder);
    setColumnPinning({ start: prefs.pinnedLeft, end: prefs.pinnedRight });
    setDensity(prefs.density);
  }, [prefs]);

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
        header: () => <input type="checkbox" checked={allChecked} disabled={!items.length} aria-label="Select all applicants" onChange={(e) => onSelectAll(e.target.checked)} />,
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
            onClick={() => void actions.markViewed(row.original.application.id)}
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
        id: "expectedSalary",
        header: "Expected salary",
        cell: ({ row }) => {
          const item = row.original;
          return item.sharing ? sharedPayLabel(item.sharing.expectedCompensation) : item.profile.expectedSalary == null ? "—" : "₹" + item.profile.expectedSalary + " LPA";
        },
        size: RESPONSE_TABLE_DEFAULT_WIDTHS.expectedSalary,
        minSize: RESPONSE_TABLE_MIN_WIDTHS.expectedSalary,
        maxSize: RESPONSE_TABLE_MAX_WIDTHS.expectedSalary,
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
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const item = row.original;
          const p = item.profile;
          return (
            <div className="response-table-actions">
              <CandidateProfileActions
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
        enableResizing: true,
      },
    ];
    return defs;
  }, [actions, allChecked, items.length, message, onSelect, onSelectAll, selection]);

  const table = useLegacyTable({
    data: items,
    columns,
    state: { columnSizing, columnVisibility, columnOrder, columnPinning },
    onColumnSizingChange: (updater) => {
      setColumnSizing((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
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
    (columnId: ResponseTableColumnId) => {
      const header = RESPONSE_TABLE_LABELS[columnId];
      let width = measureTextWidth(header) + 48;
      for (const item of items) {
        let text = "";
        switch (columnId) {
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
          case "expectedSalary":
            text = item.profile.expectedSalary == null ? "—" : String(item.profile.expectedSalary);
            break;
          case "skills":
            text = item.profile.skills.slice(0, 4).join(" · ");
            break;
          case "applied":
            text = formatLocaleDate(item.application.createdAt);
            break;
          case "actions":
            text = "Contact Message View profile Save";
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
    [items, syncPrefs],
  );

  const autoFitAll = () => {
    for (const id of RESPONSE_TABLE_COLUMN_IDS) {
      if (columnVisibility[id] === false) continue;
      autoFitColumn(id);
    }
  };

  const fitAvailableWidth = () => {
    const el = tableWrapRef.current;
    if (!el) return;
    const visible = RESPONSE_TABLE_COLUMN_IDS.filter((id) => columnVisibility[id] !== false);
    const total = visible.reduce((sum, id) => sum + (columnSizing[id] ?? RESPONSE_TABLE_DEFAULT_WIDTHS[id]), 0);
    const available = el.clientWidth - 2;
    if (total <= 0 || available <= 0) return;
    const scale = available / total;
    const next: ColumnSizingState = { ...columnSizing };
    for (const id of visible) {
      next[id] = clampWidth(id, (columnSizing[id] ?? RESPONSE_TABLE_DEFAULT_WIDTHS[id]) * scale);
    }
    setColumnSizing(next);
    syncPrefs({ columnWidths: { ...RESPONSE_TABLE_DEFAULT_WIDTHS, ...next } });
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
    const oldIndex = columnOrder.indexOf(activeId);
    const newIndex = columnOrder.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(columnOrder, oldIndex, newIndex);
    const middle = next.filter((id) => id !== "select" && id !== "name" && id !== "actions");
    const normalized = ["select", "name", ...middle, "actions"];
    setColumnOrder(normalized);
    syncPrefs({ columnOrder: normalized });
  };

  const openFilter = (columnId: ResponseTableColumnId) => {
    if (!RESPONSE_TABLE_FILTER_PARAMS[columnId]) return;
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

  const pinColumn = (columnId: ResponseTableColumnId, side: "left" | "right") => {
    if (RESPONSE_TABLE_MANDATORY.includes(columnId as (typeof RESPONSE_TABLE_MANDATORY)[number])) return;
    setColumnPinning((prev) => {
      const start = (prev.start || []).filter((id) => id !== columnId && id !== "actions");
      const end = (prev.end || []).filter((id) => id !== columnId && id !== "select" && id !== "name");
      if (side === "left") start.push(columnId);
      else end.unshift(columnId);
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
  const sortableIds = columnOrder.filter((id) => id !== "select" && id !== "name" && id !== "actions");

  const pinStyle = (column: { getIsPinned: () => false | "start" | "end"; getStart: (pos?: "start" | "end") => number; getAfter: (pos?: "start" | "end") => number }, zIndex: number): CSSProperties => {
    const pinned = column.getIsPinned();
    if (!pinned) return {};
    const style: CSSProperties = { position: "sticky", zIndex };
    if (pinned === "start") style.left = column.getStart("start") + "px";
    if (pinned === "end") style.right = column.getAfter("end") + "px";
    return style;
  };

  return (
    <div className={"response-data-grid density-" + density}>
      <div className="response-grid-toolbar">
        {total != null ? <span className="response-grid-count">{total} applicant{total === 1 ? "" : "s"}</span> : null}
        <ColumnVisibilityPanel
          visibility={columnVisibility}
          onChange={(id, visible) => {
            table.getColumn(id)?.toggleVisibility(visible);
          }}
          onReset={() => {
            const defaults = defaultResponseTablePrefs();
            setColumnVisibility(defaults.columnVisibility);
            syncPrefs({ columnVisibility: defaults.columnVisibility });
          }}
        />
        <label className="response-grid-density">
          <span className="sr-only">Density</span>
          <select
            aria-label="Table density"
            value={density}
            onChange={(e) => {
              const next = e.target.value as ResponseTableDensity;
              setDensity(next);
              syncPrefs({ density: next });
            }}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
            <option value="spacious">Spacious</option>
          </select>
        </label>
        <Button variant="sm" onClick={autoFitAll}>
          Auto-fit
        </Button>
        <Button variant="sm" onClick={fitAvailableWidth}>
          Fit width
        </Button>
        <Button variant="sm" onClick={resetLayout}>
          Reset layout
        </Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div
          ref={tableWrapRef}
          className="response-table-wrap response-grid-scroll"
          onWheel={(e) => {
            if (!e.shiftKey || !tableWrapRef.current) return;
            tableWrapRef.current.scrollLeft += e.deltaY;
            e.preventDefault();
          }}
        >
          <table className="response-table response-data-table" aria-label="Applicant responses" style={{ width: table.getTotalSize() }}>
            <thead>
              {headerGroups.map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map((header) => {
                      const id = header.column.id as ResponseTableColumnId;
                      const pinned = header.column.getIsPinned();
                      const style: CSSProperties = {
                        width: header.getSize(),
                        ...pinStyle(header.column, pinned ? 4 : 1),
                        background: "#F5F7FA",
                      };
                      if (pinned === "start") style.boxShadow = "2px 0 4px #202a3610";
                      if (pinned === "end") style.boxShadow = "-2px 0 4px #202a3610";
                      const canHide = !(RESPONSE_TABLE_MANDATORY as readonly string[]).includes(id);
                      const canPin = canHide;
                      const sortOptions = RESPONSE_TABLE_SORTABLE[id];
                      return (
                        <th key={header.id} style={style} className={id === "select" ? "response-table-select" : undefined} colSpan={header.colSpan}>
                          {header.isPlaceholder ? null : (
                            <SortableHeader id={id} disabled={!canHide}>
                              <HeaderMenu
                                columnId={id}
                                canHide={canHide}
                                canPin={canPin}
                                sortOptions={sortOptions}
                                onSort={onSortChange}
                                onAutoFit={() => autoFitColumn(id)}
                                onResetWidth={() => {
                                  const width = RESPONSE_TABLE_DEFAULT_WIDTHS[id];
                                  setColumnSizing((prev) => {
                                    const next = { ...prev, [id]: width };
                                    syncPrefs({ columnWidths: { ...RESPONSE_TABLE_DEFAULT_WIDTHS, ...next } });
                                    return next;
                                  });
                                }}
                                onHide={() => table.getColumn(id)?.toggleVisibility(false)}
                                onPinLeft={() => pinColumn(id, "left")}
                                onPinRight={() => pinColumn(id, "right")}
                                onFilter={RESPONSE_TABLE_FILTER_PARAMS[id] ? () => openFilter(id) : undefined}
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
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
                              onDoubleClick={() => autoFitColumn(id)}
                              className={"response-grid-resizer" + (header.column.getIsResizing() ? " is-resizing" : "")}
                              role="separator"
                              aria-orientation="vertical"
                              aria-label={"Resize " + RESPONSE_TABLE_LABELS[id]}
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
              {rows.map((row) => {
                const selected = selection.includes(row.original.application.id);
                return (
                  <tr key={row.id} data-response-id={row.id} data-selected={selected || undefined}>
                    {row.getVisibleCells().map((cell) => {
                      const id = cell.column.id as ResponseTableColumnId;
                      const pinned = cell.column.getIsPinned();
                      const style: CSSProperties = {
                        width: cell.column.getSize(),
                        ...pinStyle(cell.column, pinned ? 2 : 0),
                        background: selected ? "#EDF4FF" : pinned ? "#fff" : undefined,
                      };
                      if (pinned === "start") style.boxShadow = "2px 0 4px #202a3608";
                      if (pinned === "end") style.boxShadow = "-2px 0 4px #202a3608";
                      return (
                        <td key={cell.id} style={style} className={id === "select" ? "response-table-select" : id === "actions" ? "response-table-actions-cell" : undefined}>
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
      </DndContext>
    </div>
  );
}
