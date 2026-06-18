import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required — set it to a Postgres connection string (see .env.example).'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Most hosted Postgres providers (Render, Neon, Supabase) require SSL and present
  // a cert that isn't in Node's default CA store.
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
});

// pg.Pool crashes the whole process on an unhandled error from an idle client
// (e.g. the DB closing a connection) unless something is listening for it.
pool.on('error', err => console.error('Postgres pool error:', err));

await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS queries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS widgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dashboards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    column_count INTEGER NOT NULL,
    schema_json JSONB NOT NULL,
    data_json JSONB,
    status TEXT NOT NULL DEFAULT 'ready',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Row data for a chunked upload lands here, one (small) chunk per request, instead
  -- of one giant JSONB value built from a single multi-hundred-MB request body —
  -- that single-blob shape is what was crashing the app on a large CSV/Excel upload.
  CREATE TABLE IF NOT EXISTS dataset_chunks (
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    rows_json JSONB NOT NULL,
    PRIMARY KEY (dataset_id, chunk_index)
  );

  CREATE INDEX IF NOT EXISTS idx_queries_user ON queries(user_id);
  CREATE INDEX IF NOT EXISTS idx_widgets_user ON widgets(user_id);
  CREATE INDEX IF NOT EXISTS idx_dashboards_user ON dashboards(user_id);
  CREATE INDEX IF NOT EXISTS idx_datasets_user ON datasets(user_id);
`);

// Pre-existing deployments created `datasets` before `status`/nullable `data_json`
// existed — bring them up to date in place rather than requiring a manual migration.
await pool.query(`
  ALTER TABLE datasets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready';
  ALTER TABLE datasets ALTER COLUMN data_json DROP NOT NULL;
