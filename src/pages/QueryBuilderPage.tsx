import { useEffect, useRef, useState } from 'react';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import Papa from 'papaparse';
import {
  Upload, Database, Play, Save, PieChart as PieIcon, Table2, BarChart3,
  Check, ChevronRight, ChevronLeft, Code2,
} from 'lucide-react';

import Panel from '@/components/Panel';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import DatasetSidebar from '@/components/DatasetSidebar';
import ResultTable from '@/components/ResultTable';
import { toast } from '@/components/toast/store';

import OperatorPalette from '@/modules/queries/components/OperatorPalette';
import FieldExplorer from '@/modules/queries/components/FieldExplorer';
import SelectBuilder from '@/modules/queries/components/SelectBuilder';
import FilterBuilder from '@/modules/queries/components/FilterBuilder';
import GroupByBuilder from '@/modules/queries/components/GroupByBuilder';
import OrderByLimitBuilder from '@/modules/queries/components/OrderByLimitBuilder';
import KpiMetaForm from '@/modules/queries/components/KpiMetaForm';
import JoinBuilder from '@/modules/queries/components/JoinBuilder';
import SqlPreview from '@/modules/queries/components/SqlPreview';
import QueryValidatorPanel from '@/modules/queries/components/QueryValidatorPanel';

import ChartView from '@/modules/widgets/ChartView';
import WidgetForm, { type WidgetFormState } from '@/modules/widgets/WidgetForm';

import { buildSchema } from '@/modules/queries/schema';
import { runQuery, type QueryResult } from '@/modules/queries/engine';
import { useQueryStore } from '@/modules/queries/store';
import { useWidgetStore } from '@/modules/widgets/store';
import { useDataStore } from '@/store/dataStore';
import { useQueryDraftStore } from '@/store/queryDraftStore';
import { useSqlEditorStore } from '@/store/sqlEditorStore';
import { validateQuery } from '@/lib/validateQuery';
import { buildDisplaySql } from '@/lib/sqlGenerator';
import { field, compare } from '@/lib/exprBuilders';
import type { AggFn, ValidationResult, Query } from '@/types/expr';
import type { DragData, DropData } from '@/types/dnd';
import type { RowOp } from '@/lib/conditionOps';
import { C } from '@/palette';

type Step = 'dataset' | 'columns' | 'filters' | 'aggregations' | 'groupby' | 'sql';
const STEPS: { key: Step; label: string }[] = [
  { key: 'dataset', label: 'Select dataset' },
  { key: 'columns', label: 'Select columns' },
  { key: 'filters', label: 'Add filters' },
  { key: 'aggregations', label: 'Add aggregations' },
  { key: 'groupby', label: 'Group by' },
  { key: 'sql', label: 'Generate SQL' },
];

