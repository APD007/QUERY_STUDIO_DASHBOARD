import type {
  ExprNode, LogicalNode, Query, SelectItem,
} from '@/types/expr';

/* ============================================================
   Expression → SQL
   ============================================================ */

function escapeStringLiteral(s: string): string {
  return s.replace(/'/g, "''");
}

function literalToSql(value: number | string | boolean, valueType: string): string {
  switch (valueType) {
    case 'number':  return String(value);
    case 'boolean': return value ? 'TRUE' : 'FALSE';
    case 'date':    return `'${escapeStringLiteral(String(value))}'`;
    default:        return `'${escapeStringLiteral(String(value))}'`;
  }
}

function renderLogicalChild(node: ExprNode): string {
  const sql = exprToSql(node);
  if (node.kind === 'logical' && node.children.length > 1) return `(${sql})`;
  if (node.kind === 'not') return sql;
  return sql;
}

function logicalToSql(node: LogicalNode): string {
  if (!node.children.length) return '';
  if (node.children.length === 1) return exprToSql(node.children[0]);
  return node.children.map(renderLogicalChild).join(` ${node.op} `);
}

export function exprToSql(node: ExprNode): string {
  switch (node.kind) {
    case 'literal':
      return literalToSql(node.value, node.valueType);

    case 'field':
      return node.table ? `${node.table}.${node.name}` : node.name;

    case 'agg': {
      const arg = node.arg === '*' ? '*' : exprToSql(node.arg);
      return `${node.fn}(${arg})`;
    }

    case 'arith':
      return `(${exprToSql(node.left)} ${node.op} ${exprToSql(node.right)})`;

    case 'compare':
      return `${exprToSql(node.left)} ${node.op} ${exprToSql(node.right)}`;

    case 'between':
      return `${exprToSql(node.target)} BETWEEN ${exprToSql(node.low)} AND ${exprToSql(node.high)}`;

    case 'in':
      return `${exprToSql(node.target)} IN (${node.list.map(exprToSql).join(', ')})`;

    case 'like':
      return `LOWER(${exprToSql(node.target)}) LIKE LOWER(${exprToSql(node.pattern)})`;

    case 'subqueryOp':
      // Phase 2 — requires multi-table join support
      return `/* ${node.op} subquery not yet supported */ TRUE`;

    case 'logical':
      return logicalToSql(node);

    case 'not':
      return `NOT (${exprToSql(node.child)})`;

    case 'fn':
      if (node.fn === 'CAST') {
        return `CAST(${exprToSql(node.args[0])} AS ${node.castType ?? 'VARCHAR'})`;
      }
      return `${node.fn}(${node.args.map(exprToSql).join(', ')})`;

    case 'alias':
      return exprToSql(node.expr);

    case 'case': {
      const branches = node.branches
        .map(b => `WHEN ${exprToSql(b.when)} THEN ${exprToSql(b.then)}`)
        .join(' ');
      const elsePart = node.elseValue ? ` ELSE ${exprToSql(node.elseValue)}` : '';
      return `CASE ${branches}${elsePart} END`;
    }

    case 'fnExt':
      return `${node.fn}(${node.args.map(exprToSql).join(', ')})`;

    default:
      return '';
  }
}

/* ============================================================
   Default label (used to decide whether a SELECT item needs
   an explicit AS, and as the result-column key)
   ============================================================ */

export function defaultLabelFor(expr: ExprNode): string {
  if (expr.kind === 'alias') return expr.as;
  return exprToSql(expr);
}

export function isPlainField(expr: ExprNode): boolean {
  return expr.kind === 'field';
}

/* ============================================================
   Full query → SQL
   ============================================================ */

export interface BuildSqlOptions {
  /** When true, SELECT items get safe internal aliases (_sel0, _sel1…) for AlaSQL execution. */
  forExecution?: boolean;
}

function selectItemSql(item: SelectItem, index: number, opts: BuildSqlOptions): string {
  const exprSql = exprToSql(item.expr);
  if (opts.forExecution) {
    return `${exprSql} AS _sel${index}`;
  }
  const autoLabel = defaultLabelFor(item.expr);
  return item.label && item.label !== autoLabel ? `${exprSql} AS ${item.label}` : exprSql;
}

export function buildQuerySql(query: Query, opts: BuildSqlOptions = {}): string {
  const selectSql = query.select.length
    ? query.select.map((it, i) => selectItemSql(it, i, opts)).join(', ')
    : '*';

  let sql = `SELECT ${selectSql} FROM ${opts.forExecution ? '?' : query.source}`;

  const whereSql = logicalToSql(query.where);
  if (whereSql) sql += ` WHERE ${whereSql}`;

  if (query.groupBy.length) sql += ` GROUP BY ${query.groupBy.join(', ')}`;

  if (query.orderBy?.field) {
    const idx = query.select.findIndex(it => it.label === query.orderBy!.field);
    if (idx >= 0) {
      const key = opts.forExecution ? `_sel${idx}` : query.orderBy.field;
      sql += ` ORDER BY ${key} ${query.orderBy.dir.toUpperCase()}`;
    }
  }

  if (query.limit) sql += ` LIMIT ${query.limit}`;

  return sql;
}

/** Pretty multi-line version for the SQL preview panel. */
export function buildDisplaySql(query: Query): string {
  const selectSql = query.select.length
    ? query.select.map((it, i) => selectItemSql(it, i, {})).join(',\n       ')
    : '*';

  const lines = [`SELECT ${selectSql}`, `FROM ${query.source}`];

  const whereSql = logicalToSql(query.where);
  if (whereSql) lines.push(`WHERE ${whereSql}`);
  if (query.groupBy.length) lines.push(`GROUP BY ${query.groupBy.join(', ')}`);
  if (query.orderBy?.field) lines.push(`ORDER BY ${query.orderBy.field} ${query.orderBy.dir.toUpperCase()}`);
  if (query.limit) lines.push(`LIMIT ${query.limit}`);

  return lines.join('\n');
}
