import { create } from 'zustand';
import { datasetsApi, type DatasetMeta, type DatasetSourceType } from '@/lib/apiClient';
import { useDataStore } from '@/store/dataStore';
import type { FieldSchema } from '@/modules/queries/schema';

interface DatasetStoreState {
  datasets: DatasetMeta[];
  loaded: boolean;
  activeId: string | null;

  load(): Promise<void>;
  reset(): void;
  upload(name: string, sourceType: DatasetSourceType, schema: FieldSchema[], rows: Record<string, unknown>[]): Promise<void>;
  activate(id: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export const useDatasetStore = create<DatasetStoreState>((set, get) => ({
  datasets: [],
  loaded: false,
  activeId: null,

  async load() {
    const datasets = await datasetsApi.list();
    set({ datasets, loaded: true });
  },

  reset() {
    set({ datasets: [], loaded: false, activeId: null });
  },

  async upload(name, sourceType, schema, rows) {
    const created = await datasetsApi.upload(name, sourceType, schema, rows);
    set(s => ({ datasets: [created, ...s.datasets.filter(d => d.id !== created.id)] }));
    useDataStore.getState().loadDataset(rows, name);
    set({ activeId: created.id });
  },

  async activate(id) {
    const full = await datasetsApi.get(id);
    useDataStore.getState().loadDataset(full.rows, full.name);
    set({ activeId: id });
  },

  async rename(id, name) {
    await datasetsApi.rename(id, name);
    set(s => ({ datasets: s.datasets.map(d => (d.id === id ? { ...d, name } : d)) }));
  },

  async remove(id) {
    await datasetsApi.remove(id);
    set(s => ({ datasets: s.datasets.filter(d => d.id !== id) }));
    if (get().activeId === id) {
      useDataStore.getState().resetSample();
      set({ activeId: null });
    }
  },
}));
