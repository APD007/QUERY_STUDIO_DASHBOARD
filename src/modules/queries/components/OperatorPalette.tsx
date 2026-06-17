import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip';
import type { OperatorCategory } from '@/types/dnd';
import { C } from '@/palette';

interface OpDef {
  label: string;
  op: string;
  disabled?: boolean;
  hint?: string;
}

interface CategoryDef {
  title: string;
  category: OperatorCategory;
  ops: OpDef[];
}

const CATEGORIES: CategoryDef[] = [
  {
    title: 'Arithmetic', category: 'arithmetic',
    ops: ['+', '-', '*', '/', '%'].map(op => ({ label: op, op, hint: 'Drag into a calculated field' })),
  },
  {
    title: 'Comparison', category: 'comparison',
    ops: ['=', '!=', '<', '>', '<=', '>='].map(op => ({ label: op, op, hint: 'Drag onto a filter condition' })),
  },
  {
    title: 'Logical', category: 'logical',
    ops: [
      { label: 'AND', op: 'AND', hint: 'Drag onto a filter group' },
      { label: 'OR',  op: 'OR',  hint: 'Drag onto a filter group' },
      { label: 'NOT', op: 'NOT', hint: 'Drag onto a condition to negate it' },
    ],
  },
  {
    title: 'Aggregation', category: 'aggregation',
    ops: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].map(op => ({ label: op, op, hint: 'Drag onto a SELECT field' })),
  },
  {
    title: 'Conditional', category: 'conditional',
    ops: [
      { label: 'BETWEEN', op: 'BETWEEN', hint: 'Drag onto a filter condition' },
      { label: 'IN',      op: 'IN',      hint: 'Drag onto a filter condition' },
      { label: 'LIKE',    op: 'LIKE',    hint: 'Drag onto a filter condition' },
      { label: 'EXISTS', op: 'EXISTS', disabled: true, hint: 'Needs multi-table joins — Phase 2' },
      { label: 'ANY',    op: 'ANY',    disabled: true, hint: 'Needs multi-table joins — Phase 2' },
      { label: 'ALL',    op: 'ALL',    disabled: true, hint: 'Needs multi-table joins — Phase 2' },
      { label: 'SOME',   op: 'SOME',   disabled: true, hint: 'Needs multi-table joins — Phase 2' },
    ],
  },
  {
    title: 'SQL Helpers', category: 'sqlHelper',
    ops: [
      { label: 'AS',    op: 'AS',    hint: 'Set automatically when you name a calculated field' },
      { label: 'CAST',  op: 'CAST',  hint: 'Drag onto an open calculated-field editor' },
      { label: 'ROUND', op: 'ROUND', hint: 'Drag onto an open calculated-field editor' },
      { label: 'FLOOR', op: 'FLOOR', hint: 'Drag onto an open calculated-field editor' },
    ],
  },
  {
    title: 'Sorting', category: 'sorting',
    ops: [{ label: 'ORDER BY', op: 'ORDER_BY', hint: 'Drag onto a SELECT field to sort by it' }],
  },
  {
    title: 'Join Operations', category: 'join',
    ops: [
      'INNER JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'CROSS JOIN',
    ].map(op => ({ label: op, op, disabled: true, hint: 'Multi-table joins ship in Phase 2' })),
  },
  {
    title: 'Parentheses', category: 'paren',
    ops: [
      { label: '(', op: '(', hint: 'Drag onto a condition to group it' },
      { label: ')', op: ')', hint: 'Drag onto a condition to group it' },
    ],
  },
];

function DraggableOp({ category, def }: { category: OperatorCategory; def: OpDef }) {
  const id = `op:${category}:${def.op}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { kind: 'operator', category, op: def.op },
    disabled: def.disabled,
  });

  const btn = (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      disabled={def.disabled}
      className={cn(
        'select-none rounded-md border px-2 py-1 text-xs font-semibold font-mono cursor-grab active:cursor-grabbing',
        def.disabled
          ? 'opacity-40 cursor-not-allowed border-[#CBD8E6] text-[#5A6B7B]'
          : 'border-[#CBD8E6] text-[#0E2A47] bg-white hover:border-[#2E75B6]',
        isDragging && 'opacity-50'
      )}
    >
      {def.label}
    </button>
  );

  if (!def.hint) return btn;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent>{def.hint}</TooltipContent>
    </Tooltip>
  );
}

export default function OperatorPalette() {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-3">
        {CATEGORIES.map(cat => (
          <div key={cat.category}>
            <div style={{ color: C.mut }} className="text-xs font-semibold uppercase tracking-wide mb-1 flex items-center gap-1.5">
              {cat.title}
              {cat.ops.some(o => o.disabled) && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">phase 2 mixed in</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cat.ops.map(op => <DraggableOp key={op.op} category={cat.category} def={op} />)}
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
