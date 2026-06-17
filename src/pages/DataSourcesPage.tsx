import { useRef, useState } from 'react';
import Papa from 'papaparse';
import {
  Database, Upload, FileSpreadsheet, FileJson, Globe, Server, Check, X,
  Folder, Table2, History, Loader2,
} from 'lucide-react';

import Panel from '@/components/Panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem as SelectOption } from '@/components/ui/select';

import { useDataStore } from '@/store/dataStore';
import { buildSchema, type FieldSchema } from '@/modules/queries/schema';
import { sanitizeTableName } from '@/lib/tableName';
import { coerceToRows } from '@/lib/flatten';
import {
  uploadSqliteFile, testDbConnection, listDbTables, importDbTable, fetchViaProxy,
  type DbType,
} from '@/lib/apiClient';
import { C } from '@/palette';

type Section = 'demo' | 'files' | 'rest' | 'database';
const SECTIONS: [Section, string, typeof Database][] = [
  ['demo', 'Demo data', Database],
  ['files', 'Upload files', Upload],
  ['rest', 'REST API', Globe],
  ['database', 'Database connection', Server],
];

interface HistoryEntry {
  name: string;
  rows: number;
  cols: number;
  data: Record<string, unknown>[];
}

const DB_TYPES: { value: DbType; label: string; wired: boolean }[] = [
  { value: 'sqlite', label: 'SQLite', wired: true },
  { value: 'postgres', label: 'PostgreSQL', wired: true },
  { value: 'mysql', label: 'MySQL', wired: true },
  { value: 'mssql', label: 'SQL Server', wired: true },
  { value: 'oracle', label: 'Oracle', wired: false },
];

export default function DataSourcesPage() {
  const { sourceName, data, schema, loadDataset } = useDataStore();
  const [section, setSection] = useState<Section>('demo');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const remember = (name: string, rows: Record<string, unknown>[]) => {
    setHistory(h => {
      const cols = rows.length ? Object.keys(rows[0]).length : 0;
      const next = [{ name, rows: rows.length, cols, data: rows }, ...h.filter(e => e.name !== name)];
      return next.slice(0, 8);
    });
  };

  const activate = (name: string, rows: Record<string, unknown>[]) => {
    loadDataset(rows, name);
    remember(sanitizeTableName(name), rows);
  };

  return (
    <div className="p-4 mx-auto space-y-4" style={{ maxWidth: 1200 }}>
      <Panel>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Database size={16} style={{ color: C.blue }} />
            <span style={{ color: C.ink }} className="font-semibold text-sm">Active dataset: {sourceName}</span>
            <span style={{ color: C.mut }} className="text-xs">{data.length.toLocaleString()} rows · {schema.length} fields</span>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg mt-3" style={{ background: C.page, width: 'fit-content' }}>
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
      {section === 'files' && <FilesSection onActivate={activate} />}
      {section === 'rest' && <RestSection onActivate={activate} />}
      {section === 'database' && <DatabaseSection onActivate={activate} />}

      {history.length > 0 && (
        <Panel>
          <Label className="flex items-center gap-1.5"><History size={13} /> Dataset history (this session)</Label>
          <div className="mt-2 space-y-1">
            {history.map(h => (
              <div
                key={h.name}
                style={{ border: `1px solid ${C.line}` }}
                className="flex items-center justify-between rounded-lg px-3 py-1.5"
              >
                <span style={{ color: C.ink }} className="text-sm font-medium truncate">{h.name}</span>
                <span style={{ color: C.mut }} className="text-xs mr-3">{h.rows.toLocaleString()} rows · {h.cols} cols</span>
                <Button variant="ghost" size="sm" onClick={() => loadDataset(h.data, h.name)}>Use</Button>
              </div>
            ))}
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
  const [datasets, setDatasets] = useState<typeof import('@/data/demoDatasets').DEMO_DATASETS | null>(null);

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

function FilesSection({ onActivate }: { onActivate: (name: string, rows: Record<string, unknown>[]) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [previews, setPreviews] = useState<{ name: string; rows: Record<string, unknown>[]; schema: FieldSchema[] }[]>([]);
  const csvRef = useRef<HTMLInputElement>(null);
  const excelRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const addPreview = (name: string, rows: Record<string, unknown>[]) => {
    setPreviews(p => [{ name, rows, schema: buildSchema(rows) }, ...p.filter(x => x.name !== name)]);
  };

  const handleCsvFiles = (files: FileList | File[]) => {
    Array.from(files).forEach(f => {
      Papa.parse(f, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: res => addPreview(f.name, res.data as Record<string, unknown>[]),
      });
    });
  };

  const handleExcelFiles = (files: FileList | File[]) => {
    Array.from(files).forEach(f => {
      const reader = new FileReader();
      reader.onload = async e => {
        const buf = e.target?.result;
        const XLSX = await import('xlsx');
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];
        addPreview(f.name, rows);
      };
      reader.readAsArrayBuffer(f);
    });
  };

  const handleJsonFiles = (files: FileList | File[]) => {
    Array.from(files).forEach(f => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const parsed = JSON.parse(String(e.target?.result));
          addPreview(f.name, coerceToRows(parsed));
        } catch {
          addPreview(f.name, []);
        }
      };
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

      {previews.length > 0 && (
        <div className="mt-3 space-y-2">
          {previews.map(p => (
            <div key={p.name} style={{ border: `1px solid ${C.line}`, borderRadius: 10 }} className="p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span style={{ color: C.ink }} className="font-semibold text-sm">{p.name}</span>
                  <span style={{ color: C.mut }} className="text-xs ml-2">{p.rows.length.toLocaleString()} rows · {p.schema.length} columns</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => onActivate(p.name, p.rows)}><Check size={13} /> Use this dataset</Button>
                  <button type="button" onClick={() => setPreviews(prev => prev.filter(x => x.name !== p.name))}>
                    <X size={14} style={{ color: C.mut }} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {p.schema.map(f => (
                  <span key={f.name} style={{ background: C.page, color: C.mut }} className="text-xs rounded-full px-2 py-0.5">
                    {f.name} <span style={{ color: C.line }}>·</span> {f.type}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ============================================================ REST API ============================================================ */

function RestSection({ onActivate }: { onActivate: (name: string, rows: Record<string, unknown>[]) => void }) {
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
      onActivate(name, rows);
      setStatus({ kind: 'ok', message: `Loaded ${rows.length} rows.` });
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

function DatabaseSection({ onActivate }: { onActivate: (name: string, rows: Record<string, unknown>[]) => void }) {
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
      onActivate(table, rows);
      setMessage({ kind: 'ok', text: `Imported ${rows.length} rows from "${table}".` });
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
        Connects through the local backend (server/). Picking a table imports its rows into the browser, the same way a CSV upload would — the rest of the app always queries in-browser.
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
