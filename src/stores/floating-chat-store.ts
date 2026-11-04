import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";
import type { Id } from "@/types/domain";
import {
  clearFloatingChats,
  floatingChatPrefsKey,
  loadFloatingChats,
  saveFloatingChats,
  type FloatingChat,
} from "@/features/messaging/floating-chat-prefs";

export type { FloatingChat };

/** How many chat sessions may show their open panel at once (others stay minimized tabs). */
const DESKTOP_OPEN_CAP = 3;
/** Tablet and below: a single floating widget (no multi-dock strip). */
const TABLET_OPEN_CAP = 1;

/** Absolute dock size safety limit (extras are closed FIFO). */
const DESKTOP_TOTAL_CAP = 24;
const TABLET_TOTAL_CAP = 1;

/** Matches typical tablet/laptop portrait and phone widths. */
const TABLET_QUERY = "(max-width: 1024px)";

function isTabletOrBelow() {
  return typeof window !== "undefined" && window.matchMedia(TABLET_QUERY).matches;
}

function openPanelCap() {
  if (typeof window === "undefined") return DESKTOP_OPEN_CAP;
  return isTabletOrBelow() ? TABLET_OPEN_CAP : DESKTOP_OPEN_CAP;
}

function totalCap() {
  if (typeof window === "undefined") return DESKTOP_TOTAL_CAP;
  return isTabletOrBelow() ? TABLET_TOTAL_CAP : DESKTOP_TOTAL_CAP;
}

let openSeq = 0;
let storageUserId: string | undefined;
let storageIdentityId: string | undefined;
let storageJobId: string | undefined;
let hydratedKey: string | null = null;

function nextOpenedAt() {
  openSeq += 1;
  return openSeq;
}

function persistWidgets(widgets: FloatingChat[]) {
  if (!hydratedKey || !storageJobId) return;
  saveFloatingChats(widgets, storageUserId, storageIdentityId, storageJobId);
}

function applyCapsOnHydrate(widgets: FloatingChat[]): FloatingChat[] {
  const trimmed = trimOldestClosed(widgets, totalCap());
  const open = trimmed.filter((w) => !w.minimized);
  if (open.length <= openPanelCap()) return trimmed;
  const maximized = trimmed.find((w) => w.maximized);
  const keepId =
    maximized?.conversationId ??
    [...open].sort((a, b) => b.openedAt - a.openedAt)[0]?.conversationId;
  if (!keepId) return trimmed;
  return withOpenPanelCap(trimmed, keepId, openPanelCap());
}

export type FloatingChatOpenInput = Omit<FloatingChat, "minimized" | "maximized" | "openedAt">;

type FloatingChatState = {
  widgets: FloatingChat[];
  openOrFocusChat: (chat: FloatingChatOpenInput) => void;
  setMinimized: (conversationId: Id, minimized: boolean) => void;
  setMaximized: (conversationId: Id, maximized: boolean) => void;
  reorderWidgets: (activeId: Id, overId: Id) => void;
  closeChat: (conversationId: Id) => void;
  clearAll: () => void;
  /** Load widgets for a specific Applications job route. No-ops without jobId. */
  hydrateFromStorage: (userId: string | undefined, identityId: string | undefined, jobId: string) => void;
  /** Drop in-memory widgets when leaving the job Applications route (storage kept). */
  parkSession: () => void;
};

/** Ensure keepOpenId is open; minimize oldest other open chats past the cap. */
function withOpenPanelCap(widgets: FloatingChat[], keepOpenId: Id, cap: number): FloatingChat[] {
  const marked = widgets.map((w) =>
    w.conversationId === keepOpenId ? { ...w, minimized: false } : w,
  );
  const open = marked.filter((w) => !w.minimized);
  const excess = open.length - cap;
  if (excess <= 0) return marked;
  const drop = new Set(
    open
      .filter((w) => w.conversationId !== keepOpenId)
      .sort((a, b) => a.openedAt - b.openedAt)
      .slice(0, excess)
      .map((w) => w.conversationId),
  );
  return marked.map((w) =>
    drop.has(w.conversationId) ? { ...w, minimized: true, maximized: false } : w,
  );
}

