import { create } from "zustand";

interface Toast {
  id: number;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string) => void;
  dismiss: (id: number) => void;
}

let sequence = 0;

/** Client-side notifications (the prototype's `#toasts`). Each toast disappears after 4 s. */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message) => {
    const id = ++sequence;
    set({ toasts: [...get().toasts, { id, message }] });
    setTimeout(() => get().dismiss(id), 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (message: string) => useToastStore.getState().push(message);
export const useToast = () => useToastStore((s) => s.push);
