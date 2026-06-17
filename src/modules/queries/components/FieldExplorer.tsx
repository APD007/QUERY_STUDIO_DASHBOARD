import { useDraggable } from '@dnd-kit/core';
import { Hash, Calendar, ToggleRight, Type as TypeIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FieldSchema } from '../schema';
import { C } from '@/palette';

function TypeIconFor({ t }: { t: FieldSchema['type'] }) {
  const map = { number: Hash, date: Calendar, bool: ToggleRight, text: TypeIcon };
  const I = map[t] || TypeIcon;
  return <I size={13} style={{ color: C.mut }} />;
}

function DraggableField({ s, onClick }: { s: FieldSchema; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `field:${s.name}`,
    data: { kind: 'field', fieldName: s.name },
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      type="button"
      style={{ border: `1px solid ${C.line}` }}
      className={cn(
        'w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-slate-50 text-left cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
    >
      <span style={{ color: C.text }} className="text-sm">{s.name}</span>
      <span className="flex items-center gap-1">
        <TypeIconFor t={s.type} />
        <span style={{ color: C.mut }} className="text-xs">{s.type}</span>
      </span>
    </button>
  );
}

export default function FieldExplorer({
  schema, onAddField,
}: {
  schema: FieldSchema[];
  onAddField: (name: string) => void;
}) {
  return (
    <div className="space-y-1 max-h-72 overflow-auto">
      {schema.map(s => (
        <DraggableField key={s.name} s={s} onClick={() => onAddField(s.name)} />
      ))}
    </div>
  );
}
