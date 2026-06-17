import {
  nextId, type ExprNode, type FieldNode, type LiteralNode, type LiteralValueType,
  type AggFn, type AggNode, type ArithOp, type ArithNode, type CompareOp, type CompareNode,
  type BetweenNode, type InNode, type LikeNode, type LogicalOp, type LogicalNode, type NotNode,
  type SqlFn, type FnNode, type SelectItem,
} from '@/types/expr';
import { defaultLabelFor } from './sqlGenerator';

export const field = (name: string): FieldNode => ({ kind: 'field', name });

export const literal = (valueType: LiteralValueType, value: number | string | boolean): LiteralNode => ({
  kind: 'literal', valueType, value,
});

export const agg = (fn: AggFn, arg: ExprNode | '*'): AggNode => ({ kind: 'agg', fn, arg });

export const arith = (op: ArithOp, left: ExprNode, right: ExprNode): ArithNode => ({
  kind: 'arith', op, left, right,
});

export const compare = (op: CompareOp, left: ExprNode, right: ExprNode): CompareNode => ({
  kind: 'compare', id: nextId('cmp'), op, left, right,
});

export const between = (target: ExprNode, low: ExprNode, high: ExprNode): BetweenNode => ({
  kind: 'between', id: nextId('btw'), target, low, high,
});

export const inOp = (target: ExprNode, list: ExprNode[]): InNode => ({
  kind: 'in', id: nextId('in'), target, list,
});

export const like = (target: ExprNode, pattern: ExprNode): LikeNode => ({
  kind: 'like', id: nextId('like'), target, pattern,
});

export const logicalGroup = (op: LogicalOp, children: ExprNode[] = []): LogicalNode => ({
  kind: 'logical', id: nextId('grp'), op, children,
});

export const notNode = (child: ExprNode): NotNode => ({ kind: 'not', id: nextId('not'), child });

export const sqlFn = (fn: SqlFn, args: ExprNode[], castType?: string): FnNode => ({
  kind: 'fn', fn, args, castType,
});

export function makeSelectItem(expr: ExprNode, label?: string): SelectItem {
  return { id: nextId('sel'), expr, label: label ?? defaultLabelFor(expr) };
}

/** Convenience: build a default "is true" / "is false" condition over a boolean field. */
export const isTrue  = (fieldName: string) => compare('=', field(fieldName), literal('boolean', true));
export const isFalse = (fieldName: string) => compare('=', field(fieldName), literal('boolean', false));

/** Convenience: "contains" → case-insensitive LIKE with wildcards baked in. */
export const contains = (fieldName: string, text: string) =>
  like(field(fieldName), literal('string', `%${text}%`));
