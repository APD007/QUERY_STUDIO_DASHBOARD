import sql from 'mssql';

function makeConfig({ host, port, database, user, password }) {
  return {
    server: host,
    port: port ? Number(port) : 1433,
    database,
    user,
    password,
    options: { encrypt: true, trustServerCertificate: true },
    connectionTimeout: 5000,
  };
}

async function withPool(conn, fn) {
  const pool = new sql.ConnectionPool(makeConfig(conn));
  await pool.connect();
  try {
    return await fn(pool);
  } finally {
    await pool.close();
  }
}

const TABLES_QUERY = `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`;

export async function testMssql(conn) {
  await withPool(conn, async pool => {
    await pool.request().query('SELECT 1 AS ok');
  });
  return true;
}

export async function listMssqlTables(conn) {
  return withPool(conn, async pool => {
    const result = await pool.request().query(TABLES_QUERY);
    return result.recordset.map(r => r.TABLE_NAME);
  });
}

export async function importMssqlTable(conn, table, limit = 5000) {
  return withPool(conn, async pool => {
    const tablesResult = await pool.request().query(TABLES_QUERY);
    const tables = tablesResult.recordset.map(r => r.TABLE_NAME);
    if (!tables.includes(table)) throw new Error(`Table "${table}" not found`);
    const result = await pool.request().query(`SELECT TOP ${Number(limit)} * FROM [${table}]`);
    return result.recordset;
  });
}
