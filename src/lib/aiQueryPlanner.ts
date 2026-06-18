/* ============================================================
   Rule-based natural-language → Query planner for the AI Assistant tab.

   This is deliberately NOT a call to an external LLM — it's a keyword/
   field-matching engine that turns a handful of recognizable request
   shapes ("show X by Y as a chart", "top N", "trend by day", "compare
   A and B", "last N days", ...) into the same `Query` model the visual
   Query Builder and Studio already produce, then reuses the existing
   SQL generator/engine to run it. Ambiguous or unrecognized prompts are
   reported back as `ok: false` with a message instead of guessing.
   ============================================================ */

import {
  type CompareOp, type ExprNode, type InNode, type CompareNode, type LogicalNode,
  type Query, type SelectItem, type AggFn, type LiteralValueType, type FieldType,
  emptyKpiMeta, nextId,
} from '@/types/expr';
import type { FieldSchema } from '@/modules/queries/schema';
import type { ChartType } from '@/types/widget';

export type AiIntent = 'distribution' | 'ranking' | 'trend' | 'kpi' | 'table';

export type AiFilter =
  | { kind: 'compare'; field: string; op: CompareOp; value: number | string | boolean; valueType: LiteralValueType; label: string }
  | { kind: 'in'; field: string; values: (number | string)[]; valueType: LiteralValueType; label: string };

export interface AiPlan {
  intent: AiIntent;
  dimensionField: string | null;
  metricField: string | null;
  aggFn: AggFn;
  filters: AiFilter[];
  chartType: ChartType;
  limit: number | null;
  warnings: string[];
}

export interface AiPlanResult {
  ok: boolean;
  plan: AiPlan | null;
  query: Query | null;
  data: Record<string, unknown>[] | null;
  schema: FieldSchema[] | null;
  error?: string;
}

/* ---------------- text helpers ---------------- */

const norm = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const STOPWORDS = new Set(['is', 'has', 'the', 'a', 'an', 'of', 'id']);
function fieldTokens(name: string): string[] {
  return norm(name).split(' ').filter(w => w && !STOPWORDS.has(w));
}

// Types are tried in priority order (e.g. text before bool) so that a boolean
// flag like "is_active" doesn't shadow a more specific text field such as
// "severity" just because its token ("active") happens to appear earlier.
function pickField(schema: FieldSchema[], promptNorm: string, promptWords: Set<string>, types: FieldType[]): FieldSchema | null {
  for (const type of types) {
    let best: { f: FieldSchema; pos: number } | null = null;
    for (const f of schema.filter(s => s.type === type)) {
      const tokens = fieldTokens(f.name);
      if (!tokens.length) continue;
      const allMatch = tokens.every(t =>
        promptWords.has(t) || [...promptWords].some(w => w.length > 2 && (w.includes(t) || t.includes(w)))
      );
      if (!allMatch) continue;
      const pos = promptNorm.indexOf(tokens[0]);
      if (best === null || pos < best.pos) best = { f, pos };
    }
    if (best) return best.f;
  }
  return null;
}

function distinctValues(data: Record<string, unknown>[], field: string, sampleCap = 500): unknown[] {
  const seen = new Set<unknown>();
  for (let i = 0; i < data.length && i < sampleCap; i++) {
    const v = data[i][field];
    if (v != null && v !== '') seen.add(v);
    if (seen.size > 50) break;
  }
  return [...seen];
}

function findValueFilter(schema: FieldSchema[], data: Record<string, unknown>[], promptWords: Set<string>): AiFilter | null {
  for (const f of schema.filter(s => s.type === 'bool')) {
    const tokens = fieldTokens(f.name);
    if (tokens.some(t => promptWords.has(t))) {
      return { kind: 'compare', field: f.name, op: '=', value: true, valueType: 'boolean', label: `${f.name} = true` };
    }
  }
  for (const f of schema.filter(s => s.type === 'text')) {
    for (const v of distinctValues(data, f.name)) {
      if (promptWords.has(norm(String(v)))) {
        return { kind: 'compare', field: f.name, op: '=', value: v as string, valueType: 'string', label: `${f.name} = "${v}"` };
      }
    }
  }
  return null;
}

