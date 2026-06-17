import { create } from 'zustand';

const DEFAULT_SQL = `SELECT severity,
       COUNT(*)
FROM fact_alarms
WHERE is_active = TRUE
GROUP BY severity;`;

interface SqlEditorState {
  sql: string;
  setSql(sql: string): void;
}

export const useSqlEditorStore = create<SqlEditorState>(set => ({
  sql: DEFAULT_SQL,
  setSql(sql) { set({ sql }); },
}));
