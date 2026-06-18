import { useState } from 'react';
import {
  Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp, Code2, Check,
  PieChart as PieIcon, BarChart3, Activity, AreaChart as AreaIcon, Hash, Table2,
} from 'lucide-react';

import Panel from '@/components/Panel';
import { Button } from '@/components/ui/button';

import ChartView from '@/modules/widgets/ChartView';
import WidgetForm, { type WidgetFormState } from '@/modules/widgets/WidgetForm';

import { runQuery, type QueryResult } from '@/modules/queries/engine';
import { useQueryStore } from '@/modules/queries/store';
import { useWidgetStore } from '@/modules/widgets/store';
import { useDataStore } from '@/store/dataStore';
import { useSqlEditorStore } from '@/store/sqlEditorStore';
import { planFromPrompt, type AiPlan } from '@/lib/aiQueryPlanner';
import { buildDisplaySql } from '@/lib/sqlGenerator';
import type { Query } from '@/types/expr';
import type { FieldSchema } from '@/modules/queries/schema';
import type { ChartType } from '@/types/widget';
import { C } from '@/palette';

const EXAMPLE_PROMPTS = [
  'Show active alarms by severity as a pie chart',
  'Show top 10 vendors by alarm count as a bar chart',
  'Show alarm trend by day as a line chart',
  'Compare Nokia and Ericsson alarm counts',
  'Show all incidents for the last 7 days',
];

const CHART_PICKS: [ChartType, string, typeof PieIcon][] = [
  ['table', 'Table', Table2],
  ['kpi',   'KPI',   Hash],
  ['bar',   'Bar',   BarChart3],
  ['pie',   'Pie',   PieIcon],
  ['line',  'Line',  Activity],
  ['area',  'Area',  AreaIcon],
];