function trimOldestClosed(widgets: FloatingChat[], limit: number): FloatingChat[] {
  if (widgets.length <= limit) return widgets;
  const dropIds = new Set(
    [...widgets]
      .sort((a, b) => a.openedAt - b.openedAt)
      .slice(0, widgets.length - limit)
      .map((w) => w.conversationId),
  );
  return widgets.filter((w) => !dropIds.has(w.conversationId));
}

function commit(set: (partial: { widgets: FloatingChat[] }) => void, widgets: FloatingChat[]) {
  set({ widgets });
  persistWidgets(widgets);
}

export const useFloatingChatStore = create<FloatingChatState>((set, get) => ({
  widgets: [],
  openOrFocusChat: (chat) => {
    const existing = get().widgets.find((w) => w.conversationId === chat.conversationId);
    if (existing) {
      const widgets = withOpenPanelCap(
        get().widgets.map((w) =>
          w.conversationId === chat.conversationId
            ? { ...w, ...chat, openedAt: w.openedAt, maximized: w.maximized }
            : w,
        ),
        chat.conversationId,
        openPanelCap(),
      );
      commit(set, widgets);
      return;
    }
    const next: FloatingChat = {
      ...chat,
      minimized: false,
      maximized: false,
      openedAt: nextOpenedAt(),
    };
    const capped = trimOldestClosed([...get().widgets, next], totalCap());
    commit(set, withOpenPanelCap(capped, next.conversationId, openPanelCap()));
  },
  setMinimized: (conversationId, minimized) => {
    if (minimized) {
      commit(
        set,
        get().widgets.map((w) =>
          w.conversationId === conversationId ? { ...w, minimized: true, maximized: false } : w,
        ),
      );
      return;
    }
    commit(set, withOpenPanelCap(get().widgets, conversationId, openPanelCap()));
  },
  setMaximized: (conversationId, maximized) => {
    if (!maximized) {
      commit(
        set,
        get().widgets.map((w) =>
          w.conversationId === conversationId ? { ...w, maximized: false } : w,
        ),
      );
      return;
    }
    // Only one widget may use the in-widget maximize (full expanded) view.
    const exclusive = get().widgets.map((w) => ({
      ...w,
      maximized: w.conversationId === conversationId,
    }));
    commit(set, withOpenPanelCap(exclusive, conversationId, openPanelCap()));
  },
  reorderWidgets: (activeId, overId) => {
    if (activeId === overId) return;
    const from = get().widgets.findIndex((w) => w.conversationId === activeId);
    const to = get().widgets.findIndex((w) => w.conversationId === overId);
    if (from < 0 || to < 0) return;
    commit(set, arrayMove(get().widgets, from, to));
  },
  closeChat: (conversationId) => {
    commit(
      set,
      get().widgets.filter((w) => w.conversationId !== conversationId),
    );
  },
  clearAll: () => {
    clearFloatingChats(storageUserId, storageIdentityId, storageJobId);
    storageUserId = undefined;
    storageIdentityId = undefined;
    storageJobId = undefined;
    hydratedKey = null;
    set({ widgets: [] });
  },
  parkSession: () => {
    if (hydratedKey) persistWidgets(get().widgets);
    storageUserId = undefined;
    storageIdentityId = undefined;
    storageJobId = undefined;
    hydratedKey = null;
    set({ widgets: [] });
  },
  hydrateFromStorage: (userId, identityId, jobId) => {
    if (!jobId) return;
    const key = floatingChatPrefsKey(userId, identityId, jobId);
    if (hydratedKey === key) return;
    if (hydratedKey) persistWidgets(get().widgets);
    storageUserId = userId;
    storageIdentityId = identityId;
    storageJobId = jobId;
    hydratedKey = key;
    const loaded = loadFloatingChats(userId, identityId, jobId);
    const maxOpened = loaded.reduce((max, w) => Math.max(max, w.openedAt), 0);
    openSeq = Math.max(openSeq, maxOpened);
    const widgets = applyCapsOnHydrate(loaded);
    set({ widgets });
    if (widgets.length !== loaded.length || widgets.some((w, i) => w.minimized !== loaded[i]?.minimized || w.maximized !== loaded[i]?.maximized)) {
      persistWidgets(widgets);
    }
  },
}));
