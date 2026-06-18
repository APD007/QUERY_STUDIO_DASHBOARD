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
    data_json JSONB NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_queries_user ON queries(user_id);
  CREATE INDEX IF NOT EXISTS idx_widgets_user ON widgets(user_id);
  CREATE INDEX IF NOT EXISTS idx_dashboards_user ON dashboards(user_id);
  CREATE INDEX IF NOT EXISTS idx_datasets_user ON datasets(user_id);
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
    const res = await pool.query(
      `SELECT id, name, source_type, row_count, column_count, created_at, updated_at
       FROM datasets WHERE user_id = $1 ORDER BY updated_at DESC`,
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
    return {
      id: row.id,
      name: row.name,
      sourceType: row.source_type,
      rowCount: row.row_count,
      columnCount: row.column_count,
      schema: row.schema_json,
      rows: row.data_json,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async create(userId, { name, sourceType, schema, rows }) {
    const id = newId('ds');
    const now = nowIso();
    await withRetry(() => pool.query(
      `INSERT INTO datasets (id, user_id, name, source_type, row_count, column_count, schema_json, data_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [id, userId, name, sourceType, rows.length, schema.length, JSON.stringify(schema), JSON.stringify(rows), now]
    ));
    return {
      id, name, sourceType, rowCount: rows.length, columnCount: schema.length, createdAt: now, updatedAt: now,
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
