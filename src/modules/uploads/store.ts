import { create } from 'zustand';
import { buildSchema, type FieldSchema } from '@/modules/queries/schema';
import { useDatasetStore } from '@/modules/datasets/store';
import { toast } from '@/components/toast/store';
import type { DatasetSourceType } from '@/lib/apiClient';

export interface UploadEntry {
  name: string;
  sourceType: DatasetSourceType;
  status: 'uploading' | 'saving' | 'saved' | 'error';
  progress: number;
  rowCount: number;
  columnCount: number;
  message?: string;
  // Kept around so a failed save can be retried without re-browsing for the file —
  // only set once parsing succeeds, so a parse failure still has nothing to retry from.
  rows?: Record<string, unknown>[];
}

interface UploadStoreState {
  uploads: UploadEntry[];
  startFile(name: string, sourceType: DatasetSourceType): void;
  setProgress(name: string, progress: number): void;
  finishFile(name: string, sourceType: DatasetSourceType, rows: Record<string, unknown>[]): void;
  failFile(name: string, message: string): void;
  retry(name: string): void;
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
        ? { ...u, status: 'saving', progress: 100, rowCount: rows.length, columnCount: schema.length, rows }
        : u)),
    }));
    useDatasetStore.getState().upload(name, sourceType, schema, rows)
      .then(() => {
        set(s => ({ uploads: s.uploads.map(u => (u.name === name ? { ...u, status: 'saved' } : u)) }));
        toast.success(`"${name}" saved`);
      })
      .catch((err: Error) => {
        set(s => ({ uploads: s.uploads.map(u => (u.name === name ? { ...u, status: 'error', message: err.message } : u)) }));
        toast.error(`"${name}" failed to save: ${err.message}`);
      });
  },

  failFile(name, message) {
    set(s => ({ uploads: s.uploads.map(u => (u.name === name ? { ...u, status: 'error', progress: 100, message } : u)) }));
    toast.error(`"${name}": ${message}`);
  },

  retry(name) {
    const entry = get().uploads.find(u => u.name === name);
    if (!entry?.rows) return;
    get().finishFile(name, entry.sourceType, entry.rows);
  },

  dismiss(name) {
    set(s => ({ uploads: s.uploads.filter(u => u.name !== name) }));
  },
}));
