import { useState } from 'react';
import { useRef } from 'react';
import Papa from 'papaparse';
import {
  Database, Upload, FileSpreadsheet, FileJson, Globe, Server, Check, X,
  Folder, Table2, Loader2, Pencil, Trash2, Eye, RotateCw,
} from 'lucide-react';

import Panel from '@/components/Panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem as SelectOption } from '@/components/ui/select';

import { useDataStore } from '@/store/dataStore';
import { useDatasetStore } from '@/modules/datasets/store';
import { useUploadStore } from '@/modules/uploads/store';
import { confirmDialog } from '@/components/confirm/store';
import { toast } from '@/components/toast/store';
import { buildSchema, type FieldSchema } from '@/modules/queries/schema';
import { sanitizeTableName } from '@/lib/tableName';
import { coerceToRows } from '@/lib/flatten';
import {
  datasetsApi, uploadSqliteFile, testDbConnection, listDbTables, importDbTable, fetchViaProxy,
  type DatasetSourceType, type DbType,
} from '@/lib/apiClient';
import type { DemoDataset } from '@/data/demoDatasets';
import { C } from '@/palette';

type Section = 'demo' | 'files' | 'rest' | 'database';
const SECTIONS: [Section, string, typeof Database][] = [
  ['files', 'Upload files', Upload],
  ['rest', 'REST API', Globe],
  ['database', 'Database connection', Server],
  ['demo', 'Demo data', Database],
];

const DB_TYPES: { value: DbType; label: string; wired: boolean }[] = [
  { value: 'sqlite', label: 'SQLite', wired: true },
  { value: 'postgres', label: 'PostgreSQL', wired: true },
  { value: 'mysql', label: 'MySQL', wired: true },
  { value: 'mssql', label: 'SQL Server', wired: true },
  { value: 'oracle', label: 'Oracle', wired: false },
];

interface PreviewState {
  name: string;
  schema: FieldSchema[];
  rows: Record<string, unknown>[];
}

interface ManagerRow {
  key: string;
  name: string;
  rowCount: number | null;
  columnCount: number | null;
  type: string;
  uploadedAt: string | null;
  kind: 'demo' | 'persisted';
  demoKey?: string;
  datasetId?: string;
}

