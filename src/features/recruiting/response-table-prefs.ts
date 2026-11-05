import {
  clampResponseTableWidth,
  defaultResponseTablePrefs,
  isResponseTableColumnId,
  RESPONSE_TABLE_COLUMN_IDS,
  RESPONSE_TABLE_MANDATORY,
  responseTablePrefsSchema,
  type ResponseTableAnyColumnId,
  type ResponseTablePrefs,
} from "./response-table-types";

const PREFIX = "job_application_responses:v1:";

export function responseTablePrefsKey(userId: string | undefined, identityId: string | undefined) {
  return PREFIX + (userId || "guest") + ":" + (identityId || "guest");
}

/** Fixed columns and `q:<questionId>` columns (kept so a job's question layout survives reloads). */
function knownId(id: string): id is ResponseTableAnyColumnId {
  return isResponseTableColumnId(id);
}

/** Strip unknown columns and enforce mandatory visibility / pin edges. */
export function normalizeResponseTablePrefs(raw: unknown): ResponseTablePrefs {
  const base = defaultResponseTablePrefs();
  const parsed = responseTablePrefsSchema.safeParse(raw);
  if (!parsed.success) return base;
  const value = parsed.data;
  const order = value.columnOrder.filter(knownId);
  for (const id of RESPONSE_TABLE_COLUMN_IDS) if (!order.includes(id)) order.push(id);
  // Keep select/name first and actions last in order list (visual pin is separate).
  const middle = order.filter((id) => id !== "select" && id !== "name" && id !== "actions");
  const columnOrder = ["select", "name", ...middle, "actions"] as string[];

  const columnVisibility = { ...base.columnVisibility };
  for (const [key, visible] of Object.entries(value.columnVisibility)) {
    if (!knownId(key)) continue;
    columnVisibility[key] = RESPONSE_TABLE_MANDATORY.includes(key as (typeof RESPONSE_TABLE_MANDATORY)[number]) ? true : visible;
  }

  const columnWidths = { ...base.columnWidths };
  for (const [key, width] of Object.entries(value.columnWidths)) {
    if (!knownId(key) || !Number.isFinite(width)) continue;
    columnWidths[key] = clampResponseTableWidth(key, width);
  }
  // Icon-only actions + fixed status badge columns; never keep older compressed sizes.
  columnWidths.actions = base.columnWidths.actions;
  columnWidths.status = base.columnWidths.status;

  const pinnedLeft = ["select", "name", ...value.pinnedLeft.filter((id) => knownId(id) && id !== "select" && id !== "name" && id !== "actions")];
  const pinnedRight = [...value.pinnedRight.filter((id) => knownId(id) && id !== "select" && id !== "name" && id !== "actions"), "actions"];

  return {
    table: "job_application_responses",
    version: 1,
    columnOrder,
    columnVisibility,
    columnWidths,
    pinnedLeft: [...new Set(pinnedLeft)],
    pinnedRight: [...new Set(pinnedRight)],
    density: value.density,
  };
}

export function loadResponseTablePrefs(userId?: string, identityId?: string): ResponseTablePrefs {
  if (typeof window === "undefined") return defaultResponseTablePrefs();
  try {
    const raw = window.localStorage.getItem(responseTablePrefsKey(userId, identityId));
    if (!raw) return defaultResponseTablePrefs();
    return normalizeResponseTablePrefs(JSON.parse(raw));
  } catch {
    return defaultResponseTablePrefs();
  }
}

export function saveResponseTablePrefs(prefs: ResponseTablePrefs, userId?: string, identityId?: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(responseTablePrefsKey(userId, identityId), JSON.stringify(normalizeResponseTablePrefs(prefs)));
  } catch {
    /* ignore quota */
  }
}

export function clearResponseTablePrefs(userId?: string, identityId?: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(responseTablePrefsKey(userId, identityId));
  } catch {
    /* ignore */
  }
}

/**
 * Full-screen table state survives filter navigation and reloads. Device-level UI preference
 * (not per user), kept outside the column prefs so "Reset layout" leaves it alone.
 */
const FULLSCREEN_KEY = "job_application_responses:fullscreen:v1";
const fullscreenListeners = new Set<() => void>();

export function loadResponseTableFullscreen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FULLSCREEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveResponseTableFullscreen(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(FULLSCREEN_KEY, "1");
    else window.localStorage.removeItem(FULLSCREEN_KEY);
  } catch {
    /* ignore quota / private mode */
  }
  for (const listener of fullscreenListeners) listener();
}

/** Subscribe for useSyncExternalStore: in-tab writes and cross-tab storage events. */
export function subscribeResponseTableFullscreen(listener: () => void) {
  fullscreenListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === FULLSCREEN_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    fullscreenListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const serverResponseTableFullscreen = () => false;
