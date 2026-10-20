import type { ReactNode } from "react";
import { create } from "zustand";

/** `sheet`: right-hand notification sheet · `project`: full-height sheet · `following`: network sheet. */
export type ModalVariant = "dialog" | "sheet" | "project" | "following";

interface ModalState {
  open: boolean;
  title: ReactNode;
  content: ReactNode;
  variant: ModalVariant;
  /** Incremented on every open so content remounts with fresh local state. */
  version: number;
  /** A form inside the dialog has unsaved changes (profile editors). */
  dirty: boolean;
  /** Showing the "keep editing or discard" prompt; `pending` runs after discarding. */
  confirmingDiscard: boolean;
  pending: (() => void) | null;
  show: (title: ReactNode, content: ReactNode, variant?: ModalVariant) => void;
  close: () => void;
  /** Closes unless the content is dirty, in which case the discard prompt is shown first. */
  requestClose: (next?: () => void) => void;
  setDirty: (dirty: boolean) => void;
  keepEditing: () => void;
  discard: () => void;
}

export const useModalStore = create<ModalState>((set, get) => ({
  open: false,
  title: null,
  content: null,
  variant: "dialog",
  version: 0,
  dirty: false,
  confirmingDiscard: false,
  pending: null,
  show: (title, content, variant = "dialog") => set((s) => ({ open: true, title, content, variant, version: s.version + 1, dirty: false, confirmingDiscard: false, pending: null })),
  close: () => set({ open: false, dirty: false, confirmingDiscard: false, pending: null }),
  requestClose: (next) => {
    if (!get().dirty) {
      get().close();
      next?.();
      return;
    }
    set({ confirmingDiscard: true, pending: next ?? null });
  },
  setDirty: (dirty) => {
    if (get().dirty !== dirty) set({ dirty });
  },
  keepEditing: () => set({ confirmingDiscard: false, pending: null }),
  discard: () => {
    const next = get().pending;
    get().close();
    next?.();
  },
}));

/** Imperative modal API for event handlers. */
export const modal = {
  show: (title: ReactNode, content: ReactNode, variant?: ModalVariant) => useModalStore.getState().show(title, content, variant),
  close: () => useModalStore.getState().close(),
  requestClose: (next?: () => void) => useModalStore.getState().requestClose(next),
};
