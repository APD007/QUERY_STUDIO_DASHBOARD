import type { FieldType } from '@/types/expr';

export interface FieldSchema {
  name: string;
  type: FieldType;
}

export function inferType(values: unknown[]): FieldType {
  const sample = values.filter(v => v !== '' && v != null).slice(0, 60);
  if (!sample.length) return 'text';

  const isBool = sample.every(v => v === true || v === false || /^(true|false)$/i.test(String(v)));
  if (isBool) return 'bool';

  const isNum = sample.every(v => String(v).trim() !== '' && !isNaN(Number(v)));
  if (isNum) return 'number';

  const isDate = sample.every(v => !isNaN(Date.parse(String(v))) && /[-/:]/.test(String(v)));
  if (isDate) return 'date';

  return 'text';
}

export function buildSchema(rows: Record<string, unknown>[]): FieldSchema[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map(name => ({
    name,
    type: inferType(rows.map(r => r[name])),
  }));
}
