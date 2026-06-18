export type DbType = 'sqlite' | 'postgres' | 'mysql' | 'mssql' | 'oracle';

export interface DbConnection {
  type: DbType;
  host?: string;
  port?: string | number;
  database: string; // for sqlite, this is the server-side file path
  user?: string;
  password?: string;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((data && data.error) || `${method} ${url} failed (${res.status})`, res.status);
  return data as T;
}

const postJson = <T,>(url: string, body: unknown) => request<T>('POST', url, body);

export { ApiError };

/* ============================================================ Auth ============================================================ */

export interface AuthUser {
  id: string;
  email: string;
}

export const authApi = {
  register: (email: string, password: string) => request<AuthUser>('POST', '/api/auth/register', { email, password }),
  login: (email: string, password: string) => request<AuthUser>('POST', '/api/auth/login', { email, password }),
  logout: () => request<{ ok: boolean }>('POST', '/api/auth/logout'),
  me: () => request<AuthUser>('GET', '/api/auth/me'),
};

/* ============================================================ Generic persisted collections ============================================================ */

export function makeCollectionApi<T extends { id: string | null }>(resource: string) {
  return {
    list: () => request<{ items: T[] }>('GET', `/api/${resource}`).then(r => r.items),
    upsert: (item: T) =>
      item.id
        ? request<{ id: string }>('PUT', `/api/${resource}/${item.id}`, item).then(r => r.id)
        : request<{ id: string }>('POST', `/api/${resource}`, item).then(r => r.id),
    remove: (id: string) => request<{ ok: boolean }>('DELETE', `/api/${resource}/${id}`).then(() => {}),
  };
}

/* ============================================================ Data sources ============================================================ */

export async function uploadSqliteFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/sqlite/upload', { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.filePath as string;
}

export async function testDbConnection(conn: DbConnection): Promise<void> {
  await postJson<{ ok: boolean }>('/api/db/test', conn);
}

export async function listDbTables(conn: DbConnection): Promise<string[]> {
  const { tables } = await postJson<{ tables: string[] }>('/api/db/tables', conn);
  return tables;
}

export async function importDbTable(
  conn: DbConnection,
  table: string,
  limit = 5000
): Promise<Record<string, unknown>[]> {
  const { rows } = await postJson<{ rows: Record<string, unknown>[] }>('/api/db/import', {
    ...conn,
    table,
    limit,
  });
  return rows;
}

export interface RestFetchOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export async function fetchViaProxy(opts: RestFetchOptions): Promise<unknown> {
  const { data } = await postJson<{ status: number; data: unknown }>('/api/proxy/fetch', opts);
  return data;
}

/* ============================================================ Datasets ============================================================ */

export type DatasetSourceType = 'csv' | 'excel' | 'json' | 'rest' | 'database';

export interface DatasetMeta {
  id: string;
  name: string;
  sourceType: DatasetSourceType;
  rowCount: number;
  columnCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetFull extends DatasetMeta {
  schema: { name: string; type: string }[];
  rows: Record<string, unknown>[];
}

// Target size per chunk request, not a row count — column-heavy datasets would
// otherwise produce chunks of wildly different byte sizes for the same row count.
const CHUNK_TARGET_BYTES = 3 * 1024 * 1024;

function chunkRows(rows: Record<string, unknown>[]): Record<string, unknown>[][] {
  const chunks: Record<string, unknown>[][] = [];
  let current: Record<string, unknown>[] = [];
  let currentBytes = 0;
  for (const row of rows) {
    const size = JSON.stringify(row).length;
    if (current.length > 0 && currentBytes + size > CHUNK_TARGET_BYTES) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(row);
    currentBytes += size;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

export const datasetsApi = {
  list: () => request<{ items: DatasetMeta[] }>('GET', '/api/datasets').then(r => r.items),
  get: (id: string) => request<DatasetFull>('GET', `/api/datasets/${id}`),
  // Uploaded as a start + many small chunks + a finish instead of one request carrying
  // every row — a single giant body was what crashed the app on hosted free-tier RAM.
  async upload(
    name: string,
    sourceType: DatasetSourceType,
    schema: { name: string; type: string }[],
    rows: Record<string, unknown>[],
    onProgress?: (pct: number) => void
  ): Promise<DatasetMeta> {
    const { id } = await postJson<{ id: string }>('/api/datasets/start', { name, sourceType, schema });
    const chunks = chunkRows(rows);
    for (let i = 0; i < chunks.length; i++) {
      await postJson(`/api/datasets/${id}/chunk`, { index: i, rows: chunks[i] });
      onProgress?.(Math.round(((i + 1) / chunks.length) * 100));
    }
    return postJson<DatasetMeta>(`/api/datasets/${id}/finish`, {});
  },
  rename: (id: string, name: string) => request<{ ok: boolean }>('PATCH', `/api/datasets/${id}`, { name }).then(() => {}),
  remove: (id: string) => request<{ ok: boolean }>('DELETE', `/api/datasets/${id}`).then(() => {}),
};
