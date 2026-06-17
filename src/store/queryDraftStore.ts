import { create } from 'zustand';
import type {
  AggFn, ExprNode, JoinSpec, KpiMeta, LogicalOp, OrderBySpec, Query, SelectItem,
} from '@/types/expr';
import { emptyKpiMeta, emptyLogicalGroup } from '@/types/expr';
import type { FieldSchema } from '@/modules/queries/schema';
import { field, agg, isTrue, makeSelectItem } from '@/lib/exprBuilders';
import {
  addToGroup, removeNode, replaceNode, setGroupOp as setGroupOpInTree,
  wrapInNot, unwrapNot, wrapInGroup, findNodeById,
} from '@/lib/exprTree';
import { defaultLabelFor } from '@/lib/sqlGenerator';
import {
  type RowOp, getConditionTarget, buildConditionForOp, isConditionNode,
} from '@/lib/conditionOps';

export function createDefaultQuery(source: string, schema: FieldSchema[]): Query {
  // Prefer a categorical (text) field for the default GROUP BY dimension —
  // grouping by the first column is wrong when that column is a unique id.
  const preferredField = schema.find(s => s.name.toLowerCase() === 'severity')
    ?? schema.find(s => s.type === 'text')
    ?? schema[0];
  const first = preferredField?.name;
  const boolField = schema.find(s => s.type === 'bool')?.name;

  const select: SelectItem[] = first
    ? [makeSelectItem(field(first)), makeSelectItem(agg('COUNT', '*'))]
    : [];

  const where = emptyLogicalGroup('AND');
  if (boolField) where.children.push(isTrue(boolField));

  return {
    id: null,
    name: 'untitled_query',
    source,
    mode: 'visual',
    rawSql: '',
    select,
    where,
    groupBy: first ? [first] : [],
    orderBy: null,
    limit: null,
    joins: [],
    kpi: emptyKpiMeta(),
  };
}

interface QueryDraftState {
  draft: Query;

  setDraft(q: Query): void;
  resetDraft(source: string, schema: FieldSchema[]): void;
  setName(name: string): void;

  addSelectItem(item: SelectItem): void;
  removeSelectItem(id: string): void;
  updateSelectItem(id: string, patch: Partial<SelectItem>): void;
  reorderSelect(items: SelectItem[]): void;

  setGroupBy(fields: string[]): void;
  addGroupByField(f: string): void;
  removeGroupByField(f: string): void;

  setOrderBy(spec: OrderBySpec | null): void;
  setLimit(n: number | null): void;
  setKpiMeta(patch: Partial<KpiMeta>): void;

  addCondition(groupId: string, node: ExprNode): void;
  addGroup(parentGroupId: string, op: LogicalOp): void;
  removeConditionNode(id: string): void;
  replaceConditionNode(id: string, node: ExprNode): void;
  setGroupOp(groupId: string, op: LogicalOp): void;
  wrapNodeInNot(id: string): void;
  unwrapNodeFromNot(id: string): void;
  wrapNodeInGroup(id: string, op?: LogicalOp): void;

  setConditionField(condId: string, fieldName: string): void;
  setConditionOp(condId: string, op: RowOp): void;
  wrapSelectItemInAgg(itemId: string, fn: AggFn): void;
  setOrderByToItemLabel(label: string): void;

  addJoin(join: JoinSpec): void;
  removeJoin(id: string): void;
}

