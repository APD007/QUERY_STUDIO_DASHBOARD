import { useState } from 'react';
import {
  PieChart as PieIcon, BarChart3, Activity, AreaChart as AreaIcon, Hash, Table2, X, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem as SelectOption } from '@/components/ui/select';
import type { Query } from '@/types/expr';
import type { ChartType, Widget } from '@/types/widget';
import type { ResultColumn } from '@/modules/queries/engine';
import type { FieldSchema } from '@/modules/queries/schema';
import ChartView from './ChartView';
import { C } from '@/palette';

export interface WidgetFormState extends Omit<Widget, 'id'> {
  cols: ResultColumn[];
}

const CHART_TYPES: [ChartType, string, typeof PieIcon][] = [
  ['pie',   'Pie',   PieIcon],
  ['bar',   'Bar',   BarChart3],
  ['line',  'Line',  Activity],
  ['area',  'Area',  AreaIcon],
  ['kpi',   'KPI',   Hash],
  ['table', 'Table', Table2],
];

export default function WidgetForm({
  initialForm, queries, data, schema, onSave, onCancel,
}: {
  initialForm: WidgetFormState;
  queries: Query[];
  data: Record<string, unknown>[];
  schema: FieldSchema[];
  onSave: (form: WidgetFormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initialForm);
  const upd = (patch: Partial<WidgetFormState>) => setForm(f => ({ ...f, ...patch }));

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,42,71,.45)' }}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, width: 780, maxWidth: '100%', maxHeight: '90vh' }}
        className="p-5 overflow-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span style={{ color: C.ink }} className="font-bold text-lg">Create widget</span>
            <div style={{ color: C.mut }} className="text-xs">step 2 · one query + one chart</div>
          </div>
          <button onClick={onCancel} type="button"><X size={18} style={{ color: C.mut }} /></button>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          {/* Controls */}
          <div className="md:w-64 space-y-4">
            <div>
              <Label>Name</Label>
              <Input className="mt-1" value={form.name} onChange={e => upd({ name: e.target.value })} />
            </div>

            <div>
              <Label>Chart type</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {CHART_TYPES.map(([k, l, I]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => upd({ chart: k })}
                    style={form.chart === k
                      ? { borderColor: C.blue, background: C.skyl, color: C.ink }
                      : { borderColor: C.line, color: C.mut }
                    }
                    className="flex flex-col items-center gap-1 rounded-lg border py-2 text-xs font-semibold"
                  >
                    <I size={16} /> {l}
                  </button>
                ))}
              </div>
            </div>

            {form.chart !== 'table' && (
              <>
                <div>
                  <Label>{form.chart === 'kpi' ? 'Value column' : 'Group / x-axis'}</Label>
                  <Select value={form.dim} onValueChange={v => upd({ dim: v })}>
                    <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {form.cols.map(c => <SelectOption key={c.label} value={c.label}>{c.label}</SelectOption>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Measure</Label>
                  <Select value={form.metric} onValueChange={v => upd({ metric: v })}>
                    <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {form.cols.map(c => <SelectOption key={c.label} value={c.label}>{c.label}</SelectOption>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1" style={{ border: `1px solid ${C.line}`, borderRadius: 12 }}>
            <div style={{ borderBottom: `1px solid ${C.line}`, color: C.mut }} className="text-xs px-3 py-1.5">
              Preview
            </div>
            <div className="p-2">
              <ChartView widget={form} queries={queries} data={data} schema={schema} height={240} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSave(form)}>
            <Save size={14} /> Save &amp; add to library
          </Button>
        </div>
      </div>
    </div>
  );
}
