import { describe, it, expect } from 'vitest';
import { parseSqlToQuery } from './sqlParser';
import { buildDisplaySql } from './sqlGenerator';

describe('parseSqlToQuery', () => {
  it('parses a simple SELECT with a WHERE clause', () => {
    const result = parseSqlToQuery("SELECT severity FROM fact_alarms WHERE severity = 'Critical'", 'fact_alarms');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.select).toHaveLength(1);
    expect(result.query.select[0].label).toBe('severity');
    expect(result.query.where.children).toHaveLength(1);
  });

  it('parses GROUP BY, an aliased aggregate, ORDER BY and LIMIT', () => {
    const sql = 'SELECT severity, COUNT(*) AS cnt FROM fact_alarms GROUP BY severity ORDER BY cnt DESC LIMIT 10';
    const result = parseSqlToQuery(sql, 'fact_alarms');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.groupBy).toEqual(['severity']);
    expect(result.query.select[1].label).toBe('cnt');
    expect(result.query.orderBy).toEqual({ field: 'cnt', dir: 'desc' });
    expect(result.query.limit).toBe(10);
  });

  it('flattens a chain of AND conditions into one group', () => {
    const sql = "SELECT severity FROM fact_alarms WHERE severity = 'Critical' AND mttr_min > 10 AND mttr_min < 100";
    const result = parseSqlToQuery(sql, 'fact_alarms');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.where.op).toBe('AND');
    expect(result.query.where.children).toHaveLength(3);
  });

  it('preserves an explicitly parenthesized OR sub-group', () => {
    const sql = "SELECT severity FROM fact_alarms WHERE severity = 'Critical' AND (mttr_min > 10 OR mttr_min < 1)";
    const result = parseSqlToQuery(sql, 'fact_alarms');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.where.children).toHaveLength(2);
    const sub = result.query.where.children[1];
    expect(sub.kind).toBe('logical');
  });

  it('round-trips BETWEEN, IN, and LIKE conditions back to equivalent SQL', () => {
    const sql = "SELECT severity FROM fact_alarms WHERE mttr_min BETWEEN 1 AND 10 AND severity IN ('Critical', 'Major') AND severity LIKE 'C%'";
    const result = parseSqlToQuery(sql, 'fact_alarms');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kinds = result.query.where.children.map(c => c.kind);
    expect(kinds).toEqual(['between', 'in', 'like']);
  });

  it('treats SELECT * as an empty select list', () => {
    const result = parseSqlToQuery('SELECT * FROM fact_alarms', 'fact_alarms');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.select).toHaveLength(0);
  });

  it('round-trips back to equivalent SQL via buildDisplaySql', () => {
    const sql = 'SELECT severity, COUNT(*) AS cnt FROM fact_alarms GROUP BY severity';
    const result = parseSqlToQuery(sql, 'fact_alarms');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rendered = buildDisplaySql(result.query);
    expect(rendered).toContain('SELECT severity,\n       COUNT(*) AS cnt');
    expect(rendered).toContain('GROUP BY severity');
  });

  it('rejects malformed SQL', () => {
    const result = parseSqlToQuery('SELEC severity FROM fact_alarms', 'fact_alarms');
    expect(result.ok).toBe(false);
  });

  it('rejects multi-table joins', () => {
    const result = parseSqlToQuery('SELECT a FROM t1 JOIN t2 ON t1.id = t2.id', 't1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/join/i);
  });

  it('rejects a FROM table that does not match the active dataset', () => {
    const result = parseSqlToQuery('SELECT a FROM other_table', 'fact_alarms');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/active dataset/i);
  });

  it('rejects IS NULL conditions', () => {
    const result = parseSqlToQuery('SELECT a FROM fact_alarms WHERE a IS NULL', 'fact_alarms');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/IS NULL/);
  });

  it('rejects HAVING clauses', () => {
    const result = parseSqlToQuery(
      'SELECT severity, COUNT(*) AS cnt FROM fact_alarms GROUP BY severity HAVING COUNT(*) > 5',
      'fact_alarms'
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/HAVING/);
  });
});
