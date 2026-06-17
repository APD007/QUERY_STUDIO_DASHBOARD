import { Parser } from 'node-sql-parser';
import {
  emptyKpiMeta, emptyLogicalGroup, type CompareOp, type ExprNode, type Query,
} from '@/types/expr';
import {
  field, literal, agg, arith, compare, between, inOp, like, notNode, logicalGroup, makeSelectItem,
} from './exprBuilders';
import { exprToSql } from './sqlGenerator';

/* ============================================================
   SQL text -> visual-builder Query.
   Mirrors the subset of SQL the builder UI can actually edit:
   single table, no joins/subqueries/HAVING/UNION, WHERE built from
   AND/OR/NOT/compare/BETWEEN/IN/LIKE, GROUP BY of plain columns,
   single-column ORDER BY, optional LIMIT.
   ============================================================ */

const parser = new Parser();

const COMPARE_OP_MAP: Record<string, CompareOp> = {
  '=': '=', '!=': '!=', '<>': '!=', '<': '<', '>': '>', '<=': '<=', '>=': '>=',
};

const ARITH_OP_SET = new Set(['+', '-', '*', '/', '%']);

export interface ParsedQuery {
  ok: true;
  query: Query;
}
export interface ParsedQueryError {
  ok: false;
  error: string;
}

function unsupported(detail: string): never {
  throw new Error(`Can't load this into the builder: ${detail}`);
}

// node-sql-parser AST nodes are untyped (`any`) in its public types — narrow with `unknown` at the boundary instead.
function convertExpr(node: any): ExprNode {
  switch (node.type) {
    case 'column_ref':
      return field(node.column);

    case 'number':
      return literal('number', node.value);

    case 'single_quote_string':
    case 'string':
    case 'double_quote_string':
      return literal('string', String(node.value));

    case 'bool':
      return literal('boolean', !!node.value);

    case 'aggr_func': {
      const fn = String(node.name).toUpperCase();
      if (!['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(fn)) {
        unsupported(`the ${node.name} aggregate isn't supported by the builder yet`);
      }
      const argExpr = node.args?.expr;
      const isStar = argExpr?.type === 'star' || (argExpr?.type === 'column_ref' && argExpr.column === '*');
      return agg(fn as 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX', isStar ? '*' : convertExpr(argExpr));
    }

    case 'unary_expr':
      if (node.operator === 'NOT') return notNode(convertExpr(node.expr));
      if (node.operator === '-' && node.expr?.type === 'number') {
        return literal('number', -node.expr.value);
      }
      unsupported(`the unary "${node.operator}" operator isn't supported by the builder yet`);
      break;

    case 'binary_expr': {
      const op = node.operator;
      if (op === 'AND' || op === 'OR') return logicalGroup(op, flattenLogical(node, op));
      if (op in COMPARE_OP_MAP) return compare(COMPARE_OP_MAP[op], convertExpr(node.left), convertExpr(node.right));
      if (op === 'BETWEEN') {
        const [low, high] = node.right.value;
        return between(convertExpr(node.left), convertExpr(low), convertExpr(high));
      }
      if (op === 'IN' || op === 'NOT IN') {
        if (node.right.type !== 'expr_list') unsupported('IN with a subquery isn\'t supported by the builder yet');
        const inNode = inOp(convertExpr(node.left), node.right.value.map(convertExpr));
        return op === 'NOT IN' ? notNode(inNode) : inNode;
      }
      if (op === 'LIKE' || op === 'NOT LIKE') {
        const likeNode = like(convertExpr(node.left), convertExpr(node.right));
        return op === 'NOT LIKE' ? notNode(likeNode) : likeNode;
      }
      if (op === 'IS' || op === 'IS NOT') {
        unsupported('IS NULL / IS NOT NULL isn\'t supported by the builder yet');
      }
      if (ARITH_OP_SET.has(op)) return arith(op as '+' | '-' | '*' | '/' | '%', convertExpr(node.left), convertExpr(node.right));
      unsupported(`the "${op}" operator isn't supported by the builder yet`);
      break;
    }

    default:
      unsupported(`a "${node.type}" expression isn't supported by the builder yet`);
  }
}

// Expands node's own left/right into a flat list, inlining further same-op,
// non-parenthesized children so "A AND B AND C" becomes one 3-child group
// instead of a left-leaning binary tree.
function flattenLogical(node: any, op: 'AND' | 'OR'): ExprNode[] {
  return [...flattenLogicalChild(node.left, op), ...flattenLogicalChild(node.right, op)];
}

function flattenLogicalChild(node: any, op: 'AND' | 'OR'): ExprNode[] {
  if (node.type === 'binary_expr' && node.operator === op && !node.parentheses) {
    return flattenLogical(node, op);
  }
  return [convertExpr(node)];
}

export function parseSqlToQuery(sql: string, expectedSource: string): ParsedQuery | ParsedQueryError {
  let ast: any;
  try {
    ast = parser.astify(sql, { database: 'MySQL' });
  } catch (err) {
    return { ok: false, error: `Couldn't parse this as SQL: ${(err as Error).message}` };
  }

  try {
    if (Array.isArray(ast)) {
      if (ast.length !== 1) unsupported('only a single SELECT statement is supported');
      ast = ast[0];
    }
    if (ast.type !== 'select') unsupported('only SELECT statements are supported');
    if (ast.having) unsupported('HAVING isn\'t supported by the builder yet');
    if (!ast.from || ast.from.length !== 1 || ast.from[0].join) {
      unsupported('multi-table joins aren\'t supported yet — see the Join Builder (Phase 2)');
    }

    const tableName = ast.from[0].table;
    if (tableName && tableName.toLowerCase() !== expectedSource.toLowerCase()) {
      unsupported(`this query reads from "${tableName}", but the active dataset is "${expectedSource}"`);
    }

    const select = ast.columns.map((col: any) => {
      const isStarCol = col.expr.type === 'star' || (col.expr.type === 'column_ref' && col.expr.column === '*');
      if (isStarCol) return null;
      return makeSelectItem(convertExpr(col.expr), col.as ?? undefined);
    }).filter((it: unknown) => it !== null);

    const where = ast.where ? convertExpr(ast.where) : emptyLogicalGroup('AND');
    const whereGroup = where.kind === 'logical' ? where : logicalGroup('AND', [where]);

    const groupBy: string[] = (ast.groupby?.columns ?? []).map((c: any) => {
      if (c.type !== 'column_ref') unsupported('GROUP BY on an expression (not a plain column) isn\'t supported by the builder yet');
      return c.column;
    });

    if (ast.orderby && ast.orderby.length > 1) {
      unsupported('multi-column ORDER BY isn\'t supported by the builder yet');
    }
    const orderBy = ast.orderby?.length
      ? { field: exprToSql(convertExpr(ast.orderby[0].expr)), dir: (ast.orderby[0].type === 'ASC' ? 'asc' : 'desc') as 'asc' | 'desc' }
      : null;

    if (ast.limit?.value?.length > 1) unsupported('LIMIT with an OFFSET isn\'t supported by the builder yet');
    const limit = ast.limit?.value?.[0]?.value ?? null;

    const query: Query = {
      id: null,
      name: 'untitled_query',
      source: expectedSource,
      mode: 'visual',
      rawSql: '',
      select,
      where: whereGroup,
      groupBy,
      orderBy,
      limit,
      joins: [],
      kpi: emptyKpiMeta(),
    };
    return { ok: true, query };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
