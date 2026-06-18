import { useEffect, useRef, useState } from 'react';
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import { format as formatSql } from 'sql-formatter';
import {
  Play, Save, Eraser, Copy, Wand2, Check, AlertCircle, Clock, Rows3,
  PieChart as PieIcon, BarChart3, Activity, AreaChart as AreaIcon, Hash, Table2, Sliders,
} from 'lucide-react';

import Panel from '@/components/Panel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import DatasetSidebar from '@/components/DatasetSidebar';

import ChartView from '@/modules/widgets/ChartView';
import WidgetForm, { type WidgetFormState } from '@/modules/widgets/WidgetForm';

import { runRawSql, type QueryResult } from '@/modules/queries/engine';
import { useQueryStore } from '@/modules/queries/store';
import { useWidgetStore } from '@/modules/widgets/store';
import { useDataStore } from '@/store/dataStore';
import { useSqlEditorStore } from '@/store/sqlEditorStore';
import { useQueryDraftStore } from '@/store/queryDraftStore';
import { parseSqlToQuery } from '@/lib/sqlParser';
import { buildDisplaySql } from '@/lib/sqlGenerator';
import { emptyKpiMeta, emptyLogicalGroup, type Query } from '@/types/expr';
import type { ChartType } from '@/types/widget';
import { C, SEV } from '@/palette';

const CHART_PICKS: [ChartType, string, typeof PieIcon][] = [
  ['table', 'Table', Table2],
  ['kpi',   'KPI',   Hash],
  ['bar',   'Bar',   BarChart3],
  ['pie',   'Pie',   PieIcon],
  ['line',  'Line',  Activity],
  ['area',  'Area',  AreaIcon],
];

