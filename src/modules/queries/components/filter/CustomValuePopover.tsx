import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem as SelectOption } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import type { LiteralNode, LiteralValueType } from '@/types/expr';
import { C } from '@/palette';

function renderPreview(value: LiteralNode): string {
  if (value.valueType === 'string') return `'${value.value}'`;
  return String(value.value);
}

export default function CustomValuePopover({
  value, onChange,
}: {
  value: LiteralNode;
  onChange: (l: LiteralNode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [vt, setVt] = useState<LiteralValueType>(value.valueType);
  const [raw, setRaw] = useState(String(value.value));

  const apply = () => {
    let v: number | string | boolean = raw;
    if (vt === 'number') v = Number(raw) || 0;
    if (vt === 'boolean') v = raw === 'true';
    onChange({ kind: 'literal', valueType: vt, value: v });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={o => {
        setOpen(o);
        if (o) { setVt(value.valueType); setRaw(String(value.value)); }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          style={{ border: `1px solid ${C.line}`, color: C.text }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-mono bg-white hover:border-[#2E75B6]"
        >
          {renderPreview(value)} <Pencil size={11} style={{ color: C.mut }} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3">
        <Label>Custom value</Label>
        <Select value={vt} onValueChange={(v: LiteralValueType) => setVt(v)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectOption value="string">String</SelectOption>
            <SelectOption value="number">Number</SelectOption>
            <SelectOption value="boolean">Boolean</SelectOption>
            <SelectOption value="date">Date</SelectOption>
          </SelectContent>
        </Select>

        {vt === 'boolean' ? (
          <div className="flex items-center gap-2">
            <Switch checked={raw === 'true'} onCheckedChange={c => setRaw(String(c))} />
            <span style={{ color: C.text }} className="text-sm">{raw === 'true' ? 'TRUE' : 'FALSE'}</span>
          </div>
        ) : vt === 'date' ? (
          <Input type="date" value={raw} onChange={e => setRaw(e.target.value)} />
        ) : (
          <Input
            type={vt === 'number' ? 'number' : 'text'}
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder={vt === 'number' ? '0' : 'value…'}
          />
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={apply}>Apply</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
