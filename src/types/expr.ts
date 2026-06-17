/* ============================================================
   Expression-tree domain model.
   Every part of a query (SELECT items, WHERE, calculated fields)
   is represented as one of these node types and rendered to SQL
   by src/lib/sqlGenerator.ts.
   ============================================================ */

export type FieldType = 'text' | 'number' | 'date' | 'bool';

export type LiteralValueType = 'number' | 'string' | 'boolean' | 'date';

export interface LiteralNode {
  kind: 'literal';
  valueType: LiteralValueType;
  value: number | string | boolean;
}

export interface FieldNode {
  kind: 'field';
  name: string;
  /** Optional table qualifier, used once multi-table joins land (Phase 2). */
  table?: string;
}

export const AGG_FNS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] as const;
export type AggFn = (typeof AGG_FNS)[number];

export interface AggNode {
  kind: 'agg';
  fn: AggFn;
  /** '*' only valid for COUNT */
  arg: ExprNode | '*';
}

export const ARITH_OPS = ['+', '-', '*', '/', '%'] as const;
export type ArithOp = (typeof ARITH_OPS)[number];

export interface ArithNode {
  kind: 'arith';
  op: ArithOp;
  left: ExprNode;
  right: ExprNode;
}

export const COMPARE_OPS = ['=', '!=', '<', '>', '<=', '>='] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

export interface CompareNode {
  kind: 'compare';
  id: string;
  op: CompareOp;
  left: ExprNode;
  right: ExprNode;
}

export interface BetweenNode {
  kind: 'between';
  id: string;
  target: ExprNode;
  low: ExprNode;
  high: ExprNode;
}

export interface InNode {
  kind: 'in';
  id: string;
  target: ExprNode;
  list: ExprNode[];
}

export interface LikeNode {
  kind: 'like';
  id: string;
  target: ExprNode;
  pattern: ExprNode;
}

/** EXISTS / ANY / ALL / SOME — require subqueries, wired in Phase 2 (multi-table). */
export interface SubqueryOpNode {
  kind: 'subqueryOp';
  id: string;
  op: 'EXISTS' | 'ANY' | 'ALL' | 'SOME';
  /** Stays empty until JoinBuilder/subqueries ship. */
  query: unknown;
}

export type LogicalOp = 'AND' | 'OR';

export interface LogicalNode {
  kind: 'logical';
  id: string;
  op: LogicalOp;
  children: ExprNode[];
}

export interface NotNode {
  kind: 'not';
  id: string;
  child: ExprNode;
}

export const SQL_FNS = ['CAST', 'ROUND', 'FLOOR'] as const;
export type SqlFn = (typeof SQL_FNS)[number];

export interface FnNode {
  kind: 'fn';
  fn: SqlFn;
  args: ExprNode[];
  /** Only used by CAST, e.g. "INT", "FLOAT", "VARCHAR" */
  castType?: string;
}

export interface AliasNode {
  kind: 'alias';
  expr: ExprNode;
  as: string;
}

/* ---- Phase-2 / advanced-analytics placeholders (typed now, not yet executable) ---- */
export interface CaseBranch { when: ExprNode; then: ExprNode }
export interface CaseNode {
  kind: 'case';
  branches: CaseBranch[];
  elseValue?: ExprNode;
}
export interface FnExtNode {
  kind: 'fnExt';
  fn: 'DATE_TRUNC' | 'DATE_DIFF' | 'EXTRACT' | 'COALESCE' | 'NULLIF';
  args: ExprNode[];
}

export type ExprNode =
  | LiteralNode
  | FieldNode
  | AggNode
  | ArithNode
  | CompareNode
  | BetweenNode
  | InNode
  | LikeNode
  | SubqueryOpNode
  | LogicalNode
  | NotNode
  | FnNode
  | AliasNode
  | CaseNode
  | FnExtNode;

/* ============================================================
   Query model
   ============================================================ */

export interface SelectItem {
  id: string;
  expr: ExprNode;
  /** Display label, e.g. "severity" or "COUNT(*)" or a calculated-field alias */
  label: string;
}

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';

/** Phase-2 placeholder — typed so the architecture is in place, UI is disabled. */
export interface JoinSpec {
  id: string;
  type: JoinType;
  rightTable: string;
  leftKey: string;
  rightKey: string;
}

export type OrderDir = 'asc' | 'desc';

export interface OrderBySpec {
  field: string;
  dir: OrderDir;
}

export interface KpiMeta {
  name: string;
  group: string;
  domain: string;
  vendor: string;
  technology: string;
  nodeType: string;
  kpiType: string;
}

export const emptyKpiMeta = (): KpiMeta => ({
  name: '', group: '', domain: '', vendor: '', technology: '', nodeType: '', kpiType: '',
});

export type QueryMode = 'visual' | 'sql';

export interface Query {
  id: string | null;
  name: string;
  source: string;
  mode: QueryMode;           // 'sql' = run `rawSql` directly; 'visual' = build from the tree below
  rawSql: string;            // typed SQL, used when mode === 'sql'
  select: SelectItem[];
  where: LogicalNode;        // root is always a logical group (possibly empty AND)
  groupBy: string[];
  orderBy: OrderBySpec | null;
  limit: number | null;
  joins: JoinSpec[];         // Phase 2 — always [] until JoinBuilder ships
  kpi: KpiMeta;
}

export function emptyLogicalGroup(op: LogicalOp = 'AND'): LogicalNode {
  return { kind: 'logical', id: nextId('grp'), op, children: [] };
}

export interface ValidationError {
  message: string;
  path?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

/* ---- id helper for select items / tree nodes ---- */
let idSeq = 0;
export function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${idSeq}`;
}
