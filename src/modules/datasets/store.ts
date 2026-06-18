import { create } from 'zustand';
import { datasetsApi, type DatasetMeta, type DatasetSourceType } from '@/lib/apiClient';
import { useDataStore } from '@/store/dataStore';
import { sanitizeTableName } from '@/lib/tableName';
import type { FieldSchema } from '@/modules/queries/schema';

// A file read with the wrong text encoding (e.g. a UTF-16 CSV decoded as UTF-8 via
// FileReader.readAsText) comes through with a stray NUL character wedged between every
// real character. Postgres' jsonb type rejects that character outright, turning an
// otherwise-fine upload into a 500. Stripping it fixes that case (the real characters
// are untouched) and guards against genuinely malformed input.
const NUL_CHAR = String.fromCharCode(0);
function stripNulBytes(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(row => {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      clean[key] = typeof value === 'string' ? value.split(NUL_CHAR).join('') : value;
    }
    return clean;
  });
}

interface DatasetStoreState {
  datasets: DatasetMeta[];
  loaded: boolean;
  activeId: string | null;
  hydratedIds: Set<string>;

  load(): Promise<void>;
  reset(): void;
  /** Fetches full rows for every dataset not yet registered as a queryable table, so raw SQL can `FROM` any of them by name. */
  ensureAllLoaded(): Promise<void>;
  upload(
    name: string,
    sourceType: DatasetSourceType,
    schema: FieldSchema[],
    rows: Record<string, unknown>[],
    onProgress?: (pct: number) => void
  ): Promise<void>;
  activate(id: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export const useDatasetStore = create<DatasetStoreState>((set, get) => ({
  datasets: [],
  loaded: false,
  activeId: null,
  hydratedIds: new Set(),

  async load() {
    const datasets = await datasetsApi.list();
    set({ datasets, loaded: true });
    await get().ensureAllLoaded();
  },

  reset() {
    set({ datasets: [], loaded: false, activeId: null, hydratedIds: new Set() });
  },

  async ensureAllLoaded() {
    const { datasets, hydratedIds } = get();
    const pending = datasets.filter(d => !hydratedIds.has(d.id));
    if (!pending.length) return;
    const loadedIds: string[] = [];
    await Promise.all(pending.map(async d => {
      try {
        const full = await datasetsApi.get(d.id);
        useDataStore.getState().loadJoinTable(full.name, full.rows);
        loadedIds.push(d.id);
      } catch {
        // Skip a dataset that fails to load rather than blocking every other table.
      }
    }));
    set(s => ({ hydratedIds: new Set([...s.hydratedIds, ...loadedIds]) }));
  },

  async upload(name, sourceType, schema, rows, onProgress) {
    const cleanRows = stripNulBytes(rows);
    const created = await datasetsApi.upload(name, sourceType, schema, cleanRows, onProgress);
    set(s => ({
      datasets: [created, ...s.datasets.filter(d => d.id !== created.id)],
      hydratedIds: new Set(s.hydratedIds).add(created.id),
    }));
    useDataStore.getState().loadDataset(cleanRows, name);
    useDataStore.getState().loadJoinTable(name, cleanRows);
    set({ activeId: created.id });
  },

  async activate(id) {
    const full = await datasetsApi.get(id);
    useDataStore.getState().loadDataset(full.rows, full.name);
    useDataStore.getState().loadJoinTable(full.name, full.rows);
    set(s => ({ activeId: id, hydratedIds: new Set(s.hydratedIds).add(id) }));
  },

  async rename(id, name) {
    const previous = get().datasets.find(d => d.id === id);
    await datasetsApi.rename(id, name);
    set(s => ({ datasets: s.datasets.map(d => (d.id === id ? { ...d, name } : d)) }));
    if (previous) {
      useDataStore.getState().removeJoinTable(sanitizeTableName(previous.name));
      const full = await datasetsApi.get(id);
      useDataStore.getState().loadJoinTable(name, full.rows);
    }
  },

  async remove(id) {
    const removed = get().datasets.find(d => d.id === id);
    await datasetsApi.remove(id);
    set(s => ({ datasets: s.datasets.filter(d => d.id !== id) }));
    if (removed) useDataStore.getState().removeJoinTable(sanitizeTableName(removed.name));
    if (get().activeId === id) {
      useDataStore.getState().resetSample();
      set({ activeId: null });
    }
  },
}));
