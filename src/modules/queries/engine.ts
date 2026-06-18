import alasql from 'alasql';
import type { Query } from '@/types/expr';
import { inferType, type FieldSchema } from './schema';
import { buildQuerySql } from '@/lib/sqlGenerator';
import { exprResultType } from '@/lib/exprTypes';
import { useDataStore } from '@/store/dataStore';

export interface ResultColumn {
  label: string;
  type: 'text' | 'number' | 'date' | 'bool';
}

export interface QueryResult {
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
}

function normaliseBooleans(data: Record<string, unknown>[], schema: FieldSchema[]) {
  const boolCols = schema.filter(s => s.type === 'bool').map(s => s.name);
  if (!boolCols.length) return data;
  return data.map(row => {
    const out: Record<string, unknown> = { ...row };
    boolCols.forEach(col => {
      const v = out[col];
      out[col] = v === true || /^true$/i.test(String(v));
    });
    return out;
  });
}

/** Runs an arbitrary, hand-typed SQL string (Studio's SQL-first editor). */
export function runRawSql(
  sql: string,
  data: Record<string, unknown>[],
  schema: FieldSchema[],
  tableName: string
): QueryResult {
  const normalised = normaliseBooleans(data, schema);
  // Register the active dataset as a real named table so the typed SQL's
  // `FROM <tableName>` resolves exactly as the user wrote it.
  (alasql.tables as Record<string, { data: unknown[] }>)[tableName] = { data: normalised };

  // Also expose every other known dataset (demo + uploaded) under its own name,
  // so the query text — not which dataset happens to be "active" — decides what's queried.
  const joinTables = useDataStore.getState().joinTables;
  Object.entries(joinTables).forEach(([name, t]) => {
    if (name === tableName) return;
    (alasql.tables as Record<string, { data: unknown[] }>)[name] = { data: t.rows };
  });

  let rows: Record<string, unknown>[];
  try {
    rows = alasql(sql) as Record<string, unknown>[];
  } catch (err) {
    throw new Error(`Query error: ${(err as Error).message}`, { cause: err });
  }

  const columns: ResultColumn[] = rows.length
    ? Object.keys(rows[0]).map(key => ({
        label: key,
        type: inferType(rows.map(r => r[key])),
      }))
    : [];

  return { columns, rows };
}

export function runQuery(
  query: Query,
  data: Record<string, unknown>[],
  schema: FieldSchema[]
): QueryResult {
  if (query.mode === 'sql') {
    if (!query.rawSql.trim()) return { columns: [], rows: [] };
    return runRawSql(query.rawSql, data, schema, query.source);
  }

  if (!query.select.length) return { columns: [], rows: [] };

  const normalised = normaliseBooleans(data, schema);
  const sql = buildQuerySql(query, { forExecution: true });

  let effectiveSchema = schema;
  let rawRows: Record<string, unknown>[];
  try {
    if (query.joins.length) {
      // A joined query needs every table registered under its real name —
      // alasql's `?` param-binding trick only addresses a single table.
      const joinTables = useDataStore.getState().joinTables;
      (alasql.tables as Record<string, { data: unknown[] }>)[query.source] = { data: normalised };
      query.joins.forEach(j => {
        const t = joinTables[j.rightTable];
        if (!t) throw new Error(`Join table "${j.rightTable}" is no longer loaded.`);
        (alasql.tables as Record<string, { data: unknown[] }>)[j.rightTable] = { data: t.rows };
        effectiveSchema = effectiveSchema.concat(t.schema);
      });
      rawRows = alasql(sql) as Record<string, unknown>[];
    } else {
      rawRows = alasql(sql, [normalised]) as Record<string, unknown>[];
    }
  } catch (err) {
    throw new Error(`Query error: ${(err as Error).message}`, { cause: err });
  }

  const rows = rawRows.map(r => {
    const out: Record<string, unknown> = {};
    query.select.forEach((item, i) => {
      out[item.label] = r[`_sel${i}`];
    });
    return out;
  });

  const columns: ResultColumn[] = query.select.map(item => ({
    label: item.label,
    type: exprResultType(item.expr, effectiveSchema),
  }));

  return { columns, rows };
}