export const useQueryDraftStore = create<QueryDraftState>(set => ({
  draft: createDefaultQuery('fact_alarms', []),

  setDraft(q) { set({ draft: q }); },

  resetDraft(source, schema) { set({ draft: createDefaultQuery(source, schema) }); },

  setName(name) { set(s => ({ draft: { ...s.draft, name } })); },

  addSelectItem(item) {
    set(s => ({ draft: { ...s.draft, select: [...s.draft.select, item] } }));
  },
  removeSelectItem(id) {
    set(s => ({ draft: { ...s.draft, select: s.draft.select.filter(it => it.id !== id) } }));
  },
  updateSelectItem(id, patch) {
    set(s => ({
      draft: {
        ...s.draft,
        select: s.draft.select.map(it => (it.id === id ? { ...it, ...patch } : it)),
      },
    }));
  },
  reorderSelect(items) {
    set(s => ({ draft: { ...s.draft, select: items } }));
  },

  setGroupBy(fields) { set(s => ({ draft: { ...s.draft, groupBy: fields } })); },
  addGroupByField(f) {
    set(s => (s.draft.groupBy.includes(f) ? s : { draft: { ...s.draft, groupBy: [...s.draft.groupBy, f] } }));
  },
  removeGroupByField(f) {
    set(s => ({ draft: { ...s.draft, groupBy: s.draft.groupBy.filter(x => x !== f) } }));
  },

  setOrderBy(spec) { set(s => ({ draft: { ...s.draft, orderBy: spec } })); },
  setLimit(n) { set(s => ({ draft: { ...s.draft, limit: n } })); },
  setKpiMeta(patch) { set(s => ({ draft: { ...s.draft, kpi: { ...s.draft.kpi, ...patch } } })); },

  addCondition(groupId, node) {
    set(s => ({ draft: { ...s.draft, where: addToGroup(s.draft.where, groupId, node) } }));
  },
  addGroup(parentGroupId, op) {
    const newGroup = emptyLogicalGroup(op);
    set(s => ({ draft: { ...s.draft, where: addToGroup(s.draft.where, parentGroupId, newGroup) } }));
  },
  removeConditionNode(id) {
    set(s => ({ draft: { ...s.draft, where: removeNode(s.draft.where, id) } }));
  },
  replaceConditionNode(id, node) {
    set(s => ({ draft: { ...s.draft, where: replaceNode(s.draft.where, id, node) } }));
  },
  setGroupOp(groupId, op) {
    set(s => ({ draft: { ...s.draft, where: setGroupOpInTree(s.draft.where, groupId, op) } }));
  },
  wrapNodeInNot(id) {
    set(s => ({ draft: { ...s.draft, where: wrapInNot(s.draft.where, id) } }));
  },
  unwrapNodeFromNot(id) {
    set(s => ({ draft: { ...s.draft, where: unwrapNot(s.draft.where, id) } }));
  },
  wrapNodeInGroup(id, op = 'AND') {
    set(s => ({ draft: { ...s.draft, where: wrapInGroup(s.draft.where, id, op) } }));
  },

  setConditionField(condId, fieldName) {
    set(s => {
      const node = findNodeById(s.draft.where, condId);
      if (!node || !isConditionNode(node)) return s;
      const updated = node.kind === 'compare'
        ? { ...node, left: field(fieldName) }
        : { ...node, target: field(fieldName) };
      return { draft: { ...s.draft, where: replaceNode(s.draft.where, condId, updated) } };
    });
  },
  setConditionOp(condId, op) {
    set(s => {
      const node = findNodeById(s.draft.where, condId);
      if (!node || !isConditionNode(node)) return s;
      const updated = buildConditionForOp(op, getConditionTarget(node));
      return { draft: { ...s.draft, where: replaceNode(s.draft.where, condId, { ...updated, id: condId }) } };
    });
  },
  wrapSelectItemInAgg(itemId, fn) {
    set(s => {
      const item = s.draft.select.find(it => it.id === itemId);
      if (!item) return s;
      const arg: ExprNode | '*' = item.expr.kind === 'agg' ? item.expr.arg : item.expr;
      const newExpr = agg(fn, arg);
      const newLabel = defaultLabelFor(newExpr);
      return {
        draft: {
          ...s.draft,
          select: s.draft.select.map(it => (it.id === itemId ? { ...it, expr: newExpr, label: newLabel } : it)),
        },
      };
    });
  },
  setOrderByToItemLabel(label) {
    set(s => ({ draft: { ...s.draft, orderBy: { field: label, dir: s.draft.orderBy?.dir ?? 'desc' } } }));
  },

  addJoin(join) {
    set(s => ({ draft: { ...s.draft, joins: [...s.draft.joins, join] } }));
  },
  removeJoin(id) {
    set(s => ({ draft: { ...s.draft, joins: s.draft.joins.filter(j => j.id !== id) } }));
  },
}));

export function getDraft(): Query {
  return useQueryDraftStore.getState().draft;
}
