import mysql from 'mysql2/promise';

function makeConfig({ host, port, database, user, password }) {
  return { host, port: port ? Number(port) : 3306, database, user, password, connectTimeout: 5000 };
}

export async function testMysql(conn) {
  const connection = await mysql.createConnection(makeConfig(conn));
  await connection.query('SELECT 1');
  await connection.end();
  return true;
}

export async function listMysqlTables(conn) {
  const connection = await mysql.createConnection(makeConfig(conn));
  try {
    const [rows] = await connection.query('SHOW TABLES');
    return rows.map(r => Object.values(r)[0]);
  } finally {
    await connection.end();
  }
}

export async function importMysqlTable(conn, table, limit = 5000) {
  const connection = await mysql.createConnection(makeConfig(conn));
  try {
    const [tableRows] = await connection.query('SHOW TABLES');
    const tables = tableRows.map(r => Object.values(r)[0]);
    if (!tables.includes(table)) throw new Error(`Table "${table}" not found`);
    const [rows] = await connection.query(`SELECT * FROM \`${table}\` LIMIT ?`, [limit]);
    return rows;
  } finally {
    await connection.end();
  }
}
