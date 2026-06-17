import { useMemo } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  type PieLabelRenderProps,
} from 'recharts';
import { runQuery } from '@/modules/queries/engine';
import type { FieldSchema } from '@/modules/queries/schema';
import type { Query } from '@/types/expr';
import type { Widget } from '@/types/widget';
import { C, SEV, CHART_COLORS } from '@/palette';

const colorFor = (name: string, i: number) => SEV[name] || CHART_COLORS[i % CHART_COLORS.length];

export default function ChartView({
  widget, queries, data, schema, height = 220,
}: {
  widget: Pick<Widget, 'chart' | 'dim' | 'metric' | 'queryId'>;
  queries: Query[];
  data: Record<string, unknown>[];
  schema: FieldSchema[];
  height?: number;
}) {
  const result = useMemo(() => {
    const q = queries.find(x => x.id === widget.queryId);
    if (!q) return null;
    try {
      return runQuery(q, data, schema);
    } catch {
      return null;
    }
  }, [widget, queries, data, schema]);

  if (!result) {
    return (
      <div style={{ color: C.mut, height }} className="text-sm p-4 flex items-center justify-center">
        Source query not found or errored.
      </div>
    );
  }

  const { rows } = result;
  const { dim, metric, chart } = widget;

  /* ---- KPI ---- */
  if (chart === 'kpi') {
    const val = rows.reduce((a, r) => a + (Number(r[metric]) || 0), 0);
    return (
      <div className="flex flex-col items-center justify-center" style={{ height }}>
        <div style={{ color: C.ink, fontSize: 48, fontWeight: 800, lineHeight: 1 }}>
          {val.toLocaleString()}
        </div>
        <div style={{ color: C.mut }} className="text-sm mt-2">{metric}</div>
      </div>
    );
  }

  /* ---- Table ---- */
  if (chart === 'table') {
    return (
      <div style={{ height, overflowY: 'auto' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: C.skyl }}>
              {result.columns.map(c => (
                <th key={c.label} style={{ color: C.ink }} className="text-left font-semibold px-3 py-2">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}>
                {result.columns.map(c => (
                  <td key={c.label} style={{ color: C.text }} className="px-3 py-1.5">
                    {String(r[c.label] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  /* ---- Pie ---- */
  if (chart === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={rows}
            dataKey={metric}
            nameKey={dim}
            cx="50%"
            cy="50%"
            outerRadius={Math.min(height / 2 - 10, 90)}
            label={(e: PieLabelRenderProps) => String(e.name ?? '')}
          >
            {rows.map((r, i) => <Cell key={i} fill={colorFor(String(r[dim]), i)} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  /* ---- Bar ---- */
  if (chart === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
          <XAxis dataKey={dim} tick={{ fontSize: 11, fill: C.mut }} />
          <YAxis tick={{ fontSize: 11, fill: C.mut }} />
          <Tooltip />
          <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
            {rows.map((r, i) => <Cell key={i} fill={colorFor(String(r[dim]), i)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  /* ---- Area ---- */
  if (chart === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
          <XAxis dataKey={dim} tick={{ fontSize: 11, fill: C.mut }} />
          <YAxis tick={{ fontSize: 11, fill: C.mut }} />
          <Tooltip />
          <Area type="monotone" dataKey={metric} stroke={C.blue} fill={C.skyl} strokeWidth={2.5} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  /* ---- Line ---- */
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
        <XAxis dataKey={dim} tick={{ fontSize: 11, fill: C.mut }} />
        <YAxis tick={{ fontSize: 11, fill: C.mut }} />
        <Tooltip />
        <Line type="monotone" dataKey={metric} stroke={C.blue} strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
