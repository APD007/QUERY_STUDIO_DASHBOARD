import { describe, it, expect } from 'vitest';
import { exprToSql, buildQuerySql, buildDisplaySql, defaultLabelFor } from './sqlGenerator';
import { field, literal, agg, compare, logicalGroup, notNode, makeSelectItem } from './exprBuilders';
import { emptyKpiMeta, type Query } from '@/types/expr';

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

describe('exprToSql', () => {
  it('renders a plain field', () => {
    expect(exprToSql(field('severity'))).toBe('severity');
  });

  it('renders string literals with quoting and escaping', () => {
    expect(exprToSql(literal('string', "O'Brien"))).toBe("'O''Brien'");
  });

  it('renders boolean literals as TRUE/FALSE', () => {
    expect(exprToSql(literal('boolean', true))).toBe('TRUE');
    expect(exprToSql(literal('boolean', false))).toBe('FALSE');
  });

  it('renders an aggregate over a field', () => {
    expect(exprToSql(agg('COUNT', '*'))).toBe('COUNT(*)');
    expect(exprToSql(agg('SUM', field('mttr_min')))).toBe('SUM(mttr_min)');
  });

  it('renders a comparison', () => {
    expect(exprToSql(compare('=', field('is_active'), literal('boolean', true)))).toBe('is_active = TRUE');
  });

  it('wraps multi-child logical groups in parens, but not single-child groups', () => {
    const single = logicalGroup('AND', [compare('=', field('a'), literal('number', 1))]);
    expect(exprToSql(single)).toBe('a = 1');

    const multi = logicalGroup('OR', [
      compare('=', field('a'), literal('number', 1)),
      compare('=', field('b'), literal('number', 2)),
    ]);
    expect(exprToSql(multi)).toBe('a = 1 OR b = 2');
  });

  it('renders NOT around its child', () => {
    expect(exprToSql(notNode(compare('=', field('a'), literal('number', 1))))).toBe('NOT (a = 1)');
  });
});

describe('defaultLabelFor', () => {
  it('uses the alias name for alias nodes', () => {
    expect(defaultLabelFor({ kind: 'alias', expr: field('x'), as: 'my_label' })).toBe('my_label');
  });

  it('falls back to the rendered SQL for everything else', () => {
    expect(defaultLabelFor(field('severity'))).toBe('severity');
  });
});

describe('buildQuerySql', () => {
  it('builds a full SELECT ... FROM ... WHERE ... GROUP BY ... LIMIT for display', () => {
    const q = baseQuery({
      select: [makeSelectItem(field('severity')), makeSelectItem(agg('COUNT', '*'), 'cnt')],
      where: logicalGroup('AND', [compare('=', field('is_active'), literal('boolean', true))]),
      groupBy: ['severity'],
      limit: 10,
    });
    const sql = buildQuerySql(q);
    expect(sql).toBe('SELECT severity, COUNT(*) AS cnt FROM fact_alarms WHERE is_active = TRUE GROUP BY severity LIMIT 10');
  });

  it('uses internal _sel{i} aliases and a `?` placeholder when forExecution is set', () => {
    const q = baseQuery({
      select: [makeSelectItem(field('severity')), makeSelectItem(agg('COUNT', '*'))],
      groupBy: ['severity'],
    });
    const sql = buildQuerySql(q, { forExecution: true });
    expect(sql).toBe('SELECT severity AS _sel0, COUNT(*) AS _sel1 FROM ? GROUP BY severity');
  });

  it('defaults to SELECT * when there are no select items', () => {
    expect(buildQuerySql(baseQuery())).toBe('SELECT * FROM fact_alarms');
  });

  it('omits an empty WHERE clause entirely', () => {
    const q = baseQuery({ select: [makeSelectItem(field('a'))] });
    expect(buildQuerySql(q)).not.toContain('WHERE');
  });

  it('emits a JOIN clause and uses the real table name (not `?`) for execution', () => {
    const q = baseQuery({
      select: [makeSelectItem(field('severity'))],
      joins: [{ id: 'j1', type: 'LEFT', rightTable: 'dim_vendor', leftKey: 'fact_alarms.vendor', rightKey: 'dim_vendor.vendor' }],
    });
    const display = buildQuerySql(q);
    expect(display).toBe('SELECT severity FROM fact_alarms LEFT JOIN dim_vendor ON fact_alarms.vendor = dim_vendor.vendor');

    const exec = buildQuerySql(q, { forExecution: true });
    expect(exec).toContain('FROM fact_alarms LEFT JOIN dim_vendor ON fact_alarms.vendor = dim_vendor.vendor');
    expect(exec).not.toContain('?');
  });
});

describe('buildDisplaySql', () => {
  it('renders a readable multi-line query', () => {
    const q = baseQuery({
      select: [makeSelectItem(field('severity')), makeSelectItem(agg('COUNT', '*'))],
      groupBy: ['severity'],
    });
    const lines = buildDisplaySql(q).split('\n');
    expect(lines[0]).toMatch(/^SELECT/);
    expect(lines).toContain('FROM fact_alarms');
    expect(lines).toContain('GROUP BY severity');
  });
});
