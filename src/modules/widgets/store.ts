import { create } from 'zustand';
import type { Widget } from '@/types/widget';
import { makeCollectionApi } from '@/lib/apiClient';

const widgetsApi = makeCollectionApi<Widget>('widgets');

interface WidgetStoreState {
  widgets: Widget[];
  loaded: boolean;
  load(): Promise<void>;
  reset(): void;
  addWidget(w: Omit<Widget, 'id'>): string;
  deleteWidget(id: string): void;
  getWidget(id: string): Widget | null;
  duplicateWidget(id: string): string | null;
  renameWidget(id: string, name: string): void;
}

export const useWidgetStore = create<WidgetStoreState>((set, get) => ({
  widgets: [],
  loaded: false,

  async load() {
    const widgets = await widgetsApi.list();
    set({ widgets, loaded: true });
  },

  reset() {
    set({ widgets: [], loaded: false });
  },

  addWidget(w) {
    const widget: Widget = { ...w, id: 'w_' + Date.now() };
    set(s => ({ widgets: [...s.widgets, widget] }));
    widgetsApi.upsert(widget).catch(err => console.error('Failed to save widget:', err));
    return widget.id;
  },

  deleteWidget(id) {
    set(s => ({ widgets: s.widgets.filter(w => w.id !== id) }));
    widgetsApi.remove(id).catch(err => console.error('Failed to delete widget:', err));
  },

  getWidget(id) {
    return get().widgets.find(w => w.id === id) ?? null;
  },

  duplicateWidget(id) {
    const source = get().widgets.find(w => w.id === id);
    if (!source) return null;
    const widget: Widget = { ...source, id: 'w_' + Date.now(), name: `${source.name} (copy)` };
    set(s => ({ widgets: [...s.widgets, widget] }));
    widgetsApi.upsert(widget).catch(err => console.error('Failed to save widget:', err));
    return widget.id;
  },

  renameWidget(id, name) {
    set(s => ({ widgets: s.widgets.map(w => (w.id === id ? { ...w, name } : w)) }));
    const widget = get().widgets.find(w => w.id === id);
    if (widget) widgetsApi.upsert(widget).catch(err => console.error('Failed to rename widget:', err));
  },
}));
