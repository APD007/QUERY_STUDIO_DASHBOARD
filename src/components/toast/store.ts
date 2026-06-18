import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push(kind: ToastKind, message: string): void;
  dismiss(id: string): void;
}

// Lives outside any page component so feedback (e.g. a background upload finishing)
// surfaces no matter which tab is currently mounted.
export const useToastStore = create<ToastState>(set => ({
  toasts: [],

  push(kind, message) {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set(s => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, 4500);
  },

  dismiss(id) {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
  },
}));

export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
  info: (message: string) => useToastStore.getState().push('info', message),
};
