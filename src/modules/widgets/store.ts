import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Widget } from '@/types/widget';

interface WidgetStoreState {
  widgets: Widget[];
  addWidget(w: Omit<Widget, 'id'>): string;
  deleteWidget(id: string): void;
  getWidget(id: string): Widget | null;
  duplicateWidget(id: string): string | null;
  renameWidget(id: string, name: string): void;
}

export const useWidgetStore = create<WidgetStoreState>()(
  persist(
    (set, get) => ({
      widgets: [],

      addWidget(w) {
        const widget: Widget = { ...w, id: 'w_' + Date.now() };
        set(s => ({ widgets: [...s.widgets, widget] }));
        return widget.id;
      },

      deleteWidget(id) {
        set(s => ({ widgets: s.widgets.filter(w => w.id !== id) }));
      },

      getWidget(id) {
        return get().widgets.find(w => w.id === id) ?? null;
      },

      duplicateWidget(id) {
        const source = get().widgets.find(w => w.id === id);
        if (!source) return null;
        const widget: Widget = { ...source, id: 'w_' + Date.now(), name: `${source.name} (copy)` };
        set(s => ({ widgets: [...s.widgets, widget] }));
        return widget.id;
      },

      renameWidget(id, name) {
        set(s => ({ widgets: s.widgets.map(w => (w.id === id ? { ...w, name } : w)) }));
      },
    }),
    { name: 'qs-widgets-v2' }
  )
);
