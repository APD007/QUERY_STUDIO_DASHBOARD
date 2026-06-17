import { create } from 'zustand';
import { makeSampleData, makeDimVendorData } from '@/data/sampleData';
import { buildSchema, type FieldSchema } from '@/modules/queries/schema';
import { sanitizeTableName } from '@/lib/tableName';

const sampleData   = makeSampleData();
const sampleSchema = buildSchema(sampleData);

export interface JoinTable {
  rows: Record<string, unknown>[];
  schema: FieldSchema[];
}

function makeDefaultJoinTables(): Record<string, JoinTable> {
  const rows = makeDimVendorData();
  return { dim_vendor: { rows, schema: buildSchema(rows) } };
}

interface DataState {
  data: Record<string, unknown>[];
  schema: FieldSchema[];
  sourceName: string;
  joinTables: Record<string, JoinTable>;
  loadCSV(rows: Record<string, unknown>[], filename: string): void;
  loadDataset(rows: Record<string, unknown>[], tableName: string): void;
  resetSample(): void;
  loadJoinTable(name: string, rows: Record<string, unknown>[]): void;
  removeJoinTable(name: string): void;
}

export const useDataStore = create<DataState>(set => ({
  data: sampleData,
  schema: sampleSchema,
  sourceName: 'fact_alarms',
  joinTables: makeDefaultJoinTables(),

  loadCSV(rows, filename) {
    set({ data: rows, schema: buildSchema(rows), sourceName: sanitizeTableName(filename) });
  },

  loadDataset(rows, tableName) {
    set({ data: rows, schema: buildSchema(rows), sourceName: sanitizeTableName(tableName) });
  },

  resetSample() {
    const data = makeSampleData();
    set({ data, schema: buildSchema(data), sourceName: 'fact_alarms', joinTables: makeDefaultJoinTables() });
  },

  loadJoinTable(name, rows) {
    const tableName = sanitizeTableName(name);
    set(s => ({ joinTables: { ...s.joinTables, [tableName]: { rows, schema: buildSchema(rows) } } }));
  },

  removeJoinTable(name) {
    set(s => {
      const next = { ...s.joinTables };
      delete next[name];
      return { joinTables: next };
    });
  },
}));
