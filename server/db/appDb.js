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

  CREATE INDEX IF NOT EXISTS idx_queries_user ON queries(user_id);
  CREATE INDEX IF NOT EXISTS idx_widgets_user ON widgets(user_id);
  CREATE INDEX IF NOT EXISTS idx_dashboards_user ON dashboards(user_id);
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

export default pool;
