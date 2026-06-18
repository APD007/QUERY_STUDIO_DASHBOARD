import { useEffect, useState } from 'react';
import { Database, Trash2, FileSpreadsheet } from 'lucide-react';

import Panel from '@/components/Panel';
import { Label } from '@/components/ui/label';

import { useDataStore } from '@/store/dataStore';
import { useDatasetStore } from '@/modules/datasets/store';
import { useQueryStore } from '@/modules/queries/store';
import { sanitizeTableName } from '@/lib/tableName';
import type { Query } from '@/types/expr';
import type { DemoDataset } from '@/data/demoDatasets';
import { C } from '@/palette';

export default function DatasetSidebar({ onSelectQuery }: { onSelectQuery: (q: Query) => void }) {
  const sourceName = useDataStore(s => s.sourceName);
  const loadDataset = useDataStore(s => s.loadDataset);
  const datasets = useDatasetStore(s => s.datasets);
  const activateDataset = useDatasetStore(s => s.activate);
  const { queries, deleteQuery } = useQueryStore();

  const [demos, setDemos] = useState<DemoDataset[] | null>(null);
  useEffect(() => {
    import('@/data/demoDatasets').then(m => setDemos(m.DEMO_DATASETS));
  }, []);

  return (
    <div className="lg:w-60 shrink-0 space-y-4">
      <Panel>
        <Label>Datasets</Label>
        <div className="mt-1.5 space-y-0.5">
          <div style={{ color: C.mut }} className="text-[11px] font-semibold uppercase tracking-wide pt-1 pb-0.5">Sample</div>
          {(demos ?? []).map(d => {
            const active = sourceName === sanitizeTableName(d.key);
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => loadDataset(d.make(), d.key)}
                style={active ? { background: C.skyl, color: C.blue } : { color: C.ink }}
                className="w-full flex items-center gap-1.5 text-left text-sm font-medium rounded-lg px-2 py-1.5 truncate"
              >
                <Database size={13} style={{ color: active ? C.blue : C.mut }} /> {d.label}
              </button>
            );
          })}

          {datasets.length > 0 && (
            <>
              <div style={{ color: C.mut }} className="text-[11px] font-semibold uppercase tracking-wide pt-2 pb-0.5">Uploaded</div>
              {datasets.map(d => {
                const active = sourceName === sanitizeTableName(d.name);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => activateDataset(d.id)}
                    style={active ? { background: C.skyl, color: C.blue } : { color: C.ink }}
                    className="w-full flex items-center gap-1.5 text-left text-sm font-medium rounded-lg px-2 py-1.5 truncate"
                  >
                    <FileSpreadsheet size={13} style={{ color: active ? C.blue : C.mut }} /> {d.name}
                  </button>
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
                <button onClick={() => q.id && deleteQuery(q.id)} type="button">
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
