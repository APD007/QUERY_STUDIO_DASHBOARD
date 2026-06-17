import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { testSqlite, listSqliteTables, importSqliteTable } from './db/sqlite.js';
import { testPostgres, listPostgresTables, importPostgresTable } from './db/postgres.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({ dest: uploadsDir });

app.get('/api/health', (req, res) => res.json({ ok: true }));

/* ---- SQLite file upload: returns a server-side path to use as `database` ---- */
app.post('/api/sqlite/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ filePath: req.file.path });
});

const SUPPORTED_TYPES = ['sqlite', 'postgres'];

function dispatch(type, conn) {
  if (type === 'sqlite') {
    return {
      test: () => testSqlite(conn.database),
      tables: () => listSqliteTables(conn.database),
      import: (table, limit) => importSqliteTable(conn.database, table, limit),
    };
  }
  if (type === 'postgres') {
    return {
      test: () => testPostgres(conn),
      tables: () => listPostgresTables(conn),
      import: (table, limit) => importPostgresTable(conn, table, limit),
    };
  }
  throw new Error(
    `Database type "${type}" isn't wired up yet — only ${SUPPORTED_TYPES.join(' and ')} work today.`
  );
}

app.post('/api/db/test', async (req, res) => {
  try {
    const { type, ...conn } = req.body;
    await dispatch(type, conn).test();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/db/tables', async (req, res) => {
  try {
    const { type, ...conn } = req.body;
    const tables = await dispatch(type, conn).tables();
    res.json({ tables });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/db/import', async (req, res) => {
  try {
    const { type, table, limit, ...conn } = req.body;
    if (!table) return res.status(400).json({ error: 'table is required' });
    const rows = await dispatch(type, conn).import(table, limit ? Number(limit) : 5000);
    res.json({ rows });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ---- REST API source: server-side fetch avoids browser CORS restrictions ---- */
app.post('/api/proxy/fetch', async (req, res) => {
  try {
    const { url, method = 'GET', headers = {}, body } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    const resp = await fetch(url, {
      method,
      headers,
      body: !['GET', 'HEAD'].includes(method) && body ? JSON.stringify(body) : undefined,
    });
    const contentType = resp.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await resp.json() : await resp.text();
    res.status(resp.ok ? 200 : 502).json({ status: resp.status, data });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---- Serve the built frontend (single deployable process) ---- */
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log(`Query Studio backend listening on http://localhost:${PORT}`);
  if (!fs.existsSync(distDir)) {
    console.log('(no dist/ found — run `npm run build` to serve the frontend from this process too)');
  }
});
