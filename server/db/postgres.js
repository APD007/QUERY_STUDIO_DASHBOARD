import pg from 'pg';

const { Client } = pg;

function makeClient({ host, port, database, user, password }) {
  return new Client({
    host,
    port: port ? Number(port) : 5432,
    database,
    user,
    password,
    connectionTimeoutMillis: 5000,
  });
}

export async function testPostgres(conn) {
  const client = makeClient(conn);
  await client.connect();
  await client.query('SELECT 1');
  await client.end();
  return true;
}

export async function listPostgresTables(conn) {
  const client = makeClient(conn);
  await client.connect();
  try {
    const res = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    return res.rows.map(r => r.table_name);
  } finally {
    await client.end();
  }
}

export async function importPostgresTable(conn, table, limit = 5000) {
  const client = makeClient(conn);
  await client.connect();
  try {
    const tablesRes = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const tables = tablesRes.rows.map(r => r.table_name);
    if (!tables.includes(table)) throw new Error(`Table "${table}" not found`);
    const res = await client.query(`SELECT * FROM "${table}" LIMIT $1`, [limit]);
    return res.rows;
  } finally {
    await client.end();
  }
}
