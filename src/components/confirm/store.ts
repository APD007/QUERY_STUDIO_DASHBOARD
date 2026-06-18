import { create } from 'zustand';

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

interface ConfirmState {
  request: ConfirmRequest | null;
  ask(opts: { title?: string; message: string; confirmLabel?: string; danger?: boolean }): Promise<boolean>;
  resolve(ok: boolean): void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,

  ask(opts) {
    return new Promise<boolean>(resolve => {
      set({
        request: {
          title: opts.title ?? 'Are you sure?',
          message: opts.message,
          confirmLabel: opts.confirmLabel ?? 'Delete',
          danger: opts.danger ?? true,
          resolve,
        },
      });
    });
  },

  resolve(ok) {
    const req = get().request;
    set({ request: null });
    req?.resolve(ok);
  },
}));

/** Promise-based confirm modal — `if (await confirmDialog({ message: '...' })) { ... }` */
export const confirmDialog = (opts: { title?: string; message: string; confirmLabel?: string; danger?: boolean }) =>
  useConfirmStore.getState().ask(opts);