`);

const nowIso = () => new Date().toISOString();
const newId = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/* ---------------- users ---------------- */

export async function createUser(email, passwordHash) {
  const id = newId('user');
  await pool.query(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4)',
    [id, email, passwordHash, nowIso()]
  );
  return { id, email };
}

export async function findUserByEmail(email) {
  const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return res.rows[0] ?? null;
}

export async function findUserById(id) {
  const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

/* ---------------- generic per-table CRUD (queries / widgets / dashboards) ---------------- */

function makeCollection(table, idPrefix) {
  const list = async userId => {
    const res = await pool.query(
      `SELECT id, name, data, created_at, updated_at FROM ${table} WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    return res.rows.map(row => ({ ...JSON.parse(row.data), id: row.id, name: row.name }));
  };

  const get = async (id, userId) => {
    const res = await pool.query(`SELECT * FROM ${table} WHERE id = $1 AND user_id = $2`, [id, userId]);
    const row = res.rows[0];
    return row ? { ...JSON.parse(row.data), id: row.id, name: row.name } : null;
  };

  const upsert = async (userId, item) => {
    const id = item.id || newId(idPrefix);
    const existing = item.id
      ? (await pool.query(`SELECT id FROM ${table} WHERE id = $1 AND user_id = $2`, [item.id, userId])).rows[0]
      : null;
    const data = JSON.stringify({ ...item, id });
    if (existing) {
      await pool.query(
        `UPDATE ${table} SET name = $1, data = $2, updated_at = $3 WHERE id = $4 AND user_id = $5`,
        [item.name ?? '', data, nowIso(), id, userId]
      );
    } else {
      await pool.query(
        `INSERT INTO ${table} (id, user_id, name, data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, userId, item.name ?? '', data, nowIso(), nowIso()]
      );
    }
    return id;
  };

  const remove = async (id, userId) => {
    await pool.query(`DELETE FROM ${table} WHERE id = $1 AND user_id = $2`, [id, userId]);
  };

  return { list, get, upsert, remove };
}

export const queriesRepo = makeCollection('queries', 'q');
export const widgetsRepo = makeCollection('widgets', 'w');
export const dashboardsRepo = makeCollection('dashboards', 'board');

/* ---------------- datasets ---------------- */

// Hosted Postgres (Render free tier, Neon, etc.) can drop the connection mid-query
// on a cold start or under the load of a single large JSONB insert/read — transient,
// and gone on retry. A real query error (bad SQL, constraint violation) won't match
// this and rethrows immediately.
async function withRetry(fn, attempts = 2, delayMs = 700) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const transient = /connection terminated|terminating connection|connection ended|ECONNRESET/i.test(err.message);
      if (!transient || i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

export const datasetsRepo = {
  async list(userId) {
    // 'pending' rows are uploads still mid-chunk — hide them until finishCreate marks
    // them 'ready' so a half-uploaded dataset never shows up as selectable.
    const res = await pool.query(
      `SELECT id, name, source_type, row_count, column_count, created_at, updated_at
       FROM datasets WHERE user_id = $1 AND status = 'ready' ORDER BY updated_at DESC`,
      [userId]
    );
    return res.rows.map(row => ({
      id: row.id,
      name: row.name,
      sourceType: row.source_type,
      rowCount: row.row_count,
      columnCount: row.column_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  async get(id, userId) {
    const res = await withRetry(() => pool.query('SELECT * FROM datasets WHERE id = $1 AND user_id = $2', [id, userId]));
    const row = res.rows[0];
    if (!row) return null;
    // Older datasets were written as one big data_json blob; chunked uploads leave it
    // null and store their rows as separate (small) chunk rows instead.
    let rows = row.data_json;
    if (rows == null) {
      const chunks = await withRetry(() => pool.query(
        'SELECT rows_json FROM dataset_chunks WHERE dataset_id = $1 ORDER BY chunk_index',
        [id]
      ));
      rows = chunks.rows.flatMap(c => c.rows_json);
    }
    return {
      id: row.id,
      name: row.name,
      sourceType: row.source_type,
      rowCount: row.row_count,
      columnCount: row.column_count,
      schema: row.schema_json,
      rows,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async startCreate(userId, { name, sourceType, schema }) {
    const id = newId('ds');
    const now = nowIso();
    await pool.query(
      `INSERT INTO datasets (id, user_id, name, source_type, row_count, column_count, schema_json, data_json, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 0, $5, $6, NULL, 'pending', $7, $7)`,
      [id, userId, name, sourceType, schema.length, JSON.stringify(schema), now]
    );
    return { id };
  },

  async appendChunk(id, userId, chunkIndex, rows) {
    const owns = await pool.query('SELECT 1 FROM datasets WHERE id = $1 AND user_id = $2', [id, userId]);
    if (!owns.rows[0]) throw new Error('Dataset not found');
    // ON CONFLICT makes a retried chunk request safe to resend rather than duplicating rows.
    await withRetry(() => pool.query(
      `INSERT INTO dataset_chunks (dataset_id, chunk_index, rows_json) VALUES ($1, $2, $3)
       ON CONFLICT (dataset_id, chunk_index) DO UPDATE SET rows_json = EXCLUDED.rows_json`,
      [id, chunkIndex, JSON.stringify(rows)]
    ));
  },

  async finishCreate(id, userId) {
    const owns = await pool.query('SELECT name, source_type, column_count, created_at FROM datasets WHERE id = $1 AND user_id = $2', [id, userId]);
    const ds = owns.rows[0];
    if (!ds) throw new Error('Dataset not found');
    const countRes = await pool.query(
      `SELECT COALESCE(SUM(jsonb_array_length(rows_json)), 0) AS n FROM dataset_chunks WHERE dataset_id = $1`,
      [id]
    );
    const rowCount = Number(countRes.rows[0].n);
    const now = nowIso();
    await pool.query(
      `UPDATE datasets SET row_count = $1, status = 'ready', updated_at = $2 WHERE id = $3 AND user_id = $4`,
      [rowCount, now, id, userId]
    );
    return {
      id, name: ds.name, sourceType: ds.source_type, rowCount, columnCount: ds.column_count,
      createdAt: ds.created_at, updatedAt: now,
    };
  },

  async rename(id, userId, name) {
    await pool.query(
      'UPDATE datasets SET name = $1, updated_at = $2 WHERE id = $3 AND user_id = $4',
      [name, nowIso(), id, userId]
    );
  },

  async remove(id, userId) {
    await pool.query('DELETE FROM datasets WHERE id = $1 AND user_id = $2', [id, userId]);
  },
};

export default pool;
