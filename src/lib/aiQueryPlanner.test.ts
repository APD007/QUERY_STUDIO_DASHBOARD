import { describe, it, expect } from 'vitest';
import { planFromPrompt } from './aiQueryPlanner';
import { runQuery } from '@/modules/queries/engine';
import type { FieldSchema } from '@/modules/queries/schema';

const schema: FieldSchema[] = [
  { name: 'alarm_id', type: 'number' },
  { name: 'severity', type: 'text' },
  { name: 'vendor', type: 'text' },
  { name: 'is_active', type: 'bool' },
  { name: 'raised_time', type: 'date' },
  { name: 'mttr_min', type: 'number' },
];

const data = [
  { alarm_id: 1, severity: 'Critical', vendor: 'Nokia', is_active: true, raised_time: '2026-01-01 08:00', mttr_min: 12 },
  { alarm_id: 2, severity: 'Major', vendor: 'Ericsson', is_active: false, raised_time: '2026-01-01 09:00', mttr_min: 30 },
  { alarm_id: 3, severity: 'Critical', vendor: 'Nokia', is_active: true, raised_time: '2026-01-02 10:00', mttr_min: 5 },
  { alarm_id: 4, severity: 'Minor', vendor: 'Cisco', is_active: false, raised_time: '2026-01-02 11:00', mttr_min: 20 },
  { alarm_id: 5, severity: 'Critical', vendor: 'Ericsson', is_active: true, raised_time: '2026-01-03 12:00', mttr_min: 8 },
];

function plan(prompt: string) {
  return planFromPrompt(prompt, schema, data, 'fact_alarms');
}

describe('planFromPrompt', () => {
  it('builds a runnable pie chart grouped by severity for active alarms', () => {
    const res = plan('Show active alarms by severity as a pie chart');
    expect(res.ok).toBe(true);
    expect(res.plan?.chartType).toBe('pie');
    expect(res.plan?.dimensionField).toBe('severity');
    const result = runQuery(res.query!, res.data!, res.schema!);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every(r => typeof r.severity === 'string')).toBe(true);
  });

  it('builds a ranking/bar chart grouped by vendor', () => {
    const res = plan('Show top vendors by alarm count as a bar chart');
    expect(res.ok).toBe(true);
    expect(res.plan?.chartType).toBe('bar');
    expect(res.plan?.dimensionField).toBe('vendor');
    const result = runQuery(res.query!, res.data!, res.schema!);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('builds a trend/line chart with a derived period field', () => {
    const res = plan('Show alarm trend by day as a line chart');
    expect(res.ok).toBe(true);
    expect(res.plan?.chartType).toBe('line');
    const result = runQuery(res.query!, res.data!, res.schema!);
    expect(result.rows.length).toBe(3);
    expect(result.columns.some(c => c.label === 'period')).toBe(true);
  });

  it('builds an IN filter for "compare A and B" prompts', () => {
    const res = plan('Compare Nokia and Ericsson alarm counts');
    expect(res.ok).toBe(true);
    expect(res.plan?.filters).toHaveLength(1);
    expect(res.plan?.filters[0]).toMatchObject({ kind: 'in', field: 'vendor', values: ['Nokia', 'Ericsson'] });
    const result = runQuery(res.query!, res.data!, res.schema!);
    expect(result.rows.map(r => r.vendor).sort()).toEqual(['Ericsson', 'Nokia']);
  });

  it('falls back to a table for unrecognized requests with no matching fields', () => {
    const res = plan('Build a network operations dashboard');
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('runs a numeric aggregation (average) when a numeric field is mentioned', () => {
    const res = plan('Show average mttr_min by severity');
    expect(res.ok).toBe(true);
    expect(res.plan?.aggFn).toBe('AVG');
    const result = runQuery(res.query!, res.data!, res.schema!);
    expect(result.rows.length).toBeGreaterThan(0);
  });
});
