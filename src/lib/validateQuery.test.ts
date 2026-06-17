import { describe, it, expect } from 'vitest';
import { validateQuery } from './validateQuery';
import { field, literal, agg, compare, logicalGroup, makeSelectItem } from './exprBuilders';
import { emptyKpiMeta, type Query } from '@/types/expr';
import type { FieldSchema } from '@/modules/queries/schema';

const schema: FieldSchema[] = [
  { name: 'severity', type: 'text' },
  { name: 'mttr_min', type: 'number' },
  { name: 'is_active', type: 'bool' },
];

function baseQuery(overrides: Partial<Query> = {}): Query {
  return {
    id: null,
    name: 'test',
    source: 'fact_alarms',
    mode: 'visual',
    rawSql: '',
    select: [],
    where: logicalGroup('AND'),
    groupBy: [],
    orderBy: null,
    limit: null,
    joins: [],
    kpi: emptyKpiMeta(),
    ...overrides,
  };
}

describe('validateQuery', () => {
  it('rejects an empty SELECT', () => {
    const result = validateQuery(baseQuery(), schema);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.message.includes('SELECT'))).toBe(true);
  });

  it('accepts a simple valid query', () => {
    const q = baseQuery({ select: [makeSelectItem(field('severity'))] });
    expect(validateQuery(q, schema).ok).toBe(true);
  });

  it('flags a field that does not exist in the schema', () => {
    const q = baseQuery({ select: [makeSelectItem(field('not_a_real_field'))] });
    const result = validateQuery(q, schema);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.message.includes('not_a_real_field'))).toBe(true);
  });

  it('rejects SUM/AVG over a non-numeric field', () => {
    const q = baseQuery({ select: [makeSelectItem(agg('SUM', field('severity')))] });
    const result = validateQuery(q, schema);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.message.includes('SUM'))).toBe(true);
  });

  it('allows SUM over a numeric field', () => {
    const q = baseQuery({ select: [makeSelectItem(agg('SUM', field('mttr_min')))] });
    expect(validateQuery(q, schema).ok).toBe(true);
  });

  it('requires a plain field alongside an aggregate to be in GROUP BY', () => {
    const q = baseQuery({
      select: [makeSelectItem(field('severity')), makeSelectItem(agg('COUNT', '*'))],
      groupBy: [],
    });
    const result = validateQuery(q, schema);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.message.includes('GROUP BY'))).toBe(true);
  });

  it('passes once the dimension is added to GROUP BY', () => {
    const q = baseQuery({
      select: [makeSelectItem(field('severity')), makeSelectItem(agg('COUNT', '*'))],
      groupBy: ['severity'],
    });
    expect(validateQuery(q, schema).ok).toBe(true);
  });

  it('flags a filter with a missing value', () => {
    const q = baseQuery({
      select: [makeSelectItem(field('severity'))],
      where: logicalGroup('AND', [compare('=', field('severity'), literal('string', ''))]),
    });
    const result = validateQuery(q, schema);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.message.includes('missing its value'))).toBe(true);
  });

  it('de-duplicates identical error messages', () => {
    const q = baseQuery({
      select: [makeSelectItem(field('ghost1')), makeSelectItem(field('ghost1'))],
    });
    const result = validateQuery(q, schema);
    const ghostErrors = result.errors.filter(e => e.message.includes('ghost1'));
    expect(ghostErrors).toHaveLength(1);
  });
});
