import { create } from 'zustand';
import type { Query } from '@/types/expr';
import { makeCollectionApi } from '@/lib/apiClient';

const queriesApi = makeCollectionApi<Query>('queries');

interface QueryStoreState {
  queries: Query[];
  loaded: boolean;
  load(): Promise<void>;
  reset(): void;
  saveQuery(draft: Query): string;
  deleteQuery(id: string): void;
  getQuery(id: string): Query | null;
}

export const useQueryStore = create<QueryStoreState>((set, get) => ({
  queries: [],
  loaded: false,

  async load() {
    const queries = await queriesApi.list();
    set({ queries, loaded: true });
  },

  reset() {
    set({ queries: [], loaded: false });
  },

  saveQuery(draft) {
    const existing = get().queries.find(q => q.id === draft.id);
    let saved: Query;
    if (existing && draft.id) {
      saved = { ...draft };
      set(s => ({ queries: s.queries.map(q => (q.id === draft.id ? saved : q)) }));
    } else {
      const id = 'q_' + Date.now();
      saved = { ...draft, id };
      set(s => ({ queries: [...s.queries, saved] }));
    }
    queriesApi.upsert(saved).catch(err => console.error('Failed to save query:', err));
    return saved.id as string;
  },

  deleteQuery(id) {
    set(s => ({ queries: s.queries.filter(q => q.id !== id) }));
    queriesApi.remove(id).catch(err => console.error('Failed to delete query:', err));
  },

  getQuery(id) {
    return get().queries.find(q => q.id === id) ?? null;
  },
}));
