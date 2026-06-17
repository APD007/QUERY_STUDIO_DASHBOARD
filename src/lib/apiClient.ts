export type DbType = 'sqlite' | 'postgres' | 'mysql' | 'mssql' | 'oracle';

export interface DbConnection {
  type: DbType;
  host?: string;
  port?: string | number;
  database: string; // for sqlite, this is the server-side file path
  user?: string;
  password?: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request to ${url} failed (${res.status})`);
  return data as T;
}

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
