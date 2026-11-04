import { beforeEach, describe, expect, it, vi } from "vitest";
import { floatingChatPrefsKey, normalizeFloatingChats } from "@/features/messaging/floating-chat-prefs";
import { useFloatingChatStore, type FloatingChatOpenInput } from "../floating-chat-store";

function chat(id: string): FloatingChatOpenInput {
  return { conversationId: id, candidateId: "cand-" + id, name: "Person " + id };
}

function ids() {
  return useFloatingChatStore.getState().widgets.map((w) => w.conversationId);
}

function openIds() {
  return useFloatingChatStore
    .getState()
    .widgets.filter((w) => !w.minimized)
    .map((w) => w.conversationId);
}

function minimizedIds() {
  return useFloatingChatStore
    .getState()
    .widgets.filter((w) => w.minimized)
    .map((w) => w.conversationId);
}

function maximizedIds() {
  return useFloatingChatStore
    .getState()
    .widgets.filter((w) => w.maximized)
    .map((w) => w.conversationId);
}

function stubViewport(tabletOrBelow: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width: 1024px") ? tabletOrBelow : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe("floating-chat-store open panel and maximize", () => {
  beforeEach(() => {
    stubViewport(false);
    vi.stubGlobal("localStorage", new MemoryStorage());
    useFloatingChatStore.getState().clearAll();
  });

  it("keeps at most 3 open panels and minimizes older ones", () => {
    const { openOrFocusChat } = useFloatingChatStore.getState();
    openOrFocusChat(chat("A"));
    openOrFocusChat(chat("B"));
    openOrFocusChat(chat("C"));
    expect(openIds()).toEqual(["A", "B", "C"]);

    openOrFocusChat(chat("D"));
    expect(ids()).toEqual(["A", "B", "C", "D"]);
    expect(minimizedIds()).toEqual(["A"]);
    expect(openIds()).toEqual(["B", "C", "D"]);
  });

  it("allows only one in-widget maximized view at a time", () => {
    const { openOrFocusChat, setMaximized } = useFloatingChatStore.getState();
    openOrFocusChat(chat("A"));
    openOrFocusChat(chat("B"));
    openOrFocusChat(chat("C"));

    setMaximized("A", true);
    expect(maximizedIds()).toEqual(["A"]);
    expect(openIds()).toContain("A");

    setMaximized("C", true);
    expect(maximizedIds()).toEqual(["C"]);
    expect(useFloatingChatStore.getState().widgets.find((w) => w.conversationId === "A")?.maximized).toBe(false);

    setMaximized("C", false);
    expect(maximizedIds()).toEqual([]);
  });

  it("reorders widgets in the dock without changing open/minimize caps", () => {
    const { openOrFocusChat, reorderWidgets } = useFloatingChatStore.getState();
    openOrFocusChat(chat("A"));
    openOrFocusChat(chat("B"));
    openOrFocusChat(chat("C"));
    expect(ids()).toEqual(["A", "B", "C"]);

    reorderWidgets("A", "C");
    expect(ids()).toEqual(["B", "C", "A"]);
    expect(openIds()).toEqual(["B", "C", "A"]);
    expect(minimizedIds()).toEqual([]);
  });

  it("shows only one floating widget on tablet and below", () => {
    stubViewport(true);
    const { openOrFocusChat } = useFloatingChatStore.getState();
    openOrFocusChat(chat("A"));
    openOrFocusChat(chat("B"));
    openOrFocusChat(chat("C"));
    expect(ids()).toEqual(["C"]);
    expect(openIds()).toEqual(["C"]);
    expect(minimizedIds()).toEqual([]);
  });
});

describe("floating-chat-store persistence", () => {
  beforeEach(() => {
    stubViewport(false);
    vi.stubGlobal("localStorage", new MemoryStorage());
    useFloatingChatStore.getState().clearAll();
  });

  it("round-trips order, minimize, and maximize through hydrate", () => {
    const store = useFloatingChatStore.getState();
    store.hydrateFromStorage("user-1", "identity-1", "job-1");
    store.openOrFocusChat(chat("A"));
    store.openOrFocusChat(chat("B"));
    store.openOrFocusChat(chat("C"));
    store.setMinimized("A", true);
    store.setMaximized("C", true);
    store.reorderWidgets("B", "C");

    const saved = structuredClone(useFloatingChatStore.getState().widgets);
    const key = floatingChatPrefsKey("user-1", "identity-1", "job-1");
    const raw = localStorage.getItem(key);
    expect(raw).toBeTruthy();

    // clearAll wipes the current job key (logout); restore it to simulate reload.
    store.clearAll();
    expect(ids()).toEqual([]);
    localStorage.setItem(key, raw!);

    useFloatingChatStore.getState().hydrateFromStorage("user-1", "identity-1", "job-1");
    expect(useFloatingChatStore.getState().widgets).toEqual(saved);
    expect(ids()).toEqual(["A", "C", "B"]);
    expect(minimizedIds()).toEqual(["A"]);
    expect(maximizedIds()).toEqual(["C"]);
  });

  it("falls back to an empty dock when storage is invalid", () => {
    localStorage.setItem(floatingChatPrefsKey("user-1", "identity-1", "job-1"), "{not-json");
    useFloatingChatStore.getState().hydrateFromStorage("user-1", "identity-1", "job-1");
    expect(ids()).toEqual([]);
  });

  it("scopes storage by user, identity, and job", () => {
    const store = useFloatingChatStore.getState();
    store.hydrateFromStorage("user-1", "identity-1", "job-1");
    store.openOrFocusChat(chat("A"));
    const job1 = localStorage.getItem(floatingChatPrefsKey("user-1", "identity-1", "job-1"));

    store.hydrateFromStorage("user-1", "identity-1", "job-2");
    expect(ids()).toEqual([]);
    store.openOrFocusChat(chat("Z"));
    expect(ids()).toEqual(["Z"]);

    store.parkSession();
    expect(ids()).toEqual([]);

    store.hydrateFromStorage("user-1", "identity-1", "job-1");
    expect(ids()).toEqual(["A"]);
    expect(localStorage.getItem(floatingChatPrefsKey("user-1", "identity-1", "job-1"))).toBe(job1);
  });
});

describe("normalizeFloatingChats", () => {
  it("drops invalid entries and keeps only one maximized widget", () => {
    expect(
      normalizeFloatingChats([
        { conversationId: "A", candidateId: "cA", name: "A", minimized: false, maximized: true, openedAt: 1 },
        { conversationId: "B", candidateId: "cB", name: "B", minimized: true, maximized: true, openedAt: 2 },
        { conversationId: "bad" },
        null,
      ]),
    ).toEqual([
      { conversationId: "A", candidateId: "cA", name: "A", minimized: false, maximized: true, openedAt: 1 },
      { conversationId: "B", candidateId: "cB", name: "B", minimized: true, maximized: false, openedAt: 2 },
    ]);
  });
});
