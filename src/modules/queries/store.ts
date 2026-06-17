import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Query } from '@/types/expr';

interface QueryStoreState {
  queries: Query[];
  saveQuery(draft: Query): string;
  deleteQuery(id: string): void;
  getQuery(id: string): Query | null;
}

export const useQueryStore = create<QueryStoreState>()(
  persist(
    (set, get) => ({
      queries: [],

      saveQuery(draft) {
        const existing = get().queries.find(q => q.id === draft.id);
        if (existing && draft.id) {
          set(s => ({ queries: s.queries.map(q => (q.id === draft.id ? { ...draft } : q)) }));
          return draft.id;
        }
        const id = 'q_' + Date.now();
        const saved: Query = { ...draft, id };
        set(s => ({ queries: [...s.queries, saved] }));
        return id;
      },

      deleteQuery(id) {
        set(s => ({ queries: s.queries.filter(q => q.id !== id) }));
      },

      getQuery(id) {
        return get().queries.find(q => q.id === id) ?? null;
      },
    }),
    { name: 'qs-queries-v2' }
  )
);
