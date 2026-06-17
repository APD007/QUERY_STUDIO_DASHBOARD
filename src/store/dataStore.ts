import { create } from 'zustand';
import { makeSampleData } from '@/data/sampleData';
import { buildSchema, type FieldSchema } from '@/modules/queries/schema';
import { sanitizeTableName } from '@/lib/tableName';

const sampleData   = makeSampleData();
const sampleSchema = buildSchema(sampleData);

interface DataState {
  data: Record<string, unknown>[];
  schema: FieldSchema[];
  sourceName: string;
  loadCSV(rows: Record<string, unknown>[], filename: string): void;
  loadDataset(rows: Record<string, unknown>[], tableName: string): void;
  resetSample(): void;
}

export const useDataStore = create<DataState>(set => ({
  data: sampleData,
  schema: sampleSchema,
  sourceName: 'fact_alarms',

  loadCSV(rows, filename) {
    set({ data: rows, schema: buildSchema(rows), sourceName: sanitizeTableName(filename) });
  },

  loadDataset(rows, tableName) {
    set({ data: rows, schema: buildSchema(rows), sourceName: sanitizeTableName(tableName) });
  },

  resetSample() {
    const data = makeSampleData();
    set({ data, schema: buildSchema(data), sourceName: 'fact_alarms' });
  },
}));
