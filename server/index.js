import express from 'express';
import cors from 'cors';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { testSqlite, listSqliteTables, importSqliteTable } from './db/sqlite.js';
import { testPostgres, listPostgresTables, importPostgresTable } from './db/postgres.js';
import { testMysql, listMysqlTables, importMysqlTable } from './db/mysql.js';
import { testMssql, listMssqlTables, importMssqlTable } from './db/mssql.js';
import { assertPublicHost } from './security/ssrfGuard.js';
import { requireAuth } from './middleware/requireAuth.js';
import authRouter from './routes/auth.js';
import { queriesRouter, widgetsRouter, dashboardsRouter } from './routes/collections.js';
import { datasetsRouter } from './routes/datasets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
app.set('trust proxy', 1);

// Same-origin in production (frontend is served by this same process); permissive in dev
// where Vite runs on a different port.
app.use(cors(process.env.NODE_ENV === 'production' ? {} : { origin: true, credentials: true }));
// Dataset uploads are JSON-encoded rows, capped server-side at 200k rows (see
// MAX_ROWS in routes/datasets.js) — a wide dataset near that cap routinely produces
// a body well over 40mb thanks to per-row key-name overhead, so the limit here has
// to track that cap rather than an arbitrary smaller number.
app.use(express.json({ limit: '150mb' }));
app.use(cookieParser());

const upload = multer({ dest: uploadsDir, limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB cap

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const proxyLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/queries', queriesRouter);
app.use('/api/widgets', widgetsRouter);
app.use('/api/dashboards', dashboardsRouter);
app.use('/api/datasets', datasetsRouter);

/* ---- SQLite file upload: returns a server-side path to use as `database` ---- */
app.post('/api/sqlite/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!/\.(sqlite3?|db)$/i.test(req.file.originalname)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Expected a .sqlite, .sqlite3 or .db file.' });
  }
  res.json({ filePath: req.file.path });
});

const SUPPORTED_TYPES = ['sqlite', 'postgres', 'mysql', 'mssql'];

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
  if (type === 'mysql') {
    return {
      test: () => testMysql(conn),
      tables: () => listMysqlTables(conn),
      import: (table, limit) => importMysqlTable(conn, table, limit),
    };
  }
  if (type === 'mssql') {
    return {
      test: () => testMssql(conn),
      tables: () => listMssqlTables(conn),
      import: (table, limit) => importMssqlTable(conn, table, limit),
    };
  }
  // Oracle requires the proprietary Oracle Instant Client native libraries to be
  // installed on the host running this server — not something we can bundle or
  // guarantee in a generic deploy, so it stays an explicit, honest stub.
  throw new Error(
    `Database type "${type}" isn't wired up yet — only ${SUPPORTED_TYPES.join(', ')} work today.`
  );
}

app.post('/api/db/test', requireAuth, async (req, res) => {
  try {
    const { type, ...conn } = req.body;
    await dispatch(type, conn).test();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/db/tables', requireAuth, async (req, res) => {
  try {
    const { type, ...conn } = req.body;
    const tables = await dispatch(type, conn).tables();
    res.json({ tables });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/db/import', requireAuth, async (req, res) => {
  try {
    const { type, table, limit, ...conn } = req.body;
    if (!table) return res.status(400).json({ error: 'table is required' });
    const rows = await dispatch(type, conn).import(table, limit ? Number(limit) : 5000);
    res.json({ rows });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ---- REST API source: server-side fetch avoids browser CORS restrictions ----
   Gated behind auth + rate limiting, and the target host is resolved and checked
   against private/loopback/link-local ranges before fetching, so this can't be
   used as an open relay to probe the server's own internal network. */
app.post('/api/proxy/fetch', requireAuth, proxyLimiter, async (req, res) => {
  try {
    const { url, method = 'GET', headers = {}, body } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    await assertPublicHost(url);
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

// Catches errors forwarded via next(err) from async route handlers (e.g. a
// transient DB error) so the client gets a clean response instead of a hung request.
// Surfaces err.message (never the stack trace) — a blanket "Internal server error"
// made every failure indistinguishable from the client, including ones with a
// perfectly clear cause (payload too large, a Postgres constraint, bad encoding).
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log(`Query Studio backend listening on http://localhost:${PORT}`);
  if (!fs.existsSync(distDir)) {
    console.log('(no dist/ found — run `npm run build` to serve the frontend from this process too)');
  }
});