export default function StudioSql({
  onGoToDashboard, onGoToBuilder,
}: {
  onGoToDashboard: () => void;
  onGoToBuilder: () => void;
}) {
  const { data, schema, sourceName } = useDataStore();
  const { queries, saveQuery } = useQueryStore();
  const { addWidget } = useWidgetStore();
  const sql = useSqlEditorStore(s => s.sql);
  const setSql = useSqlEditorStore(s => s.setSql);
  const setDraft = useQueryDraftStore(s => s.setDraft);

  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [execMs, setExecMs] = useState<number | null>(null);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [queryName, setQueryName] = useState('untitled_query');
  const [previewChart, setPreviewChart] = useState<ChartType>('table');
  const [widgetForm, setWidgetForm] = useState<WidgetFormState | null>(null);
  const schemaRef = useRef({ schema, tableName: sourceName });
  schemaRef.current = { schema, tableName: sourceName };

  const buildSqlQuery = (): Query => ({
    id: null,
    name: queryName,
    source: sourceName,
    mode: 'sql',
    rawSql: sql,
    select: [],
    where: emptyLogicalGroup('AND'),
    groupBy: [],
    orderBy: null,
    limit: null,
    joins: [],
    kpi: emptyKpiMeta(),
  });

  const runRef = useRef(() => {});
  const run = () => {
    const started = performance.now();
    try {
      const res = runRawSql(sql, data, schema, sourceName);
      setResult(res);
      setError(null);
      setExecMs(performance.now() - started);
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
      setExecMs(performance.now() - started);
    }
  };
  useEffect(() => { runRef.current = run; });

  const doSave = () => {
    const id = saveQuery(buildSqlQuery());
    return id;
  };

  const openWidgetForm = () => {
    let res = result;
    if (!res) {
      try { res = runRawSql(sql, data, schema, sourceName); setResult(res); } catch (err) {
        setError((err as Error).message);
        return;
      }
    }
    const id = doSave();
    const cols = res.columns;
    const dimCol = cols.find(c => c.type !== 'number') || cols[0];
    const metCol = cols.find(c => c.type === 'number') || cols[cols.length - 1];
    setWidgetForm({
      name: queryName, queryId: id, chart: previewChart === 'table' ? 'pie' : previewChart,
      dim: dimCol?.label ?? '', metric: metCol?.label ?? '', cols,
    });
  };

  const onWidgetSave = (form: WidgetFormState) => {
    addWidget({ name: form.name, queryId: form.queryId, chart: form.chart, dim: form.dim, metric: form.metric });
    setWidgetForm(null);
    onGoToDashboard();
  };

  const handleFormat = () => {
    try {
      setSql(formatSql(sql, { language: 'sql' }));
    } catch { /* leave as-is if it doesn't parse */ }
  };

  const handleCopy = () => { void navigator.clipboard.writeText(sql); };
  const handleClear = () => setSql('');

  const loadSavedQuery = (q: Query) => {
    setQueryName(q.name);
    setSql(q.mode === 'sql' && q.rawSql ? q.rawSql : buildDisplaySql(q));
    setResult(null);
    setError(null);
  };

  const handleLoadIntoBuilder = () => {
    const parsed = parseSqlToQuery(sql, sourceName);
    if (!parsed.ok) {
      setBuilderError(parsed.error);
      return;
    }
    setBuilderError(null);
    setDraft({ ...parsed.query, name: queryName });
    onGoToBuilder();
  };

  const beforeMount: BeforeMount = monaco => {
    // Avoid duplicate registrations across Studio remounts (tab switches).
    const w = window as unknown as { __qsSqlCompletionRegistered?: boolean };
    if (w.__qsSqlCompletionRegistered) return;
    w.__qsSqlCompletionRegistered = true;

    monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: ['.', ' '],
      provideCompletionItems: (model: import('monaco-editor').editor.ITextModel, position: import('monaco-editor').Position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        const { schema: liveSchema, tableName } = schemaRef.current;
        const keywordSuggestions = [
          'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
          'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL',
          'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
          'ASC', 'DESC',
        ].map(kw => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
        }));
        const tableSuggestion = {
          label: tableName,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: tableName,
          detail: 'table',
          range,
        };
        const fieldSuggestions = liveSchema.map(f => ({
          label: f.name,
          kind: monaco.languages.CompletionItemKind.Field,
          insertText: f.name,
          detail: f.type,
          range,
        }));
        return { suggestions: [tableSuggestion, ...fieldSuggestions, ...keywordSuggestions] };
      },
    });
  };

  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  };

  const resultCols = result?.columns ?? [];
  const previewQuery: Query = { ...buildSqlQuery(), id: '_preview' };

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 mx-auto" style={{ maxWidth: 1600 }}>
      <DatasetSidebar onSelectQuery={loadSavedQuery} />
      <div className="flex-1 min-w-0 space-y-4">
      <Panel>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <input
            value={queryName}
            onChange={e => setQueryName(e.target.value)}
            style={{ color: C.ink }}
            className="font-bold text-lg bg-transparent outline-none flex-1 min-w-0"
          />
          <span style={{ color: C.mut }} className="text-xs">
            Querying <strong style={{ color: C.ink }}>{sourceName}</strong> · {data.length.toLocaleString()} rows
          </span>
        </div>

        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
          <Editor
            height="320px"
            language="sql"
            value={sql}
            onChange={v => setSql(v ?? '')}
            beforeMount={beforeMount}
            onMount={onMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 12 },
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button variant="good" onClick={run}><Play size={14} /> Run query</Button>
          <Button variant="ghost" onClick={doSave}><Save size={14} /> Save query</Button>
          <Button variant="ghost" onClick={handleFormat}><Wand2 size={14} /> Format SQL</Button>
          <Button variant="ghost" onClick={handleCopy}><Copy size={14} /> Copy</Button>
          <Button variant="ghost" onClick={handleClear}><Eraser size={14} /> Clear</Button>
          <Button onClick={openWidgetForm}><PieIcon size={14} /> Create widget</Button>
          <Button variant="ghost" onClick={handleLoadIntoBuilder}><Sliders size={14} /> Load into Builder</Button>
          <span style={{ color: C.mut }} className="text-xs ml-auto">Ctrl/Cmd + Enter to run</span>
        </div>
        {builderError && (
          <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8 }} className="text-xs p-2.5 mt-2">
            {builderError}
          </div>
        )}
      </Panel>

      {(result || error) && (
        <Panel>
          <div className="flex items-center gap-4 flex-wrap mb-2">
            {error ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#dc2626' }}>
                <AlertCircle size={14} /> Error
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#16a34a' }}>
                <Check size={14} /> Success
              </span>
            )}
            {!error && (
              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: C.mut }}>
                <Rows3 size={13} /> {result?.rows.length.toLocaleString()} rows
              </span>
            )}
            {execMs != null && (
              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: C.mut }}>
                <Clock size={13} /> {execMs.toFixed(1)} ms
              </span>
            )}
          </div>

          {error ? (
            <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8 }} className="text-sm p-3 font-mono">
              {error}
            </div>
          ) : result && (
            <div className="overflow-auto max-h-96" style={{ border: `1px solid ${C.line}`, borderRadius: 10 }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr style={{ background: C.skyl }}>
                    {resultCols.map(col => (
                      <th key={col.label} style={{ color: C.ink }} className="text-left font-semibold px-3 py-2 whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                      {resultCols.map(col => {
                        const isSev = col.label === 'severity';
                        const val = row[col.label];
                        return (
                          <td key={col.label} className="px-3 py-1.5 whitespace-nowrap">
                            {isSev ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span style={{
                                  background: SEV[String(val)] || C.mut,
                                  width: 8, height: 8, borderRadius: 99, display: 'inline-block',
                                }} />
                                {String(val ?? '')}
                              </span>
                            ) : (
                              <span style={{ color: C.text }}>{String(val ?? '')}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {result && !error && (
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <Label>Widget preview</Label>
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: C.page }}>
              {CHART_PICKS.map(([k, l, I]) => (
                <button
                  key={k}
                  onClick={() => setPreviewChart(k)}
                  type="button"
                  style={previewChart === k ? { background: '#fff', color: C.ink } : { color: C.mut }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold"
                >
                  <I size={13} /> {l}
                </button>
              ))}
            </div>
          </div>
          <ChartView
            widget={{
              chart: previewChart,
              queryId: '_preview',
              dim: (resultCols.find(c => c.type !== 'number') || resultCols[0])?.label ?? '',
              metric: (resultCols.find(c => c.type === 'number') || resultCols[resultCols.length - 1])?.label ?? '',
            }}
            queries={[previewQuery]}
            data={data}
            schema={schema}
            height={260}
          />
        </Panel>
      )}
      </div>

      {widgetForm && (
        <WidgetForm
          initialForm={widgetForm}
          queries={queries}
          data={data}
          schema={schema}
          onSave={onWidgetSave}
          onCancel={() => setWidgetForm(null)}
        />
      )}
    </div>
  );
}
