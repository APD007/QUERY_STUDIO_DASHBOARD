import { Link2Off, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem as SelectOption } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { JoinType } from '@/types/expr';
import { C } from '@/palette';

const JOIN_TYPES: JoinType[] = ['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS'];

/**
 * Phase 2 placeholder. Multi-table joins need a data layer that can hold more
 * than one source table at once (today the app only ever queries a single
 * in-memory `data` array). The UI shape is here so the architecture matches
 * the target design, but every control is disabled until that data layer
 * exists — it intentionally does not pretend to generate working SQL.
 */
export default function JoinBuilder() {
  return (
    <div
      style={{ border: `1px dashed ${C.line}`, borderRadius: 12 }}
      className="p-4 space-y-3 opacity-70"
    >
      <div className="flex items-center justify-between">
        <div style={{ color: C.ink }} className="text-sm font-semibold flex items-center gap-2">
          <Link2Off size={15} style={{ color: C.mut }} />
          Join Builder
        </div>
        <Badge variant="outline">Phase 2 — needs multi-table data source</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: C.mut }}>
        <span className="font-mono px-2 py-1 rounded bg-white border" style={{ borderColor: C.line }}>
          fact_alarms
        </span>
        <Select disabled value="INNER">
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {JOIN_TYPES.map(t => <SelectOption key={t} value={t}>{t} JOIN</SelectOption>)}
          </SelectContent>
        </Select>
        <Select disabled value="">
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="right table…" /></SelectTrigger>
          <SelectContent><SelectOption value="_">No other tables loaded</SelectOption></SelectContent>
        </Select>
        <span>ON</span>
        <Select disabled value=""><SelectTrigger className="w-[120px]"><SelectValue placeholder="left.key" /></SelectTrigger><SelectContent><SelectOption value="_">—</SelectOption></SelectContent></Select>
        <span>=</span>
        <Select disabled value=""><SelectTrigger className="w-[120px]"><SelectValue placeholder="right.key" /></SelectTrigger><SelectContent><SelectOption value="_">—</SelectOption></SelectContent></Select>
      </div>

      <Button variant="ghost" size="sm" disabled>
        <Plus size={13} /> Add join
      </Button>

      <div style={{ color: C.mut }} className="text-xs">
        Drag a join operator from the palette to preview this panel — joins won't execute until a
        multi-table data source ships.
      </div>
    </div>
  );
}