export default function QueryBuilderPage({
  onGoToStudio, onGoToDashboard,
}: {
  onGoToStudio: () => void;
  onGoToDashboard: () => void;
}) {
  const { data, schema, sourceName, loadCSV, resetSample, joinTables, loadJoinTable } = useDataStore();
  const { queries, saveQuery } = useQueryStore();
  const { addWidget } = useWidgetStore();

  const draft = useQueryDraftStore(s => s.draft);
  const setDraft = useQueryDraftStore(s => s.setDraft);
  const resetDraft = useQueryDraftStore(s => s.resetDraft);
  const setName = useQueryDraftStore(s => s.setName);
  const addSelectItem = useQueryDraftStore(s => s.addSelectItem);
  const removeSelectItem = useQueryDraftStore(s => s.removeSelectItem);
  const addGroupByField = useQueryDraftStore(s => s.addGroupByField);
  const removeGroupByField = useQueryDraftStore(s => s.removeGroupByField);
  const setOrderBy = useQueryDraftStore(s => s.setOrderBy);
  const setLimit = useQueryDraftStore(s => s.setLimit);
  const setKpiMeta = useQueryDraftStore(s => s.setKpiMeta);
  const addCondition = useQueryDraftStore(s => s.addCondition);
  const setConditionField = useQueryDraftStore(s => s.setConditionField);
  const setConditionOp = useQueryDraftStore(s => s.setConditionOp);
  const wrapSelectItemInAgg = useQueryDraftStore(s => s.wrapSelectItemInAgg);
  const wrapNodeInNot = useQueryDraftStore(s => s.wrapNodeInNot);
  const wrapNodeInGroup = useQueryDraftStore(s => s.wrapNodeInGroup);
  const setGroupOp = useQueryDraftStore(s => s.setGroupOp);
  const setOrderByToItemLabel = useQueryDraftStore(s => s.setOrderByToItemLabel);
  const addJoin = useQueryDraftStore(s => s.addJoin);
  const removeJoin = useQueryDraftStore(s => s.removeJoin);
  const setSql = useSqlEditorStore(s => s.setSql);

  // Fields from joined tables, exposed under a qualified name (e.g. "dim_vendor.region")
  // so every existing schema-driven control (Select/GroupBy/Filter/validation) can use
  // them without any per-component change.
  const schemaForJoins = (joins: typeof draft.joins) => joins.reduce((acc, j) => {
    const t = joinTables[j.rightTable];
    if (!t) return acc;
    const qualified = t.schema.map(s => ({ ...s, name: `${j.rightTable}.${s.name}` }));
    return acc.concat(qualified);
  }, schema);
  const combinedSchema = schemaForJoins(draft.joins);

  const [step, setStep] = useState<Step>('dataset');
  const [advanced, setAdvanced] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [resultView, setResultView] = useState<'table' | 'chart'>('table');
  const [widgetForm, setWidgetForm] = useState<WidgetFormState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draft.select.length === 0 && schema.length > 0) {
      resetDraft(sourceName, schema);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    Papa.parse(f, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: res => {
        const rows = res.data as Record<string, unknown>[];
        loadCSV(rows, f.name);
        resetDraft(f.name, buildSchema(rows));
        setResult(null);
        setValidation({ ok: true, errors: [] });
        setStep('columns');
      },
    });
    e.target.value = '';
  };

  const run = () => {
    const v = validateQuery(draft, combinedSchema);
    setValidation(v);
    if (!v.ok) { setResult(null); return; }
    try {
      setResult(runQuery(draft, data, combinedSchema));
    } catch (err) {
      setValidation({ ok: false, errors: [{ message: (err as Error).message }] });
    }
  };

  const sortByColumn = (label: string) => {
    const flipped: 'asc' | 'desc' =
      draft.orderBy?.field === label && draft.orderBy.dir === 'asc' ? 'desc' : 'asc';
    const spec = { field: label, dir: flipped };
    setOrderBy(spec);
    const next = { ...draft, orderBy: spec };
    const v = validateQuery(next, combinedSchema);
    if (v.ok) {
      try { setResult(runQuery(next, data, combinedSchema)); } catch { /* ignore */ }
    }
  };

  const doSave = () => {
    const v = validateQuery(draft, combinedSchema);
    setValidation(v);
    if (!v.ok) return null;
    const id = saveQuery(draft);
    setDraft({ ...draft, id });
    toast.success(`"${draft.name}" saved`);
    return id;
  };

  const openWidgetForm = () => {
    const v = validateQuery(draft, combinedSchema);
    setValidation(v);
    if (!v.ok) return;
    let res = result;
    if (!res) {
      try { res = runQuery(draft, data, combinedSchema); setResult(res); } catch { return; }
    }
    const id = saveQuery(draft);
    setDraft({ ...draft, id });
    const cols = res.columns;
    const dimCol = cols.find(c => c.type !== 'number') || cols[0];
    const metCol = cols.find(c => c.type === 'number') || cols[cols.length - 1];
    setWidgetForm({
      name: draft.name, queryId: id, chart: 'pie',
      dim: dimCol?.label ?? '', metric: metCol?.label ?? '', cols,
    });
  };

  const onWidgetSave = (form: WidgetFormState) => {
    addWidget({ name: form.name, queryId: form.queryId, chart: form.chart, dim: form.dim, metric: form.metric });
    setWidgetForm(null);
    onGoToDashboard();
  };

  const sendToStudio = () => {
    setSql(buildDisplaySql({ ...draft, mode: 'visual' }));
    onGoToStudio();
  };

  const loadSavedQuery = (q: Query) => {
    setDraft({ ...q });
    try {
      setResult(runQuery(q, data, schemaForJoins(q.joins)));
      setValidation({ ok: true, errors: [] });
    } catch { /* ignore */ }
    setStep('sql');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const a = active.data.current as DragData | undefined;
    const o = over.data.current as DropData | undefined;
    if (!a || !o) return;

    if (a.kind === 'field') {
      const fname = a.fieldName;
      if (o.zone === 'select') addSelectItem({ id: 'sel_' + Date.now(), expr: field(fname), label: fname });
      else if (o.zone === 'groupby') addGroupByField(fname);
      else if (o.zone === 'cond-field') setConditionField(o.condId, fname);
      else if (o.zone === 'group-add') {
        addCondition(o.groupId, compare('=', field(fname), { kind: 'literal', valueType: 'string', value: '' }));
      }
      return;
    }

    if (a.kind === 'operator') {
      if (a.category === 'aggregation' && o.zone === 'select-item') {
        wrapSelectItemInAgg(o.itemId, a.op as AggFn);
      } else if ((a.category === 'comparison' || a.category === 'conditional') && o.zone === 'cond-op') {
        setConditionOp(o.condId, a.op as RowOp);
      } else if (a.category === 'logical') {
        if (a.op === 'NOT' && o.zone === 'cond-wrap') wrapNodeInNot(o.condId);
        else if ((a.op === 'AND' || a.op === 'OR') && o.zone === 'group-op') setGroupOp(o.groupId, a.op);
      } else if (a.category === 'paren' && o.zone === 'cond-wrap') {
        wrapNodeInGroup(o.condId, 'AND');
      } else if (a.category === 'sorting' && o.zone === 'select-item') {
        const item = draft.select.find(it => it.id === o.itemId);
        if (item) setOrderByToItemLabel(item.label);
      }
    }
  };

  const resultCols = result?.columns ?? [];
  const stepIdx = STEPS.findIndex(s => s.key === step);

  const datasetPanel = (
    <Panel>
      <Label>Dataset</Label>
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 10 }} className="p-3 mt-1">
        <div className="flex items-center gap-2">
          <Database size={16} style={{ color: C.blue }} />
          <span style={{ color: C.ink }} className="font-semibold text-sm truncate">{sourceName}</span>
        </div>
        <div style={{ color: C.mut }} className="text-xs mt-1">
          {data.length.toLocaleString()} rows · {schema.length} fields
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload size={13} /> Upload CSV
        </Button>
        <Button variant="soft" size="sm" onClick={() => {
          resetSample();
          resetDraft('fact_alarms (sample)', schema);
          setResult(null);
          setValidation(null);
        }}>
          Reset sample
        </Button>
        <input ref={fileRef} type="file" accept=".csv" onChange={onUpload} className="hidden" />
      </div>
      <div style={{ color: C.mut }} className="text-xs mt-2">
        Need more dataset types (Excel, JSON, database, REST API)? Use the <strong>Data Sources</strong> tab.
      </div>
    </Panel>
  );

  const columnsPanel = (
    <Panel>
      <Label>Select columns</Label>
      <div style={{ color: C.mut }} className="text-xs mt-1 mb-1">
        Click a field below, or drag it here, to add it to your result.
      </div>
      <SelectBuilder
        select={draft.select}
        schema={combinedSchema}
        orderByField={draft.orderBy?.field ?? null}
        onAdd={item => addSelectItem(item)}
        onRemove={removeSelectItem}
      />
    </Panel>
  );

  const filtersPanel = (
    <Panel>
      <Label>Where</Label>
      <div style={{ color: C.mut }} className="text-xs mt-1 mb-1">
        Add conditions to narrow down rows. Group conditions with AND/OR, or negate with NOT.
      </div>
      <FilterBuilder where={draft.where} schema={combinedSchema} />
    </Panel>
  );

  const aggregationsPanel = (
    <Panel>
      <Label>Aggregations</Label>
      <div style={{ color: C.mut }} className="text-xs mt-1 mb-1">
        Use "+ Measure" to add COUNT / SUM / AVG / MIN / MAX, or drag an aggregation operator onto a column.
      </div>
      <SelectBuilder
        select={draft.select}
        schema={combinedSchema}
        orderByField={draft.orderBy?.field ?? null}
        onAdd={item => addSelectItem(item)}
        onRemove={removeSelectItem}
      />
    </Panel>
  );

  const groupByPanel = (
    <Panel>
      <div className="flex flex-wrap gap-6">
        <div>
          <Label>Group by</Label>
          <div className="mt-1">
            <GroupByBuilder groupBy={draft.groupBy} schema={combinedSchema} onAdd={addGroupByField} onRemove={removeGroupByField} />
          </div>
        </div>
        <div>
          <Label>Order by &amp; limit</Label>
          <div className="mt-1">
            <OrderByLimitBuilder
              select={draft.select}
              orderBy={draft.orderBy}
              limit={draft.limit}
              onSetOrderBy={setOrderBy}
              onSetLimit={setLimit}
            />
          </div>
        </div>
      </div>
    </Panel>
  );

  const sqlPanel = (
    <>
      <Panel>
        <Label>Generated query</Label>
        <div className="mt-1"><SqlPreview query={draft} /></div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <Button variant="good" onClick={run}><Play size={14} /> Validate &amp; run</Button>
          <Button variant="ghost" onClick={doSave}><Save size={14} /> Save query</Button>
          <Button onClick={openWidgetForm} disabled={!result}><PieIcon size={14} /> Create widget</Button>
          <Button variant="ghost" onClick={sendToStudio}><Code2 size={14} /> Send to Studio</Button>
          <QueryValidatorPanel result={validation} />
        </div>
      </Panel>

      {result && (
        <Panel>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: C.page }}>
              {([['table', 'Table', Table2], ['chart', 'Chart', BarChart3]] as const).map(([k, l, I]) => (
                <button
                  key={k}
                  onClick={() => setResultView(k)}
                  type="button"
                  style={resultView === k ? { background: '#fff', color: C.ink } : { color: C.mut }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-semibold"
                >
                  <I size={14} /> {l}
                </button>
              ))}
            </div>
          </div>

          {resultView === 'table' ? (
            <div className="mt-2">
              <ResultTable
                columns={resultCols}
                rows={result.rows}
                name={draft.name}
                maxHeight={320}
                onSort={sortByColumn}
                orderBy={draft.orderBy}
              />
            </div>
          ) : (
            <div className="mt-2">
              <ChartView
                widget={{
                  chart: result.columns.length === 2 && result.columns.some(c => c.type === 'number') ? 'bar' : 'table',
                  queryId: '_preview',
                  dim: (resultCols.find(c => c.type !== 'number') || resultCols[0])?.label ?? '',
                  metric: (resultCols.find(c => c.type === 'number') || resultCols[resultCols.length - 1])?.label ?? '',
                }}
                queries={[{ ...draft, id: '_preview' }]}
                data={data}
                schema={combinedSchema}
                height={260}
              />
            </div>
          )}
        </Panel>
      )}
    </>
  );

  const panelByStep: Record<Step, React.ReactNode> = {
    dataset: datasetPanel,
    columns: columnsPanel,
    filters: filtersPanel,
    aggregations: aggregationsPanel,
    groupby: groupByPanel,
    sql: sqlPanel,
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col lg:flex-row gap-4 p-4 mx-auto" style={{ maxWidth: 1600 }}>
        {/* ===== LEFT RAIL ===== */}
        <div className="lg:w-64 shrink-0 space-y-4">
          <Panel>
            <Label>Fields</Label>
            <div className="mt-1">
              <FieldExplorer
                schema={schema}
                onAddField={name => addSelectItem({ id: 'sel_' + Date.now(), expr: field(name), label: name })}
              />
            </div>
          </Panel>
          <DatasetSidebar onSelectQuery={loadSavedQuery} hideDatasets className="space-y-4" />
        </div>

        {/* ===== MAIN ===== */}
        <div className="flex-1 space-y-4 min-w-0">
          <Panel>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <input
                value={draft.name}
                onChange={e => setName(e.target.value)}
                style={{ color: C.ink }}
                className="font-bold text-lg bg-transparent outline-none flex-1 min-w-0"
              />
              <label className="flex items-center gap-2 text-sm" style={{ color: C.mut }}>
                <Switch checked={advanced} onCheckedChange={setAdvanced} /> Advanced mode
              </label>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
              {STEPS.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStep(s.key)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                  style={
                    step === s.key
                      ? { background: C.skyl, color: C.blue }
                      : i < stepIdx
                      ? { color: C.ink }
                      : { color: C.mut }
                  }
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[11px]"
                    style={
                      i < stepIdx
                        ? { background: C.blue, color: '#fff' }
                        : step === s.key
                        ? { border: `1.5px solid ${C.blue}`, color: C.blue }
                        : { border: `1.5px solid ${C.line}`, color: C.mut }
                    }
                  >
                    {i < stepIdx ? <Check size={11} /> : i + 1}
                  </span>
                  {s.label}
                  {i < STEPS.length - 1 && <ChevronRight size={12} style={{ color: C.line }} />}
                </button>
              ))}
            </div>
          </Panel>

          {advanced
            ? (
              <>
                {datasetPanel}
                {columnsPanel}
                {filtersPanel}
                {aggregationsPanel}
                {groupByPanel}
                <Panel>
                  <Label>KPI metadata</Label>
                  <div className="mt-2"><KpiMetaForm kpi={draft.kpi} onChange={setKpiMeta} /></div>
                </Panel>
                <Panel>
                  <Label>Join</Label>
                  <div className="mt-2">
                    <JoinBuilder
                      sourceTable={sourceName}
                      baseSchema={schema}
                      joins={draft.joins}
                      joinTables={joinTables}
                      onAddJoin={addJoin}
                      onRemoveJoin={removeJoin}
                      onLoadJoinTable={loadJoinTable}
                      onAddField={name => addSelectItem({ id: 'sel_' + Date.now(), expr: field(name), label: name })}
                    />
                  </div>
                </Panel>
                {sqlPanel}
              </>
            )
            : (
              <>
                {panelByStep[step]}
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    disabled={stepIdx === 0}
                    onClick={() => setStep(STEPS[Math.max(0, stepIdx - 1)].key)}
                  >
                    <ChevronLeft size={14} /> Back
                  </Button>
                  {stepIdx < STEPS.length - 1 && (
                    <Button onClick={() => setStep(STEPS[stepIdx + 1].key)}>
                      Next <ChevronRight size={14} />
                    </Button>
                  )}
                </div>
              </>
            )}
        </div>

        {/* ===== OPERATOR PALETTE (advanced mode only) ===== */}
        {advanced && (
          <div className="lg:w-72 shrink-0">
            <Panel>
              <Label>Operator toolbar</Label>
              <div className="mt-2"><OperatorPalette /></div>
            </Panel>
          </div>
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
    </DndContext>
  );
}
