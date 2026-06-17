import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FieldSchema } from '../schema';
import { C } from '@/palette';

function AddFieldMenu({
  schema, exclude, onAdd,
}: {
  schema: FieldSchema[];
  exclude: string[];
  onAdd: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const avail = schema.filter(s => !exclude.includes(s.name));
  return (
    <span className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        type="button"
        style={{ border: `1px dashed ${C.line}`, color: C.green }}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      >
        <Plus size={12} /> field
      </button>
      {open && (
        <div
          style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10 }}
          className="absolute z-10 mt-1 p-2 shadow-lg w-44 max-h-52 overflow-auto"
        >
          {avail.map(s => (
            <button
              key={s.name}
              onClick={() => { onAdd(s.name); setOpen(false); }}
              type="button"
              className="block w-full text-left text-sm px-2 py-1 rounded hover:bg-slate-50"
              style={{ color: C.text }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export default function GroupByBuilder({
  groupBy, schema, onAdd, onRemove,
}: {
  groupBy: string[];
  schema: FieldSchema[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'groupby-zone', data: { zone: 'groupby' } });

  return (
    <div
      ref={setNodeRef}
      className={cn('flex flex-wrap gap-2 items-center rounded-lg p-1.5 -m-1.5', isOver && 'bg-[#EAF3FB]')}
    >
      {groupBy.map(f => (
        <span
          key={f}
          style={{ background: '#fff', border: `1px solid ${C.green}`, color: C.ink }}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
        >
          {f}
          <button onClick={() => onRemove(f)} type="button"><X size={12} style={{ color: C.mut }} /></button>
        </span>
      ))}
      <AddFieldMenu schema={schema} exclude={groupBy} onAdd={onAdd} />
    </div>
  );
}
