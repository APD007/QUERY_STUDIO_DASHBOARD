import { useEffect, useState } from 'react';
import { Database, Trash2, FileSpreadsheet, ChevronDown, ChevronRight } from 'lucide-react';

import Panel from '@/components/Panel';
import { Label } from '@/components/ui/label';

import { useDataStore } from '@/store/dataStore';
import { useDatasetStore } from '@/modules/datasets/store';
import { useQueryStore } from '@/modules/queries/store';
import { sanitizeTableName } from '@/lib/tableName';
import { confirmDialog } from '@/components/confirm/store';
import { toast } from '@/components/toast/store';
import type { Query } from '@/types/expr';
import type { FieldSchema } from '@/modules/queries/schema';
import type { DemoDataset } from '@/data/demoDatasets';
import { C } from '@/palette';

function SchemaList({ fields }: { fields: FieldSchema[] }) {
  if (!fields.length) return <div style={{ color: C.mut }} className="text-xs pl-6 py-1">No columns</div>;
  return (
    <div className="pl-6 pb-1.5 flex flex-wrap gap-1">
      {fields.map(f => (
        <span
          key={f.name}
          style={{ background: C.page, color: C.mut, border: `1px solid ${C.line}` }}
          className="text-[11px] rounded-full px-2 py-0.5"
          title={f.type}
        >
          {f.name}
        </span>
      ))}
    </div>
  );
}

export default function DatasetSidebar({ onSelectQuery }: { onSelectQuery: (q: Query) => void }) {
  const sourceName = useDataStore(s => s.sourceName);
  const schema = useDataStore(s => s.schema);
  const loadDataset = useDataStore(s => s.loadDataset);
  const joinTables = useDataStore(s => s.joinTables);
  const datasets = useDatasetStore(s => s.datasets);
  const activateDataset = useDatasetStore(s => s.activate);
  const { queries, deleteQuery } = useQueryStore();

  const [demos, setDemos] = useState<DemoDataset[] | null>(null);
  useEffect(() => {
    import('@/data/demoDatasets').then(m => setDemos(m.DEMO_DATASETS));
  }, []);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setExpanded(e => ({ ...e, [key]: !e[key] }));
  const fieldsFor = (tableKey: string, active: boolean) =>
    active ? schema : joinTables[tableKey]?.schema ?? [];

  const handleDeleteQuery = async (q: Query) => {
    if (!q.id) return;
    const ok = await confirmDialog({ message: `Delete saved query "${q.name}"? This cannot be undone.` });
    if (!ok) return;
    deleteQuery(q.id);
    toast.success(`"${q.name}" deleted`);
  };

  return (
    <div className="lg:w-60 shrink-0 space-y-4">
      <Panel>
        <Label>Datasets</Label>
        <div className="mt-1.5 space-y-0.5">
          <div style={{ color: C.mut }} className="text-[11px] font-semibold uppercase tracking-wide pt-1 pb-0.5">Sample</div>
          {(demos ?? []).map(d => {
            const tableKey = sanitizeTableName(d.key);
            const active = sourceName === tableKey;
            const isOpen = !!expanded[tableKey];
            return (
              <div key={d.key}>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => toggle(tableKey)} className="shrink-0 p-0.5">
                    {isOpen ? <ChevronDown size={12} style={{ color: C.mut }} /> : <ChevronRight size={12} style={{ color: C.mut }} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => loadDataset(d.make(), d.key)}
                    style={active ? { background: C.skyl, color: C.blue } : { color: C.ink }}
                    className="flex-1 min-w-0 flex items-center gap-1.5 text-left text-sm font-medium rounded-lg px-2 py-1.5 truncate"
                  >
                    <Database size={13} style={{ color: active ? C.blue : C.mut }} /> {d.label}
                  </button>
                </div>
                {isOpen && <SchemaList fields={fieldsFor(tableKey, active)} />}
              </div>
            );
          })}

          {datasets.length > 0 && (
            <>
              <div style={{ color: C.mut }} className="text-[11px] font-semibold uppercase tracking-wide pt-2 pb-0.5">Uploaded</div>
              {datasets.map(d => {
                const tableKey = sanitizeTableName(d.name);
                const active = sourceName === tableKey;
                const isOpen = !!expanded[tableKey];
                return (
                  <div key={d.id}>
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => toggle(tableKey)} className="shrink-0 p-0.5">
                        {isOpen ? <ChevronDown size={12} style={{ color: C.mut }} /> : <ChevronRight size={12} style={{ color: C.mut }} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => activateDataset(d.id)}
                        style={active ? { background: C.skyl, color: C.blue } : { color: C.ink }}
                        className="flex-1 min-w-0 flex items-center gap-1.5 text-left text-sm font-medium rounded-lg px-2 py-1.5 truncate"
                      >
                        <FileSpreadsheet size={13} style={{ color: active ? C.blue : C.mut }} /> {d.name}
                      </button>
                    </div>
                    {isOpen && <SchemaList fields={fieldsFor(tableKey, active)} />}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </Panel>

      <Panel>
        <Label>Saved queries</Label>
        {queries.length === 0 ? (
          <div style={{ color: C.mut }} className="text-sm py-3">Run and save a query to reuse it.</div>
        ) : (
          <div className="mt-1.5 space-y-1">
            {queries.map(q => (
              <div
                key={q.id}
                style={{ border: `1px solid ${C.line}` }}
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
              >
                <button
                  onClick={() => onSelectQuery(q)}
                  type="button"
                  style={{ color: C.ink }}
                  className="text-sm font-medium truncate flex-1 text-left"
                >
                  {q.name}
                </button>
                <button onClick={() => handleDeleteQuery(q)} type="button">
                  <Trash2 size={13} style={{ color: C.mut }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
