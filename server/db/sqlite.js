import { DatabaseSync } from 'node:sqlite';

function open(filePath) {
  return new DatabaseSync(filePath, { readOnly: true });
}

export function testSqlite(filePath) {
  const db = open(filePath);
  db.close();
  return true;
}

export function listSqliteTables(filePath) {
  const db = open(filePath);
  try {
    return db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map(r => r.name);
  } finally {
    db.close();
  }
}

export function importSqliteTable(filePath, table, limit = 5000) {
  const db = open(filePath);
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map(r => r.name);
    if (!tables.includes(table)) throw new Error(`Table "${table}" not found`);
    return db.prepare(`SELECT * FROM "${table}" LIMIT ?`).all(limit);
  } finally {
    db.close();
  }
}