export default function AiAssistantPage({
  onGoToStudio, onGoToDashboard,
}: {
  onGoToStudio: () => void;
  onGoToDashboard: () => void;
}) {
  const { data, schema, sourceName } = useDataStore();
  const { queries, saveQuery } = useQueryStore();
  const { addWidget } = useWidgetStore();
  const setSql = useSqlEditorStore(s => s.setSql);

  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [query, setQuery] = useState<Query | null>(null);
  const [runData, setRunData] = useState<Record<string, unknown>[]>(data);
  const [runSchema, setRunSchema] = useState<FieldSchema[]>(schema);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [chartType, setChartType] = useState<ChartType>('table');
  const [error, setError] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [widgetForm, setWidgetForm] = useState<WidgetFormState | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = (text?: string) => {
    const text2 = (text ?? prompt).trim();
    if (!text2) return;
    setPrompt(text2);
    setBusy(true);
    setError(null);

    const planned = planFromPrompt(text2, schema, data, sourceName);
    if (!planned.ok || !planned.query || !planned.plan || !planned.data || !planned.schema) {
      setPlan(null);
      setQuery(null);
      setResult(null);
      setError(planned.error ?? "Couldn't understand that request.");
      setBusy(false);
      return;
    }

    try {
      const res = runQuery(planned.query, planned.data, planned.schema);
      setPlan(planned.plan);
      setQuery(planned.query);
      setRunData(planned.data);
      setRunSchema(planned.schema);
      setChartType(planned.plan.chartType);
      setResult(res);
      setError(null);
    } catch (err) {
      setPlan(planned.plan);
      setQuery(planned.query);
      setResult(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const previewQuery: Query | null = query ? { ...query, id: '_ai_preview' } : null;

  const openWidgetForm = () => {
    if (!query || !result) return;
    const id = saveQuery(query);
    const cols = result.columns;
    const dimCol = cols.find(c => c.type !== 'number') || cols[0];
    const metCol = cols.find(c => c.type === 'number') || cols[cols.length - 1];
    setWidgetForm({
      name: query.name, queryId: id, chart: chartType === 'table' ? 'pie' : chartType,
      dim: dimCol?.label ?? '', metric: metCol?.label ?? '', cols,
    });
  };

  const onWidgetSave = (form: WidgetFormState) => {
    addWidget({ name: form.name, queryId: form.queryId, chart: form.chart, dim: form.dim, metric: form.metric });
    setWidgetForm(null);
    onGoToDashboard();
  };

  const editInStudio = () => {
    if (!query) return;
    setSql(buildDisplaySql(query));
    onGoToStudio();
  };

  return (
    <div className="p-4 mx-auto space-y-4" style={{ maxWidth: 1400 }}>
      <Panel>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} style={{ color: C.blue }} />
          <span style={{ color: C.ink }} className="font-bold text-lg">AI Assistant</span>
        </div>
        <div style={{ color: C.mut }} className="text-sm mb-3">
          Describe what you want to see in plain English — querying{' '}
          <strong style={{ color: C.ink }}>{sourceName}</strong> ({data.length.toLocaleString()} rows). No SQL needed.
        </div>
        <div className="flex items-center gap-2">
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') generate(); }}
            placeholder='e.g. "Show active alarms by severity as a pie chart"'
            style={{ border: `1px solid ${C.line}`, borderRadius: 10 }}
            className="flex-1 px-3 py-2 text-sm outline-none"
          />
          <Button onClick={() => generate()} disabled={busy || !prompt.trim()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {EXAMPLE_PROMPTS.map(ex => (
            <button
              key={ex}
              type="button"
              onClick={() => generate(ex)}
              style={{ background: C.page, color: C.mut }}
              className="text-xs rounded-full px-2.5 py-1"
            >
              {ex}
            </button>
          ))}
        </div>
      </Panel>

      {plan && plan.warnings.length > 0 && (
        <Panel>
          {plan.warnings.map((w, i) => (
            <div key={i} style={{ color: '#b45309', background: '#fffbeb' }} className="text-sm rounded-lg px-3 py-2 mb-1.5 last:mb-0">
              {w}
            </div>
          ))}
        </Panel>
      )}

      {error && (
        <Panel>
          <div className="flex items-center gap-1.5 mb-1" style={{ color: '#dc2626' }}>
            <AlertCircle size={14} /> <span className="text-sm font-semibold">{error}</span>
          </div>
          <div style={{ color: C.mut }} className="text-xs">Try rephrasing, or tap one of the example prompts above.</div>
          {query && (
            <div style={{ background: C.page, borderRadius: 8 }} className="p-2 mt-2 text-xs font-mono whitespace-pre-wrap">
              {buildDisplaySql(query)}
            </div>
          )}
        </Panel>
      )}

      {result && query && previewQuery && (
        <Panel>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Check size={14} style={{ color: '#16a34a' }} />
              <span style={{ color: C.ink }} className="text-sm font-semibold">{result.rows.length.toLocaleString()} rows</span>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: C.page }}>
              {CHART_PICKS.map(([k, l, I]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setChartType(k)}
                  style={chartType === k ? { background: '#fff', color: C.ink } : { color: C.mut }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold"
                >
                  <I size={13} /> {l}
                </button>
              ))}
            </div>
          </div>

          {chartType === 'table' ? (
            <div className="overflow-auto max-h-96" style={{ border: `1px solid ${C.line}`, borderRadius: 10 }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr style={{ background: C.skyl }}>
                    {result.columns.map(col => (
                      <th key={col.label} style={{ color: C.ink }} className="text-left font-semibold px-3 py-2 whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                      {result.columns.map(col => (
                        <td key={col.label} className="px-3 py-1.5 whitespace-nowrap" style={{ color: C.text }}>
                          {String(row[col.label] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ChartView
              widget={{
                chart: chartType,
                queryId: '_ai_preview',
                dim: (result.columns.find(c => c.type !== 'number') || result.columns[0])?.label ?? '',
                metric: (result.columns.find(c => c.type === 'number') || result.columns[result.columns.length - 1])?.label ?? '',
              }}
              queries={[previewQuery]}
              data={runData}
              schema={runSchema}
              height={280}
            />
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Button onClick={openWidgetForm}><PieIcon size={14} /> Create widget</Button>
            <Button variant="ghost" onClick={editInStudio}><Code2 size={14} /> Edit SQL in Studio</Button>
            <button
              type="button"
              onClick={() => setShowSql(s => !s)}
              style={{ color: C.mut }}
              className="text-xs inline-flex items-center gap-1 ml-auto"
            >
              {showSql ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {showSql ? 'Hide' : 'Show'} generated SQL
            </button>
          </div>
          {showSql && (
            <div style={{ background: C.page, borderRadius: 8 }} className="p-3 mt-2 text-xs font-mono whitespace-pre-wrap">
              {buildDisplaySql(query)}
            </div>
          )}
        </Panel>
      )}

      {widgetForm && (
        <WidgetForm
          initialForm={widgetForm}
          queries={queries}
          data={runData}
          schema={runSchema}
          onSave={onWidgetSave}
          onCancel={() => setWidgetForm(null)}
        />
      )}
    </div>
  );
}
