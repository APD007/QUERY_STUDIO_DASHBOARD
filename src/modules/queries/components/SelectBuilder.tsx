import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem as SelectOption,
} from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import type { FieldSchema } from '../schema';
import type { AggFn, ArithOp, ExprNode, SelectItem, SqlFn } from '@/types/expr';
import { AGG_FNS, ARITH_OPS, SQL_FNS } from '@/types/expr';
import { field, agg, arith, sqlFn, makeSelectItem } from '@/lib/exprBuilders';
import { exprToSql } from '@/lib/sqlGenerator';
import { C } from '@/palette';

/* ---------------------------------------------------------- operand editor */
type OperandKind = 'field' | 'agg';
interface OperandState {
  kind: OperandKind;
  fieldName: string;
  fn: AggFn;
}

function OperandEditor({
  schema, state, onChange,
}: {
  schema: FieldSchema[];
  state: OperandState;
  onChange: (s: OperandState) => void;
}) {
  const numericFields = schema.filter(s => s.type === 'number');
  return (
    <div className="flex items-center gap-1.5">
      <Select value={state.kind} onValueChange={(v: OperandKind) => onChange({ ...state, kind: v })}>
        <SelectTrigger className="w-[88px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectOption value="field">Field</SelectOption>
          <SelectOption value="agg">Aggregate</SelectOption>
        </SelectContent>
      </Select>

      {state.kind === 'agg' && (
        <Select value={state.fn} onValueChange={(v: AggFn) => onChange({ ...state, fn: v })}>
          <SelectTrigger className="w-[88px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AGG_FNS.map(fn => <SelectOption key={fn} value={fn}>{fn}</SelectOption>)}
          </SelectContent>
        </Select>
      )}

      <Select value={state.fieldName} onValueChange={v => onChange({ ...state, fieldName: v })}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="field…" /></SelectTrigger>
        <SelectContent>
          {state.kind === 'agg' && state.fn === 'COUNT' && <SelectOption value="*">*</SelectOption>}
          {(state.kind === 'agg' ? numericFields : schema).map(s => (
            <SelectOption key={s.name} value={s.name}>{s.name}</SelectOption>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function operandToExpr(state: OperandState): ExprNode {
  if (state.kind === 'field') return field(state.fieldName || '');
  return agg(state.fn, state.fn === 'COUNT' && state.fieldName === '*' ? '*' : field(state.fieldName || ''));
}

/* ---------------------------------------------------------- calculated field popover */
function CalculatedFieldPopover({ schema, onAdd }: { schema: FieldSchema[]; onAdd: (item: SelectItem) => void }) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<OperandState>({ kind: 'agg', fieldName: '*', fn: 'COUNT' });
  const [op, setOp] = useState<ArithOp>('/');
  const [b, setB] = useState<OperandState>({ kind: 'agg', fieldName: schema.find(s => s.type === 'number')?.name ?? '', fn: 'SUM' });
  const [wrapFn, setWrapFn] = useState<SqlFn | 'none'>('none');
  const [alias, setAlias] = useState('calculated_field');

  const buildExpr = (): ExprNode => {
    const base = arith(op, operandToExpr(a), operandToExpr(b));
    if (wrapFn === 'ROUND') return sqlFn('ROUND', [base, { kind: 'literal', valueType: 'number', value: 2 }]);
    if (wrapFn === 'FLOOR') return sqlFn('FLOOR', [base]);
    if (wrapFn === 'CAST')  return sqlFn('CAST', [base], 'FLOAT');
    return base;
  };

  const previewSql = exprToSql(buildExpr());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus size={13} /> Calculated field
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] space-y-3">
        <div style={{ color: C.ink }} className="text-sm font-semibold">Build a calculated field</div>

        <div className="space-y-2">
          <Label>Operand A</Label>
          <OperandEditor schema={schema} state={a} onChange={setA} />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px" style={{ background: C.line }} />
          <Select value={op} onValueChange={(v: ArithOp) => setOp(v)}>
            <SelectTrigger className="w-[64px] font-mono"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ARITH_OPS.map(o => <SelectOption key={o} value={o} className="font-mono">{o}</SelectOption>)}
            </SelectContent>
          </Select>
          <div className="flex-1 h-px" style={{ background: C.line }} />
        </div>

        <div className="space-y-2">
          <Label>Operand B</Label>
          <OperandEditor schema={schema} state={b} onChange={setB} />
        </div>

        <div className="space-y-2">
          <Label>Wrap with SQL helper</Label>
          <Select value={wrapFn} onValueChange={(v: SqlFn | 'none') => setWrapFn(v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectOption value="none">None</SelectOption>
              {SQL_FNS.map(fn => <SelectOption key={fn} value={fn}>{fn}</SelectOption>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Alias (AS)</Label>
          <Input value={alias} onChange={e => setAlias(e.target.value)} />
        </div>

        <div
          style={{ background: C.ink, color: '#fff', borderRadius: 8 }}
          className="px-2.5 py-1.5 text-xs font-mono overflow-x-auto"
        >
          {previewSql} AS {alias || '…'}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            disabled={!alias.trim()}
            onClick={() => {
              onAdd(makeSelectItem(buildExpr(), alias.trim()));
              setOpen(false);
            }}
          >
            Add field
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------------------------------------------------------- quick measure menu */
function QuickMeasureMenu({ schema, onAdd }: { schema: FieldSchema[]; onAdd: (item: SelectItem) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen(o => !o)}>
        <Plus size={13} /> Measure
      </Button>
      {open && (
        <div
          style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10 }}
          className="absolute z-10 mt-1 p-2 shadow-lg w-44 max-h-56 overflow-auto"
        >
          <button
            onClick={() => { onAdd(makeSelectItem(agg('COUNT', '*'))); setOpen(false); }}
            className="block w-full text-left text-sm px-2 py-1 rounded hover:bg-slate-50"
            style={{ color: C.text }}
          >
            COUNT(*)
          </button>
          {AGG_FNS.filter(f => f !== 'COUNT').map(fn =>
            schema.filter(s => s.type === 'number').map(s => (
              <button
                key={fn + s.name}
                onClick={() => { onAdd(makeSelectItem(agg(fn, field(s.name)))); setOpen(false); }}
                className="block w-full text-left text-sm px-2 py-1 rounded hover:bg-slate-50"
                style={{ color: C.text }}
              >
                {fn}({s.name})
              </button>
            ))
          )}
        </div>
      )}
    </span>
  );
}

/* ---------------------------------------------------------- chip */
function SelectChip({
  item, orderByField, onRemove,
}: {
  item: SelectItem;
  orderByField: string | null;
  onRemove: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `select-item:${item.id}`,
    data: { zone: 'select-item', itemId: item.id },
  });
  const isAgg = item.expr.kind === 'agg' || item.expr.kind === 'arith' || item.expr.kind === 'fn';

  return (
    <span
      ref={setNodeRef}
      style={{
        background: '#fff',
        border: `1px solid ${isAgg ? C.purp : C.blue}`,
        color: C.ink,
        boxShadow: isOver ? `0 0 0 2px ${C.blue}55` : undefined,
      }}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      title="Drop an aggregate or ORDER BY here"
    >
      {item.label}
      {orderByField === item.label && <Badge variant="solid" className="px-1 py-0 text-[10px]">sorted</Badge>}
      <button onClick={onRemove} type="button"><X size={12} style={{ color: C.mut }} /></button>
    </span>
  );
}

/* ---------------------------------------------------------- main */
export default function SelectBuilder({
  select, schema, orderByField, onAdd, onRemove,
}: {
  select: SelectItem[];
  schema: FieldSchema[];
  orderByField: string | null;
  onAdd: (item: SelectItem) => void;
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'select-zone', data: { zone: 'select' } });

  return (
    <div
      ref={setNodeRef}
      className={cn('flex flex-wrap gap-2 items-center rounded-lg p-1.5 -m-1.5', isOver && 'bg-[#EAF3FB]')}
    >
      {select.map(item => (
        <SelectChip key={item.id} item={item} orderByField={orderByField} onRemove={() => onRemove(item.id)} />
      ))}
      <QuickMeasureMenu schema={schema} onAdd={onAdd} />
      <CalculatedFieldPopover schema={schema} onAdd={onAdd} />
    </div>
  );
}
