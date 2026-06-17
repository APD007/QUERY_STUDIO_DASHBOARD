import { describe, it, expect } from 'vitest';
import { inferType, buildSchema } from './schema';

describe('inferType', () => {
  it('infers number for numeric-looking values', () => {
    expect(inferType([1, 2, 3])).toBe('number');
    expect(inferType(['1', '2.5', '-3'])).toBe('number');
  });

  it('infers bool for true/false-looking values', () => {
    expect(inferType([true, false, true])).toBe('bool');
    expect(inferType(['true', 'false', 'TRUE'])).toBe('bool');
  });

  it('infers date for date-like strings', () => {
    expect(inferType(['2024-01-01', '2024-02-15'])).toBe('date');
  });

  it('falls back to text for mixed/non-numeric strings', () => {
    expect(inferType(['Critical', 'Major', 'Minor'])).toBe('text');
  });

  it('defaults to text when every value is empty/null', () => {
    expect(inferType([null, '', undefined])).toBe('text');
  });
});

describe('buildSchema', () => {
  it('returns one entry per column, typed from the sampled rows', () => {
    const rows = [
      { severity: 'Critical', mttr_min: 12, is_active: true },
      { severity: 'Major', mttr_min: 30, is_active: false },
    ];
    const schema = buildSchema(rows);
    expect(schema).toEqual([
      { name: 'severity', type: 'text' },
      { name: 'mttr_min', type: 'number' },
      { name: 'is_active', type: 'bool' },
    ]);
  });

  it('returns an empty schema for no rows', () => {
    expect(buildSchema([])).toEqual([]);
  });
});
