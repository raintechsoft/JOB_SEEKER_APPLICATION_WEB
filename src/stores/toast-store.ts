import { create } from "zustand";

export type ToastTone = "default" | "error";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let sequence = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

/** Client-side notifications (the prototype's `#toasts`). Default toasts last 4 s; errors last 6 s. */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = "default") => {
    const id = ++sequence;
    set({ toasts: [...get().toasts, { id, message, tone }] });
    timers.set(id, setTimeout(() => get().dismiss(id), tone === "error" ? 6000 : 4000));
  },
  dismiss: (id) => {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = (message: string, tone?: ToastTone) => useToastStore.getState().push(message, tone);
export const useToast = () => useToastStore((s) => s.push);
