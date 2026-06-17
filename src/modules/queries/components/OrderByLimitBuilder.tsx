import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem as SelectOption } from '@/components/ui/select';
import type { OrderBySpec, SelectItem } from '@/types/expr';

export default function OrderByLimitBuilder({
  select, orderBy, limit, onSetOrderBy, onSetLimit,
}: {
  select: SelectItem[];
  orderBy: OrderBySpec | null;
  limit: number | null;
  onSetOrderBy: (spec: OrderBySpec | null) => void;
  onSetLimit: (n: number | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'orderby-zone', data: { zone: 'select' } });

  return (
    <div className="flex flex-wrap gap-6">
      <div ref={setNodeRef} className={cn('flex gap-2 items-center rounded-lg p-1', isOver && 'bg-[#EAF3FB]')}>
        <Select
          value={orderBy?.field ?? ''}
          onValueChange={v => onSetOrderBy(v ? { field: v, dir: orderBy?.dir ?? 'desc' } : null)}
        >
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="no sort" /></SelectTrigger>
          <SelectContent>
            <SelectOption value="">—</SelectOption>
            {select.map(it => <SelectOption key={it.id} value={it.label}>{it.label}</SelectOption>)}
          </SelectContent>
        </Select>
        {orderBy && (
          <Button
            variant="ghost" size="sm"
            onClick={() => onSetOrderBy({ ...orderBy, dir: orderBy.dir === 'asc' ? 'desc' : 'asc' })}
          >
            {orderBy.dir === 'asc' ? '↑ asc' : '↓ desc'}
          </Button>
        )}
      </div>

      <Input
        type="number"
        className="w-20"
        value={limit ?? ''}
        onChange={e => onSetLimit(e.target.value ? Number(e.target.value) : null)}
        placeholder="all"
      />
    </div>
  );
}
