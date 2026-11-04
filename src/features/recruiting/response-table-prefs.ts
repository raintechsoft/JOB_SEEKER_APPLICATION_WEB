import {
  defaultResponseTablePrefs,
  RESPONSE_TABLE_COLUMN_IDS,
  RESPONSE_TABLE_MANDATORY,
  responseTablePrefsSchema,
  type ResponseTableColumnId,
  type ResponseTablePrefs,
} from "./response-table-types";

const PREFIX = "job_application_responses:v1:";

export function responseTablePrefsKey(userId: string | undefined, identityId: string | undefined) {
  return PREFIX + (userId || "guest") + ":" + (identityId || "guest");
}

function knownId(id: string): id is ResponseTableColumnId {
  return (RESPONSE_TABLE_COLUMN_IDS as readonly string[]).includes(id);
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
    columnWidths[key] = width;
  }

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