function truncateDate(value: unknown, granularity: 'day' | 'week' | 'month'): string | null {
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return null;
  if (granularity === 'month') return d.toISOString().slice(0, 7);
  if (granularity === 'week') {
    const day = d.getUTCDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + diff);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function uniqueFieldName(schema: FieldSchema[], base: string): string {
  let name = base;
  let i = 1;
  while (schema.some(f => f.name === name)) {
    name = `${base}_${i}`;
    i += 1;
  }
  return name;
}

/* ---------------- main planner ---------------- */

export function planFromPrompt(
  promptRaw: string,
  schema: FieldSchema[],
  data: Record<string, unknown>[],
  sourceName: string
): AiPlanResult {
  const prompt = promptRaw.trim();
  if (!prompt) {
    return { ok: false, plan: null, query: null, data: null, schema: null, error: 'Type a request first.' };
  }

  const p = norm(prompt);
  const promptWords = new Set(p.split(' ').filter(Boolean));
  const warnings: string[] = [];
  const has = (...kws: string[]) => kws.some(k => p.includes(norm(k)));

  let intent: AiIntent | 'unknown' = 'unknown';
  let chartType: ChartType = 'table';

  if (has('trend', 'over time', 'by day', 'by week', 'by month', 'daily', 'weekly', 'monthly')) {
    intent = 'trend'; chartType = 'line';
  } else if (has('compare', 'vs', 'versus', 'top', 'highest', 'lowest', 'ranking', 'rank')) {
    intent = 'ranking'; chartType = 'bar';
  } else if (has('distribution', 'share', 'percentage', 'percent', 'breakdown', 'pie', 'donut')) {
    intent = 'distribution'; chartType = 'pie';
  } else if (has('kpi', 'total', 'how many', 'count of', 'summary')) {
    intent = 'kpi'; chartType = 'kpi';
  } else if (has('table', 'list', 'detail', 'records', 'drilldown', 'show all')) {
    intent = 'table'; chartType = 'table';
  }

  if (has('pie chart', 'donut chart')) chartType = 'pie';
  if (has('bar chart')) chartType = 'bar';
  if (has('line chart')) chartType = 'line';
  if (has('area chart')) chartType = 'area';
  if (has('kpi card', 'kpi cards')) { chartType = 'kpi'; if (intent === 'unknown') intent = 'kpi'; }

  let dimensionField = pickField(schema, p, promptWords, ['text', 'bool']);

  let aggFn: AggFn = 'COUNT';
  if (has('average', 'avg')) aggFn = 'AVG';
  else if (has('sum', 'total')) aggFn = 'SUM';
  else if (has('minimum') || /\bmin\b/.test(p)) aggFn = 'MIN';
  else if (has('maximum') || /\bmax\b/.test(p)) aggFn = 'MAX';

  let metricField: FieldSchema | null = null;
  if (aggFn !== 'COUNT') {
    metricField = pickField(schema, p, promptWords, ['number']);
    if (!metricField) {
      warnings.push(`Couldn't find a numeric field to ${aggFn.toLowerCase()} — counting rows instead.`);
      aggFn = 'COUNT';
    }
  }

  let timeField: FieldSchema | null = null;
  let granularity: 'day' | 'week' | 'month' = 'day';
  if (intent === 'trend') {
    if (has('month', 'monthly')) granularity = 'month';
    else if (has('week', 'weekly')) granularity = 'week';
    timeField = pickField(schema, p, promptWords, ['date']) ?? schema.find(f => f.type === 'date') ?? null;
    if (!timeField) {
      warnings.push('No date/time field found in this dataset — showing a table instead.');
      intent = 'table';
      chartType = 'table';
    }
  }

  const filters: AiFilter[] = [];
  const valueFilter = findValueFilter(schema, data, promptWords);
  if (valueFilter) filters.push(valueFilter);

  const lastDaysMatch = p.match(/last (\d+) days?/);
  if (lastDaysMatch) {
    const dateField = schema.find(f => f.type === 'date');
    if (dateField) {
      const days = Number(lastDaysMatch[1]);
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      filters.push({ kind: 'compare', field: dateField.name, op: '>=', value: since, valueType: 'date', label: `${dateField.name} >= last ${days} days` });
    } else {
      warnings.push(`Couldn't filter to the last ${lastDaysMatch[1]} days — no date field found.`);
    }
  }

  let limit: number | null = null;
  let orderDesc = true;
  const topMatch = p.match(/(?:top|highest) (\d+)/) || p.match(/(\d+)\s+(?:highest|top)/);
  if (topMatch) limit = Number(topMatch[1]);
  if (has('lowest', 'bottom')) orderDesc = false;

  let compareValues: string[] | null = null;
  const compareMatch = prompt.match(/compare\s+(.+?)\s+and\s+(.+)/i) ?? prompt.match(/(.+?)\s+vs\.?\s+(.+)/i);
  if (compareMatch) {
    const cleanup = (s: string) => norm(s.replace(/\b(alarms?|counts?|records?|incidents?)\b/gi, ''));
    const a = cleanup(compareMatch[1]);
    const b = cleanup(compareMatch[2]);
    // The compared values (e.g. "Nokia", "Ericsson") usually appear without
    // their column name in the prompt, so search every text field's actual
    // values rather than relying on dimensionField already being resolved.
    const candidateFields = dimensionField ? [dimensionField, ...schema.filter(s => s.type === 'text')] : schema.filter(s => s.type === 'text');
    for (const f of candidateFields) {
      const values = distinctValues(data, f.name).map(String);
      const matchA = values.find(v => { const vn = norm(v); return !!a && (vn === a || vn.includes(a) || a.includes(vn)); });
      const matchB = values.find(v => { const vn = norm(v); return !!b && (vn === b || vn.includes(b) || b.includes(vn)); });
      if (matchA && matchB) {
        compareValues = [matchA, matchB];
        dimensionField = f;
        intent = 'ranking';
        if (chartType === 'table') chartType = 'bar';
        break;
      }
    }
  }
  if (compareValues && dimensionField) {
    // The IN filter supersedes any single-value filter findValueFilter already
    // picked up on the same field (e.g. matching "Nokia" on its own).
    const dupIdx = filters.findIndex(f => f.field === dimensionField!.name);
    if (dupIdx !== -1) filters.splice(dupIdx, 1);
    filters.push({ kind: 'in', field: dimensionField.name, values: compareValues, valueType: 'string', label: `${dimensionField.name} in (${compareValues.join(', ')})` });
  }

  const hasAnySignal = !!(dimensionField || metricField || timeField || compareValues || filters.length);
  if (intent === 'unknown' && !hasAnySignal) {
    return {
      ok: false, plan: null, query: null, data: null, schema: null,
      error: `Couldn't figure out what to show for "${prompt}". Mention a field (e.g. severity, vendor, status), a chart type, or a shape like "top N", "trend by day", or "compare A and B" — or try one of the example prompts below.`,
    };
  }

  if (intent === 'unknown') {
    if (dimensionField) {
      intent = 'distribution'; chartType = 'pie';
      warnings.push(`Assumed a distribution/pie chart grouped by "${dimensionField.name}" — change the chart type below if you wanted something else.`);
    } else {
      intent = 'table'; chartType = 'table';
      warnings.push("Showing a table since the request didn't clearly map to a chart type — pick one below if you want a visualization.");
    }
  }

  if (intent === 'kpi' && !dimensionField && !metricField && !compareValues && filters.length === 0) {
    warnings.push('Showing the total row count, since no specific metric or filter was recognized in this dataset — mention a field name or value (e.g. "active", "severity") for a more specific KPI.');
  }
  if (intent === 'kpi' && filters.length > 0 && (p.match(/\b(active|cleared|open|closed|resolved)\b/g)?.length ?? 0) > 1) {
    warnings.push('Generated one KPI as a starting point — for multiple KPI cards, create one widget per metric and add each to your dashboard.');
  }

  /* ---- build the Query from the resolved plan ---- */

  let workingData = data;
  let workingSchema = schema;
  let groupField: { name: string; label: string } | null = null;

  if (intent === 'trend' && timeField) {
    const periodLabel = uniqueFieldName(schema, 'period');
    workingData = data.map(row => ({ ...row, [periodLabel]: truncateDate(row[timeField!.name], granularity) ?? '' }));
    workingSchema = [...schema, { name: periodLabel, type: 'text' }];
    groupField = { name: periodLabel, label: periodLabel };
  } else if (intent === 'distribution' || intent === 'ranking') {
    if (dimensionField) groupField = { name: dimensionField.name, label: dimensionField.name };
  }

  const metricExpr: ExprNode = aggFn === 'COUNT'
    ? { kind: 'agg', fn: 'COUNT', arg: '*' }
    : { kind: 'agg', fn: aggFn, arg: { kind: 'field', name: metricField!.name } };
  const metricLabel = aggFn === 'COUNT' ? 'count' : `${aggFn.toLowerCase()}_${metricField!.name}`;

  let select: SelectItem[];
  let groupBy: string[] = [];
  let orderBy: Query['orderBy'] = null;

  if (intent === 'table') {
    select = [];
  } else if (!groupField) {
    select = [{ id: nextId('sel'), expr: metricExpr, label: metricLabel }];
    chartType = 'kpi';
  } else {
    select = [
      { id: nextId('sel'), expr: { kind: 'field', name: groupField.name }, label: groupField.label },
      { id: nextId('sel'), expr: metricExpr, label: metricLabel },
    ];
    groupBy = [groupField.name];
    orderBy = intent === 'trend'
      ? { field: groupField.label, dir: 'asc' }
      : { field: metricLabel, dir: orderDesc ? 'desc' : 'asc' };
  }

  const whereChildren: ExprNode[] = filters.map(f => {
    if (f.kind === 'in') {
      return {
        kind: 'in', id: nextId('in'),
        target: { kind: 'field', name: f.field },
        list: f.values.map(v => ({ kind: 'literal', valueType: f.valueType, value: v })),
      } as InNode;
    }
    return {
      kind: 'compare', id: nextId('cmp'), op: f.op,
      left: { kind: 'field', name: f.field },
      right: { kind: 'literal', valueType: f.valueType, value: f.value },
    } as CompareNode;
  });
  const where: LogicalNode = { kind: 'logical', id: nextId('grp'), op: 'AND', children: whereChildren };

  const finalLimit = limit ?? (intent === 'table' ? 200 : null);

  const query: Query = {
    id: null,
    name: prompt.length > 48 ? `${prompt.slice(0, 45)}...` : prompt,
    source: sourceName,
    mode: 'visual',
    rawSql: '',
    select,
    where,
    groupBy,
    orderBy,
    limit: finalLimit,
    joins: [],
    kpi: emptyKpiMeta(),
  };

  const plan: AiPlan = {
    intent,
    dimensionField: dimensionField?.name ?? null,
    metricField: metricField?.name ?? null,
    aggFn,
    filters,
    chartType,
    limit: finalLimit,
    warnings,
  };

  return { ok: true, plan, query, data: workingData, schema: workingSchema };
}