export default function DataSourcesPage() {
  const { sourceName, loadDataset } = useDataStore();
  const datasets = useDatasetStore(s => s.datasets);
  const activateDataset = useDatasetStore(s => s.activate);
  const uploadDataset = useDatasetStore(s => s.upload);
  const renameDataset = useDatasetStore(s => s.rename);
  const removeDataset = useDatasetStore(s => s.remove);

  const [section, setSection] = useState<Section>('files');
  const [demos, setDemos] = useState<DemoDataset[] | null>(null);
  if (!demos) {
    import('@/data/demoDatasets').then(m => setDemos(m.DEMO_DATASETS));
  }

  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewBusyId, setPreviewBusyId] = useState<string | null>(null);

  // Demo datasets are generated client-side and intentionally never persisted.
  const activate = (name: string, rows: Record<string, unknown>[]) => {
    loadDataset(rows, name);
  };

  // File / REST / Database sources are persisted to Postgres (so they survive a
  // refresh or redeploy and show up everywhere) and then activated immediately.
  const persistAndActivate = async (name: string, sourceType: DatasetSourceType, rows: Record<string, unknown>[]) => {
    await uploadDataset(name, sourceType, buildSchema(rows), rows);
  };

  const previewDemo = (d: DemoDataset) => {
    const rows = d.make();
    setPreview({ name: d.label, schema: buildSchema(rows), rows: rows.slice(0, 20) });
  };

  const previewDataset = async (id: string, name: string) => {
    setPreviewBusyId(id);
    try {
      const full = await datasetsApi.get(id);
      setPreview({ name, schema: buildSchema(full.rows), rows: full.rows.slice(0, 20) });
    } finally {
      setPreviewBusyId(null);
    }
  };

  const managerRows: ManagerRow[] = [
    ...(demos ?? []).map(d => ({
      key: `demo:${d.key}`, name: d.label, rowCount: null, columnCount: null,
      type: 'Demo', uploadedAt: null, kind: 'demo' as const, demoKey: d.key,
    })),
    ...datasets.map(ds => ({
      key: `ds:${ds.id}`, name: ds.name, rowCount: ds.rowCount, columnCount: ds.columnCount,
      type: ds.sourceType, uploadedAt: ds.updatedAt, kind: 'persisted' as const, datasetId: ds.id,
    })),
  ];

  const selectRow = (r: ManagerRow) => {
    if (r.kind === 'demo') {
      const def = demos?.find(d => d.key === r.demoKey);
      if (def) activate(def.key, def.make());
    } else if (r.datasetId) {
      activateDataset(r.datasetId);
    }
  };

  const previewRow = (r: ManagerRow) => {
    if (r.kind === 'demo') {
      const def = demos?.find(d => d.key === r.demoKey);
      if (def) previewDemo(def);
    } else if (r.datasetId) {
      previewDataset(r.datasetId, r.name);
    }
  };

  const deleteRow = async (r: ManagerRow) => {
    if (!r.datasetId) return;
    const ok = await confirmDialog({ message: `Delete dataset "${r.name}"? This cannot be undone.` });
    if (!ok) return;
    await removeDataset(r.datasetId);
    toast.success(`"${r.name}" deleted`);
  };

  return (
    <div className="p-4 mx-auto space-y-4" style={{ maxWidth: 1200 }}>
      <Panel>
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: C.page, width: 'fit-content' }}>
          {SECTIONS.map(([k, l, I]) => (
            <button
              key={k}
              onClick={() => setSection(k)}
              type="button"
              style={section === k ? { background: '#fff', color: C.ink } : { color: C.mut }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold"
            >
              <I size={14} /> {l}
            </button>
          ))}
        </div>
      </Panel>

      {section === 'demo' && <DemoSection onActivate={activate} />}
      {section === 'files' && <FilesSection />}
      {section === 'rest' && <RestSection onPersist={persistAndActivate} />}
      {section === 'database' && <DatabaseSection onPersist={persistAndActivate} />}

      <Panel>
        <Label>All datasets</Label>
        <div className="mt-2 overflow-auto" style={{ border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: C.skyl }}>
                {['Name', 'Rows', 'Columns', 'Type', 'Uploaded', ''].map(h => (
                  <th key={h} style={{ color: C.ink }} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {managerRows.map(r => {
                const isActive = sourceName === sanitizeTableName(r.name);
                return (
                  <tr key={r.key} style={{ borderTop: `1px solid ${C.line}`, background: isActive ? C.skyl : undefined }}>
                    <td className="px-3 py-1.5">
                      {renaming && renaming.id === r.datasetId ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            autoFocus
                            value={renaming.value}
                            onChange={e => setRenaming({ id: renaming.id, value: e.target.value })}
                            className="h-7 text-sm"
                          />
                          <button
                            type="button"
                            onClick={async () => { await renameDataset(renaming.id, renaming.value); toast.success('Dataset renamed'); setRenaming(null); }}
                          >
                            <Check size={14} style={{ color: '#16a34a' }} />
                          </button>
                          <button type="button" onClick={() => setRenaming(null)}>
                            <X size={14} style={{ color: C.mut }} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: C.ink }} className="font-medium">
                          {r.name}{isActive && <span style={{ color: C.blue }} className="text-xs font-semibold ml-1.5">· active</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5" style={{ color: C.mut }}>{r.rowCount != null ? r.rowCount.toLocaleString() : '—'}</td>
                    <td className="px-3 py-1.5" style={{ color: C.mut }}>{r.columnCount ?? '—'}</td>
                    <td className="px-3 py-1.5" style={{ color: C.mut }}>{r.type}</td>
                    <td className="px-3 py-1.5" style={{ color: C.mut }}>{r.uploadedAt ? new Date(r.uploadedAt).toLocaleString() : '—'}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="soft" onClick={() => selectRow(r)}>Select</Button>
                        <button type="button" onClick={() => previewRow(r)} title="Preview">
                          {previewBusyId === r.datasetId
                            ? <Loader2 size={14} className="animate-spin" style={{ color: C.mut }} />
                            : <Eye size={14} style={{ color: C.mut }} />}
                        </button>
                        {r.kind === 'persisted' && r.datasetId && (
                          <>
                            <button type="button" onClick={() => setRenaming({ id: r.datasetId!, value: r.name })} title="Rename">
                              <Pencil size={14} style={{ color: C.mut }} />
                            </button>
                            <button type="button" onClick={() => deleteRow(r)} title="Delete">
                              <Trash2 size={14} style={{ color: C.mut }} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {preview && (
        <Panel>
          <div className="flex items-center justify-between">
            <Label>Preview — {preview.name}</Label>
            <button type="button" onClick={() => setPreview(null)}><X size={14} style={{ color: C.mut }} /></button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
            {preview.schema.map(s => (
              <span key={s.name} style={{ background: C.page, color: C.mut }} className="text-xs rounded-full px-2 py-0.5">
                {s.name} <span style={{ color: C.line }}>·</span> {s.type}
              </span>
            ))}
          </div>
          <div className="overflow-auto max-h-72" style={{ border: `1px solid ${C.line}`, borderRadius: 10 }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr style={{ background: C.skyl }}>
                  {preview.schema.map(s => (
                    <th key={s.name} style={{ color: C.ink }} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                    {preview.schema.map(s => (
                      <td key={s.name} className="px-3 py-1.5 whitespace-nowrap" style={{ color: C.text }}>{String(row[s.name] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ============================================================ Demo ============================================================ */

function DemoSection({ onActivate }: { onActivate: (name: string, rows: Record<string, unknown>[]) => void }) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  // Lazily imported to keep the initial bundle from carrying every generator unless visited.
  const [datasets, setDatasets] = useState<DemoDataset[] | null>(null);

  if (!datasets) {
    import('@/data/demoDatasets').then(m => setDatasets(m.DEMO_DATASETS));
    return <Panel><div style={{ color: C.mut }} className="text-sm py-4">Loading demo datasets…</div></Panel>;
  }

  return (
    <Panel>
      <Label>Built-in telecom datasets</Label>
      <div className="grid sm:grid-cols-2 gap-3 mt-2">
        {datasets.map(d => (
          <div key={d.key} style={{ border: `1px solid ${C.line}`, borderRadius: 12 }} className="p-3">
            <div className="flex items-center gap-2">
              <Table2 size={15} style={{ color: C.blue }} />
              <span style={{ color: C.ink }} className="font-semibold text-sm">{d.label}</span>
            </div>
            <div style={{ color: C.mut }} className="text-xs mt-1 mb-2">{d.description}</div>
            <Button
              size="sm"
              variant="soft"
              disabled={loadingKey === d.key}
              onClick={() => {
                setLoadingKey(d.key);
                setTimeout(() => {
                  onActivate(d.key, d.make());
                  setLoadingKey(null);
                }, 0);
              }}
            >
              {loadingKey === d.key ? <Loader2 size={13} className="animate-spin" /> : null} Load dataset
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ============================================================ Files ============================================================ */

function FilesSection() {
  const [dragOver, setDragOver] = useState(false);
  const uploads = useUploadStore(s => s.uploads);
  const startFile = useUploadStore(s => s.startFile);
  const setProgress = useUploadStore(s => s.setProgress);
  const finishFile = useUploadStore(s => s.finishFile);
  const failFile = useUploadStore(s => s.failFile);
  const retryUpload = useUploadStore(s => s.retry);
  const dismiss = useUploadStore(s => s.dismiss);
  const csvRef = useRef<HTMLInputElement>(null);
  const excelRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const handleCsvFiles = (fileList: FileList | File[]) => {
    Array.from(fileList).forEach(f => {
      startFile(f.name, 'csv');
      const reader = new FileReader();
      reader.onprogress = e => {
        if (e.lengthComputable) setProgress(f.name, Math.round((e.loaded / e.total) * 100));
      };
      reader.onload = e => {
        try {
          const text = String(e.target?.result ?? '');
          Papa.parse(text, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: res => {
              if (res.errors.length) {
                failFile(f.name, res.errors[0].message);
                return;
              }
              finishFile(f.name, 'csv', res.data as Record<string, unknown>[]);
            },
            error: (err: Error) => failFile(f.name, err.message),
          });
        } catch (err) {
          failFile(f.name, (err as Error).message);
        }
      };
      reader.onerror = () => failFile(f.name, 'Could not read the file.');
      reader.readAsText(f);
    });
  };

  const handleExcelFiles = (fileList: FileList | File[]) => {
    Array.from(fileList).forEach(f => {
      startFile(f.name, 'excel');
      const reader = new FileReader();
      reader.onprogress = e => {
        if (e.lengthComputable) setProgress(f.name, Math.round((e.loaded / e.total) * 100));
      };
      reader.onload = async e => {
        try {
          const buf = e.target?.result;
          const XLSX = await import('xlsx');
          const wb = XLSX.read(buf, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];
          finishFile(f.name, 'excel', rows);
        } catch (err) {
          failFile(f.name, (err as Error).message);
        }
      };
      reader.onerror = () => failFile(f.name, 'Could not read the file.');
      reader.readAsArrayBuffer(f);
    });
  };

  const handleJsonFiles = (fileList: FileList | File[]) => {
    Array.from(fileList).forEach(f => {
      startFile(f.name, 'json');
      const reader = new FileReader();
      reader.onprogress = e => {
        if (e.lengthComputable) setProgress(f.name, Math.round((e.loaded / e.total) * 100));
      };
      reader.onload = e => {
        try {
          const parsed = JSON.parse(String(e.target?.result));
          finishFile(f.name, 'json', coerceToRows(parsed));
        } catch {
          failFile(f.name, 'Could not parse this file as JSON.');
        }
      };
      reader.onerror = () => failFile(f.name, 'Could not read the file.');
      reader.readAsText(f);
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const csv = files.filter(f => /\.(csv|tsv)$/i.test(f.name));
    const excel = files.filter(f => /\.(xlsx|xls)$/i.test(f.name));
    const json = files.filter(f => /\.json$/i.test(f.name));
    if (csv.length) handleCsvFiles(csv);
    if (excel.length) handleExcelFiles(excel);
    if (json.length) handleJsonFiles(json);
  };

  return (
    <Panel>
      <Label>Upload CSV / TSV / Excel / JSON</Label>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragOver ? C.blue : C.line}`,
          borderRadius: 12,
          background: dragOver ? C.skyl : 'transparent',
        }}
        className="mt-2 p-6 text-center"
      >
        <Folder size={22} style={{ color: C.mut, margin: '0 auto 8px' }} />
        <div style={{ color: C.mut }} className="text-sm mb-3">Drag and drop one or more files here, or pick a type below</div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => csvRef.current?.click()}><Upload size={13} /> CSV / TSV</Button>
          <Button variant="ghost" size="sm" onClick={() => excelRef.current?.click()}><FileSpreadsheet size={13} /> Excel</Button>
          <Button variant="ghost" size="sm" onClick={() => jsonRef.current?.click()}><FileJson size={13} /> JSON</Button>
        </div>
        <input ref={csvRef} type="file" accept=".csv,.tsv" multiple className="hidden"
          onChange={e => { if (e.target.files) handleCsvFiles(e.target.files); e.target.value = ''; }} />
        <input ref={excelRef} type="file" accept=".xlsx,.xls" multiple className="hidden"
          onChange={e => { if (e.target.files) handleExcelFiles(e.target.files); e.target.value = ''; }} />
        <input ref={jsonRef} type="file" accept=".json" multiple className="hidden"
          onChange={e => { if (e.target.files) handleJsonFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {uploads.length > 0 && (
        <div className="mt-3 space-y-2">
          <Label className="flex items-center gap-1.5"><Upload size={13} /> Uploads</Label>
          <div style={{ color: C.mut }} className="text-xs -mt-1">
            Files save automatically as soon as they finish parsing — this keeps running even if you switch tabs.
          </div>
          {uploads.map(f => (
            <div key={f.name} style={{ border: `1px solid ${f.status === 'error' ? '#fecaca' : C.line}`, borderRadius: 10 }} className="p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <span style={{ color: C.ink }} className="font-semibold text-sm">{f.name}</span>
                  {f.status === 'uploading' && (
                    <span style={{ color: C.mut }} className="text-xs ml-2">Uploading… {f.progress}%</span>
                  )}
                  {(f.status === 'saving' || f.status === 'saved') && (
                    <span style={{ color: C.mut }} className="text-xs ml-2">{f.rowCount.toLocaleString()} rows · {f.columnCount} columns</span>
                  )}
                  {f.status === 'error' && (
                    <span style={{ color: '#dc2626' }} className="text-xs ml-2">{f.message}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {f.status === 'saving' && (
                    <span style={{ color: C.mut }} className="text-xs inline-flex items-center gap-1"><Loader2 size={13} className="animate-spin" /> Saving… {f.progress}%</span>
                  )}
                  {f.status === 'saved' && (
                    <span style={{ color: '#16a34a' }} className="text-xs inline-flex items-center gap-1"><Check size={13} /> Saved &amp; active</span>
                  )}
                  {f.status === 'error' && f.rows && (
                    <Button variant="ghost" size="sm" onClick={() => retryUpload(f.name)}>
                      <RotateCw size={13} /> Retry
                    </Button>
                  )}
                  <button type="button" onClick={() => dismiss(f.name)}>
                    <X size={14} style={{ color: C.mut }} />
                  </button>
                </div>
              </div>
              {(f.status === 'uploading' || f.status === 'saving') && (
                <div className="mt-2 rounded-full overflow-hidden" style={{ background: C.page, height: 6 }}>
                  <div
                    style={{ width: `${f.progress}%`, background: C.blue, height: '100%', transition: 'width 0.15s ease' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ============================================================ REST API ============================================================ */

function RestSection({
  onPersist,
}: {
  onPersist: (name: string, sourceType: DatasetSourceType, rows: Record<string, unknown>[]) => Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [headersText, setHeadersText] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'loading' | 'ok' | 'error'; message?: string }>({ kind: 'idle' });

  const parseHeaders = (): Record<string, string> => {
    const out: Record<string, string> = {};
    headersText.split('\n').forEach(line => {
      const idx = line.indexOf(':');
      if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    });
    return out;
  };

  const fetchData = async () => {
    if (!url.trim()) return;
    setStatus({ kind: 'loading' });
    try {
      const data = await fetchViaProxy({ url, method, headers: parseHeaders() });
      const rows = coerceToRows(data);
      if (!rows.length) { setStatus({ kind: 'error', message: 'Response did not contain any rows.' }); return; }
      const name = new URL(url).hostname.replace(/\./g, '_');
      await onPersist(name, 'rest', rows);
      setStatus({ kind: 'ok', message: `Loaded and saved ${rows.length} rows.` });
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message });
    }
  };

  return (
    <Panel>
      <Label>REST API source</Label>
      <div style={{ color: C.mut }} className="text-xs mt-1 mb-3">
        Fetched server-side through the backend proxy to avoid browser CORS restrictions. JSON responses are auto-flattened into rows.
      </div>
      <div className="grid sm:grid-cols-[100px_1fr] gap-2 items-center">
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {['GET', 'POST', 'PUT', 'DELETE'].map(m => <SelectOption key={m} value={m}>{m}</SelectOption>)}
          </SelectContent>
        </Select>
        <Input placeholder="https://api.company.com/alarms" value={url} onChange={e => setUrl(e.target.value)} />
      </div>
      <Label className="mt-3">Headers (one per line, "Key: Value")</Label>
      <textarea
        value={headersText}
        onChange={e => setHeadersText(e.target.value)}
        rows={3}
        placeholder="Authorization: Bearer ..."
        style={{ border: `1px solid ${C.line}`, borderRadius: 8 }}
        className="w-full mt-1 p-2 text-sm font-mono"
      />
      <div className="flex items-center gap-3 mt-3">
        <Button onClick={fetchData} disabled={status.kind === 'loading'}>
          {status.kind === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />} Fetch &amp; load
        </Button>
        {status.kind === 'ok' && <span style={{ color: '#16a34a' }} className="text-sm">{status.message}</span>}
        {status.kind === 'error' && <span style={{ color: '#dc2626' }} className="text-sm">{status.message}</span>}
      </div>
    </Panel>
  );
}

/* ============================================================ Database ============================================================ */

function DatabaseSection({
  onPersist,
}: {
  onPersist: (name: string, sourceType: DatasetSourceType, rows: Record<string, unknown>[]) => Promise<void>;
}) {
  const [type, setType] = useState<DbType>('sqlite');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [database, setDatabase] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [tables, setTables] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const wired = DB_TYPES.find(d => d.value === type)?.wired ?? false;
  const conn = { type, host, port, database, user, password };

  const onSqliteUpload = async (file: File) => {
    setBusy(true);
    try {
      const filePath = await uploadSqliteFile(file);
      setDatabase(filePath);
      setMessage({ kind: 'ok', text: `Uploaded ${file.name}` });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await testDbConnection(conn);
      setMessage({ kind: 'ok', text: 'Connection successful.' });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const loadTables = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setTables(await listDbTables(conn));
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const importTable = async (table: string) => {
    setBusy(true);
    try {
      const rows = await importDbTable(conn, table);
      await onPersist(table, 'database', rows);
      setMessage({ kind: 'ok', text: `Imported and saved ${rows.length} rows from "${table}".` });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <Label>Database connection</Label>
      <div style={{ color: C.mut }} className="text-xs mt-1 mb-3">
        Connects through the local backend (server/). Picking a table imports its rows and saves them as a new dataset, the same way a CSV upload would.
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={type} onValueChange={v => { setType(v as DbType); setTables(null); }}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DB_TYPES.map(d => (
                <SelectOption key={d.value} value={d.value}>{d.label}{!d.wired ? ' (not wired yet)' : ''}</SelectOption>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!wired && (
          <div className="flex items-end">
            <span style={{ color: '#b45309', background: '#fffbeb' }} className="text-xs rounded-lg px-2.5 py-1.5">
              {DB_TYPES.find(d => d.value === type)?.label} isn't wired up — it needs Oracle's proprietary Instant Client native libraries, which we can't bundle. SQLite, PostgreSQL, MySQL and SQL Server all connect for real.
            </span>
          </div>
        )}
      </div>

      {type === 'sqlite' ? (
        <div className="mt-3">
          <Label>Database file (.sqlite / .db)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}><Upload size={13} /> Upload file</Button>
            <input ref={fileRef} type="file" accept=".sqlite,.db,.sqlite3" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onSqliteUpload(f); e.target.value = ''; }} />
            {database && <span style={{ color: C.mut }} className="text-xs truncate">{database}</span>}
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <div><Label>Host</Label><Input className="mt-1" value={host} onChange={e => setHost(e.target.value)} placeholder="localhost" disabled={!wired} /></div>
          <div><Label>Port</Label><Input className="mt-1" value={port} onChange={e => setPort(e.target.value)} placeholder="5432" disabled={!wired} /></div>
          <div><Label>Database</Label><Input className="mt-1" value={database} onChange={e => setDatabase(e.target.value)} disabled={!wired} /></div>
          <div><Label>Username</Label><Input className="mt-1" value={user} onChange={e => setUser(e.target.value)} disabled={!wired} /></div>
          <div><Label>Password</Label><Input className="mt-1" type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={!wired} /></div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <Button variant="ghost" size="sm" onClick={testConnection} disabled={busy || !wired}>Test connection</Button>
        <Button variant="ghost" size="sm" onClick={loadTables} disabled={busy || !wired || !database}>List tables</Button>
        {busy && <Loader2 size={14} className="animate-spin" style={{ color: C.mut }} />}
      </div>
      {message && (
        <div style={{ color: message.kind === 'ok' ? '#16a34a' : '#dc2626' }} className="text-sm mt-2">{message.text}</div>
      )}

      {tables && (
        <div className="mt-3" style={{ border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ borderBottom: `1px solid ${C.line}`, color: C.mut }} className="text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Database size={12} /> {database}
          </div>
          {tables.length === 0 ? (
            <div style={{ color: C.mut }} className="text-sm p-3">No tables found.</div>
          ) : (
            <div className="p-1">
              {tables.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => importTable(t)}
                  style={{ color: C.ink }}
                  className="w-full flex items-center gap-2 text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-gray-50"
                >
                  <Table2 size={13} style={{ color: C.mut }} /> {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
