import { useDroppable } from '@dnd-kit/core';
import { X, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem as SelectOption } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { ExprNode, LiteralNode } from '@/types/expr';
import { COMPARE_OPS } from '@/types/expr';
import type { FieldSchema } from '../../schema';
import { field } from '@/lib/exprBuilders';
import {
  type ConditionNode, type RowOp, getConditionTarget, getConditionOpLabel, buildConditionForOp,
} from '@/lib/conditionOps';
import CustomValuePopover from './CustomValuePopover';
import { C } from '@/palette';

const getTarget = getConditionTarget;
const getOpLabel = getConditionOpLabel;
const buildForOp = buildConditionForOp;

function asLiteral(node: ExprNode): LiteralNode {
  return node.kind === 'literal' ? node : { kind: 'literal', valueType: 'string', value: '' };
}

export default function ConditionRow({
  node, schema, onReplace, onRemove,
}: {
  node: ConditionNode;
  schema: FieldSchema[];
  onReplace: (n: ExprNode) => void;
  onRemove: () => void;
}) {
  const targetField = getTarget(node);
  const fieldName = targetField.kind === 'field' ? targetField.name : '';
  const opLabel = getOpLabel(node);

  const fieldDrop = useDroppable({ id: `cond-field:${node.id}`, data: { zone: 'cond-field', condId: node.id } });
  const opDrop    = useDroppable({ id: `cond-op:${node.id}`,    data: { zone: 'cond-op',    condId: node.id } });
  const wrapDrop  = useDroppable({ id: `cond-wrap:${node.id}`,  data: { zone: 'cond-wrap',  condId: node.id } });

  return (
    <div
      ref={wrapDrop.setNodeRef}
      className={cn('flex flex-wrap items-center gap-2 rounded-lg p-1', wrapDrop.isOver && 'bg-[#EAF3FB]')}
    >
      {/* field slot */}
      <div ref={fieldDrop.setNodeRef} className={cn('rounded-md', fieldDrop.isOver && 'ring-2 ring-[#2E75B6]/50')}>
        <Select value={fieldName} onValueChange={v => onReplace(buildForOp(opLabel, field(v)))}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="field…" /></SelectTrigger>
          <SelectContent>
            {schema.map(s => <SelectOption key={s.name} value={s.name}>{s.name}</SelectOption>)}
          </SelectContent>
        </Select>
      </div>

      {/* operator slot */}
      <div ref={opDrop.setNodeRef} className={cn('rounded-md', opDrop.isOver && 'ring-2 ring-[#2E75B6]/50')}>
        <Select value={opLabel} onValueChange={(v: RowOp) => onReplace(buildForOp(v, targetField))}>
          <SelectTrigger className="w-[110px] font-mono"><SelectValue /></SelectTrigger>
          <SelectContent>
            {COMPARE_OPS.map(o => <SelectOption key={o} value={o} className="font-mono">{o}</SelectOption>)}
            <SelectOption value="BETWEEN">BETWEEN</SelectOption>
            <SelectOption value="IN">IN</SelectOption>
            <SelectOption value="LIKE">LIKE</SelectOption>
          </SelectContent>
        </Select>
      </div>

      {/* value slot(s) */}
      {node.kind === 'compare' && (
        <CustomValuePopover value={asLiteral(node.right)} onChange={v => onReplace({ ...node, right: v })} />
      )}

      {node.kind === 'between' && (
        <div className="flex items-center gap-1.5">
          <CustomValuePopover value={asLiteral(node.low)} onChange={v => onReplace({ ...node, low: v })} />
          <span style={{ color: C.mut }} className="text-xs">and</span>
          <CustomValuePopover value={asLiteral(node.high)} onChange={v => onReplace({ ...node, high: v })} />
        </div>
      )}

      {node.kind === 'in' && (
        <Input
          className="w-[180px]"
          placeholder="comma, separated, values"
          defaultValue={node.list.map(v => (v.kind === 'literal' ? String(v.value) : '')).join(', ')}
          onBlur={e => {
            const list: LiteralNode[] = e.target.value.split(',').map(s => {
              const t = s.trim();
              return isNaN(Number(t)) || t === ''
                ? { kind: 'literal', valueType: 'string', value: t }
                : { kind: 'literal', valueType: 'number', value: Number(t) };
            });
            onReplace({ ...node, list });
          }}
        />
      )}

      {node.kind === 'like' && (
        <Input
          className="w-[160px]"
          placeholder="contains…"
          defaultValue={node.pattern.kind === 'literal' ? String(node.pattern.value).replace(/^%|%$/g, '') : ''}
          onBlur={e => onReplace({ ...node, pattern: { kind: 'literal', valueType: 'string', value: `%${e.target.value}%` } })}
        />
      )}

      <span style={{ color: C.mut }} className="text-[10px] inline-flex items-center gap-0.5" title="Drag NOT / ( ) here">
        <CornerDownRight size={11} /> drop NOT / ( ) here
      </span>

      <button onClick={onRemove} type="button"><X size={14} style={{ color: C.mut }} /></button>
    </div>
  );
}
