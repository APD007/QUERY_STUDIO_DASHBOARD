import { create } from 'zustand';
import { buildSchema, type FieldSchema } from '@/modules/queries/schema';
import { useDatasetStore } from '@/modules/datasets/store';
import type { DatasetSourceType } from '@/lib/apiClient';

export interface UploadEntry {
  name: string;
  sourceType: DatasetSourceType;
  status: 'uploading' | 'saving' | 'saved' | 'error';
  progress: number;
  rowCount: number;
  columnCount: number;
  message?: string;
}

interface UploadStoreState {
  uploads: UploadEntry[];
  startFile(name: string, sourceType: DatasetSourceType): void;
  setProgress(name: string, progress: number): void;
  finishFile(name: string, sourceType: DatasetSourceType, rows: Record<string, unknown>[]): void;
  failFile(name: string, message: string): void;
  dismiss(name: string): void;
}

// Lives outside any page component so a file's parse + save keeps running even if
// the user switches tabs mid-upload — React unmounting FilesSection no longer aborts it.
export const useUploadStore = create<UploadStoreState>((set, get) => ({
  uploads: [],

  startFile(name, sourceType) {
    set(s => ({
      uploads: [
        { name, sourceType, status: 'uploading', progress: 0, rowCount: 0, columnCount: 0 },
        ...s.uploads.filter(u => u.name !== name),
      ],
    }));
  },

  setProgress(name, progress) {
    set(s => ({ uploads: s.uploads.map(u => (u.name === name ? { ...u, progress } : u)) }));
  },

  finishFile(name, sourceType, rows) {
    if (!rows.length) {
      get().failFile(name, 'No rows found — check the file has a header row and at least one data row.');
      return;
    }
    const schema: FieldSchema[] = buildSchema(rows);
    set(s => ({
      uploads: s.uploads.map(u => (u.name === name
        ? { ...u, status: 'saving', progress: 100, rowCount: rows.length, columnCount: schema.length }
        : u)),
    }));
    useDatasetStore.getState().upload(name, sourceType, schema, rows)
      .then(() => {
        set(s => ({ uploads: s.uploads.map(u => (u.name === name ? { ...u, status: 'saved' } : u)) }));
      })
      .catch((err: Error) => {
        set(s => ({ uploads: s.uploads.map(u => (u.name === name ? { ...u, status: 'error', message: err.message } : u)) }));
      });
  },

  failFile(name, message) {
    set(s => ({ uploads: s.uploads.map(u => (u.name === name ? { ...u, status: 'error', progress: 100, message } : u)) }));
  },

  dismiss(name) {
    set(s => ({ uploads: s.uploads.filter(u => u.name !== name) }));
  },
}));
