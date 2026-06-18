import { describe, it, expect, beforeEach } from 'vitest';
import { runQuery, runRawSql } from './engine';
import { useDataStore } from '@/store/dataStore';
import { field, agg, makeSelectItem } from '@/lib/exprBuilders';
import { emptyKpiMeta, emptyLogicalGroup, type Query } from '@/types/expr';
import type { FieldSchema } from './schema';

const baseSchema: FieldSchema[] = [
  { name: 'alarm_id', type: 'number' },
  { name: 'vendor', type: 'text' },
];

const baseData = [
  { alarm_id: 1, vendor: 'Nokia' },
  { alarm_id: 2, vendor: 'Ericsson' },
  { alarm_id: 3, vendor: 'Nokia' },
];

function baseQuery(overrides: Partial<Query> = {}): Query {
  return {
    id: null,
    name: 'test',
    source: 'fact_alarms',
    mode: 'visual',
    rawSql: '',
    select: [],
    where: emptyLogicalGroup('AND'),
    groupBy: [],
    orderBy: null,
    limit: null,
    joins: [],
    kpi: emptyKpiMeta(),
    ...overrides,
  };
}

describe('runQuery with joins', () => {
  beforeEach(() => {
    useDataStore.getState().loadJoinTable('dim_vendor', [
      { vendor: 'Nokia', region: 'EMEA' },
      { vendor: 'Ericsson', region: 'EMEA' },
    ]);
  });

  it('joins the right table and exposes its qualified fields', () => {
    const q = baseQuery({
      select: [makeSelectItem(field('vendor')), makeSelectItem(field('dim_vendor.region'))],
      joins: [{ id: 'j1', type: 'INNER', rightTable: 'dim_vendor', leftKey: 'fact_alarms.vendor', rightKey: 'dim_vendor.vendor' }],
    });
    const result = runQuery(q, baseData, baseSchema);
    expect(result.rows).toHaveLength(3);
    expect(result.rows.every(r => typeof r['dim_vendor.region'] === 'string')).toBe(true);
    expect(result.rows[0]['dim_vendor.region']).toBe('EMEA');
  });

  it('supports aggregating across the joined table', () => {
    const q = baseQuery({
      select: [makeSelectItem(field('dim_vendor.region')), makeSelectItem(agg('COUNT', '*'), 'cnt')],
      groupBy: ['dim_vendor.region'],
      joins: [{ id: 'j1', type: 'INNER', rightTable: 'dim_vendor', leftKey: 'fact_alarms.vendor', rightKey: 'dim_vendor.vendor' }],
    });
    const result = runQuery(q, baseData, baseSchema);
    expect(result.rows).toEqual([{ 'dim_vendor.region': 'EMEA', cnt: 3 }]);
  });

  it('throws a clear error when the right-hand join table is no longer loaded', () => {
    useDataStore.getState().removeJoinTable('dim_vendor');
    const q = baseQuery({
      select: [makeSelectItem(field('vendor'))],
      joins: [{ id: 'j1', type: 'INNER', rightTable: 'dim_vendor', leftKey: 'fact_alarms.vendor', rightKey: 'dim_vendor.vendor' }],
    });
    expect(() => runQuery(q, baseData, baseSchema)).toThrow(/no longer loaded/);
  });
});

describe('runRawSql across multiple datasets', () => {
  it('can query a dataset other than the active one purely by name', () => {
    useDataStore.getState().loadJoinTable('dim_vendor', [
      { vendor: 'Nokia', region: 'EMEA' },
      { vendor: 'Ericsson', region: 'APAC' },
    ]);
    const result = runRawSql('SELECT * FROM dim_vendor WHERE region = \'APAC\'', baseData, baseSchema, 'fact_alarms');
    expect(result.rows).toEqual([{ vendor: 'Ericsson', region: 'APAC' }]);
  });

  it('can join the active table with another loaded dataset in the same query', () => {
    useDataStore.getState().loadJoinTable('dim_vendor', [
      { vendor: 'Nokia', region: 'EMEA' },
      { vendor: 'Ericsson', region: 'APAC' },
    ]);
    const result = runRawSql(
      'SELECT fact_alarms.alarm_id, dim_vendor.region FROM fact_alarms JOIN dim_vendor ON fact_alarms.vendor = dim_vendor.vendor ORDER BY fact_alarms.alarm_id',
      baseData,
      baseSchema,
      'fact_alarms'
    );
    expect(result.rows).toEqual([
      { alarm_id: 1, region: 'EMEA' },
      { alarm_id: 2, region: 'APAC' },
      { alarm_id: 3, region: 'EMEA' },
    ]);
  });
});
