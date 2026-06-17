import { useState } from 'react';
import Papa from 'papaparse';
import { Link2, Plus, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem as SelectOption } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { FieldSchema } from '../schema';
import type { JoinSpec, JoinType } from '@/types/expr';
import { nextId } from '@/types/expr';
import type { JoinTable } from '@/store/dataStore';
import { C } from '@/palette';

const JOIN_TYPES: JoinType[] = ['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS'];

export default function JoinBuilder({
  sourceTable, baseSchema, joins, joinTables, onAddJoin, onRemoveJoin, onLoadJoinTable, onAddField,
}: {
  sourceTable: string;
  baseSchema: FieldSchema[];
  joins: JoinSpec[];
  joinTables: Record<string, JoinTable>;
  onAddJoin: (join: JoinSpec) => void;
  onRemoveJoin: (id: string) => void;
  onLoadJoinTable: (name: string, rows: Record<string, unknown>[]) => void;
  onAddField: (qualifiedName: string) => void;
}) {
  const tableNames = Object.keys(joinTables);
  const [type, setType] = useState<JoinType>('INNER');
  const [rightTable, setRightTable] = useState(tableNames[0] ?? '');
  const [leftKey, setLeftKey] = useState(baseSchema[0]?.name ?? '');
  const [rightKey, setRightKey] = useState(joinTables[tableNames[0] ?? '']?.schema[0]?.name ?? '');

  const rightSchema = rightTable ? joinTables[rightTable]?.schema ?? [] : [];

  const addJoin = () => {
    if (!rightTable || !leftKey || !rightKey) return;
    onAddJoin({
      id: nextId('join'),
      type,
      rightTable,
      leftKey: `${sourceTable}.${leftKey}`,
      rightKey: `${rightTable}.${rightKey}`,
    });
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    Papa.parse(f, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: res => onLoadJoinTable(f.name, res.data as Record<string, unknown>[]),
    });
    e.target.value = '';
  };

  return (
    <div style={{ border: `1px dashed ${C.line}`, borderRadius: 12 }} className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div style={{ color: C.ink }} className="text-sm font-semibold flex items-center gap-2">
          <Link2 size={15} style={{ color: C.mut }} />
          Join Builder
        </div>
        {tableNames.length === 0 && <Badge variant="outline">No other tables loaded</Badge>}
      </div>

      {joins.map(j => (
        <div
          key={j.id}
          className="flex items-center justify-between gap-2 text-sm rounded-lg px-2.5 py-1.5"
          style={{ border: `1px solid ${C.line}`, background: '#fff' }}
        >
          <span className="font-mono text-xs" style={{ color: C.text }}>
            {j.type} JOIN {j.rightTable} ON {j.leftKey} = {j.rightKey}
          </span>
          <button onClick={() => onRemoveJoin(j.id)} type="button">
            <X size={13} style={{ color: C.mut }} />
          </button>
        </div>
      ))}

      {tableNames.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: C.mut }}>
          <span className="font-mono px-2 py-1 rounded bg-white border" style={{ borderColor: C.line }}>
            {sourceTable}
          </span>
          <Select value={type} onValueChange={v => setType(v as JoinType)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {JOIN_TYPES.map(t => <SelectOption key={t} value={t}>{t} JOIN</SelectOption>)}
            </SelectContent>
          </Select>
          <Select value={rightTable} onValueChange={v => { setRightTable(v); setRightKey(joinTables[v]?.schema[0]?.name ?? ''); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="right table…" /></SelectTrigger>
            <SelectContent>
              {tableNames.map(t => <SelectOption key={t} value={t}>{t}</SelectOption>)}
            </SelectContent>
          </Select>
          <span>ON</span>
          <Select value={leftKey} onValueChange={setLeftKey}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="left.key" /></SelectTrigger>
            <SelectContent>
              {baseSchema.map(s => <SelectOption key={s.name} value={s.name}>{s.name}</SelectOption>)}
            </SelectContent>
          </Select>
          <span>=</span>
          <Select value={rightKey} onValueChange={setRightKey}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="right.key" /></SelectTrigger>
            <SelectContent>
              {rightSchema.map(s => <SelectOption key={s.name} value={s.name}>{s.name}</SelectOption>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={addJoin} disabled={!rightTable || !leftKey || !rightKey}>
            <Plus size={13} /> Add join
          </Button>
        </div>
      )}

      {joins.map(j => {
        const t = joinTables[j.rightTable];
        if (!t) return null;
        const rightKeyCol = j.rightKey.split('.').pop();
        const fields = t.schema.filter(s => s.name !== rightKeyCol);
        if (!fields.length) return null;
        return (
          <div key={`fields_${j.id}`} className="space-y-1">
            <div style={{ color: C.mut }} className="text-xs">Fields from {j.rightTable} — click to add to Select</div>
            <div className="flex flex-wrap gap-1.5">
              {fields.map(s => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => onAddField(`${j.rightTable}.${s.name}`)}
                  style={{ border: `1px solid ${C.line}`, color: C.text }}
                  className="rounded-full px-2.5 py-1 text-xs hover:bg-slate-50"
                >
                  {j.rightTable}.{s.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <label>
        <Button variant="ghost" size="sm" asChild>
          <span className="cursor-pointer"><Upload size={13} /> Add table from CSV</span>
        </Button>
        <input type="file" accept=".csv" onChange={onUpload} className="hidden" />
      </label>
    </div>
  );
}
